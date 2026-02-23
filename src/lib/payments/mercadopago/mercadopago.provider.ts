/**
 * MercadoPago implementation of the PaymentProvider interface.
 */

import crypto from 'crypto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

import type {
    PaymentProvider,
    CreateProviderCustomerInput,
    ProviderCustomer,
    CreateCheckoutSessionInput,
    CheckoutSession,
    CancelProviderSubscriptionInput,
    ChangeProviderSubscriptionPlanInput,
    ReactivateProviderSubscriptionInput,
    WebhookVerificationMeta
} from '@/domain/subscriptions/payment-provider'
import type { PaymentEvent } from '@/domain/subscriptions/subscription.types'
import {
    createMercadoPagoAuthorizedPreapproval,
    getMercadoPagoPayment,
    getMercadoPagoPreapproval,
    updateMercadoPagoPreapproval
} from './mercadopago.client'

interface MercadoPagoWebhookPayload {
    id?: string | number
    type?: string
    topic?: string
    action?: string
    data?: {
        id?: string | number
    }
}

interface MercadoPagoConstructedWebhook {
    payload: MercadoPagoWebhookPayload
    topic: string
    action: string
    resourceId: string | null
    preapprovalDetails: Awaited<ReturnType<typeof getMercadoPagoPreapproval>> | null
    paymentDetails: Awaited<ReturnType<typeof getMercadoPagoPayment>> | null
}

function parseDate(value: string | undefined | null): Date | undefined {
    if (!value) {
        return undefined
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
        return undefined
    }

    return parsed
}

function toCents(amount: number | undefined): number | undefined {
    if (typeof amount !== 'number') {
        return undefined
    }

    return Math.round(amount * 100)
}

/**
 * MP dashboard webhooks use prefixed topics (e.g. "subscription_preapproval"),
 * while IPN / notification_url uses the short form ("preapproval").
 * Normalize to the short routing key so all downstream checks work uniformly.
 */
export function normalizeTopicForRouting(rawTopic: string): string {
    if (rawTopic === 'subscription_preapproval') return 'preapproval'
    if (rawTopic === 'subscription_authorized_payment') return 'payment'
    if (rawTopic === 'subscription_preapproval_plan') return 'preapproval_plan'
    return rawTopic
}

function normalizeWebhookSignature(signature: string): { ts?: string; v1?: string } {
    const entries = signature
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)

    const values: { ts?: string; v1?: string } = {}

    for (const entry of entries) {
        const [key, value] = entry.split('=')
        if (!key || !value) {
            continue
        }

        if (key === 'ts') {
            values.ts = value
        }

        if (key === 'v1') {
            values.v1 = value
        }
    }

    return values
}

export class MercadoPagoProvider implements PaymentProvider {
    readonly type = 'MERCADOPAGO' as const

    async createCustomer(input: CreateProviderCustomerInput): Promise<ProviderCustomer> {
        return {
            providerCustomerId: input.businessId
        }
    }

    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
        if (!input.cardTokenId) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                'cardTokenId es obligatorio para suscripciones con Mercado Pago.',
                400
            )
        }

        const preapproval = await createMercadoPagoAuthorizedPreapproval({
            preapprovalPlanId: input.planPriceId,
            externalReference: input.providerCustomerId,
            reason: `Suscripción ${input.businessId}`,
            email: input.customerEmail ?? '',
            cardTokenId: input.cardTokenId
        })

        return {
            sessionId: preapproval.id
        }
    }

    async cancelSubscription(input: CancelProviderSubscriptionInput): Promise<void> {
        await updateMercadoPagoPreapproval(input.providerSubscriptionId, {
            status: input.immediate ? 'cancelled' : 'cancelled'
        })
    }

    async changeSubscriptionPlan(input: ChangeProviderSubscriptionPlanInput): Promise<void> {
        await updateMercadoPagoPreapproval(input.providerSubscriptionId, {
            preapprovalPlanId: input.newPlanPriceId
        })
    }

    async reactivateSubscription(input: ReactivateProviderSubscriptionInput): Promise<void> {
        await updateMercadoPagoPreapproval(input.providerSubscriptionId, {
            status: 'authorized'
        })
    }

    async constructWebhookEvent(payload: Buffer, signature: string, meta?: WebhookVerificationMeta): Promise<unknown> {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET

        if (secret) {
            const { ts, v1 } = normalizeWebhookSignature(signature)

            if (!ts || !v1) {
                throw new AppError(
                    SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                    'Firma de webhook de Mercado Pago inválida.',
                    400
                )
            }

            // MP uses a manifest template: id:{data.id};request-id:{x-request-id};ts:{ts};
            // Missing parts must be omitted entirely (not left empty).
            let manifest = ''
            if (meta?.dataId) {
                manifest += `id:${meta.dataId};`
            }
            if (meta?.requestId) {
                manifest += `request-id:${meta.requestId};`
            }
            manifest += `ts:${ts};`

            const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

            if (expected !== v1) {
                throw new AppError(
                    SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                    'Verificación de firma de Mercado Pago fallida.',
                    400
                )
            }
        }

        const parsedPayload = JSON.parse(payload.toString('utf-8')) as MercadoPagoWebhookPayload

        const rawTopic = (parsedPayload.type ?? parsedPayload.topic ?? '').toLowerCase()
        const topic = normalizeTopicForRouting(rawTopic)
        const action = (parsedPayload.action ?? '').toLowerCase()
        const resourceIdValue = parsedPayload.data?.id ?? parsedPayload.id
        const resourceId = resourceIdValue ? String(resourceIdValue) : null

        let preapprovalDetails: Awaited<ReturnType<typeof getMercadoPagoPreapproval>> | null = null
        let paymentDetails: Awaited<ReturnType<typeof getMercadoPagoPayment>> | null = null

        if (topic === 'preapproval' && resourceId) {
            preapprovalDetails = await getMercadoPagoPreapproval(resourceId)
        }

        if (topic === 'payment' && resourceId) {
            paymentDetails = await getMercadoPagoPayment(resourceId)
        }

        const webhookEvent: MercadoPagoConstructedWebhook = {
            payload: parsedPayload,
            topic,
            action,
            resourceId,
            preapprovalDetails,
            paymentDetails
        }

        return webhookEvent
    }

    normalizeEvent(rawEvent: unknown): PaymentEvent | null {
        const event = rawEvent as MercadoPagoConstructedWebhook

        if (event.topic === 'preapproval' && event.preapprovalDetails) {
            const preapproval = event.preapprovalDetails
            const status = preapproval.status?.toLowerCase()
            const currentPeriodStart =
                parseDate(preapproval.date_last_modified) ?? parseDate(preapproval.date_created) ?? new Date()
            const currentPeriodEnd =
                parseDate(preapproval.next_payment_date) ??
                new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000)

            const providerEventId = String(
                event.payload.id ?? `preapproval:${preapproval.id}:${event.action || status || 'updated'}`
            )

            if (status === 'authorized') {
                return {
                    providerEventId,
                    provider: 'MERCADOPAGO',
                    type: 'payment_succeeded',
                    providerCustomerId:
                        preapproval.external_reference ?? preapproval.payer_email ?? String(preapproval.payer_id ?? ''),
                    providerSubscriptionId: preapproval.id,
                    amountCents: toCents(preapproval.auto_recurring?.transaction_amount),
                    currency: preapproval.auto_recurring?.currency_id?.toUpperCase(),
                    currentPeriodStart,
                    currentPeriodEnd,
                    metadata: {
                        topic: event.topic,
                        action: event.action,
                        status
                    }
                }
            }

            if (status === 'cancelled') {
                return {
                    providerEventId,
                    provider: 'MERCADOPAGO',
                    type: 'subscription_canceled',
                    providerCustomerId:
                        preapproval.external_reference ?? preapproval.payer_email ?? String(preapproval.payer_id ?? ''),
                    providerSubscriptionId: preapproval.id,
                    metadata: {
                        topic: event.topic,
                        action: event.action,
                        status
                    }
                }
            }

            return null
        }

        if (event.topic === 'payment' && event.paymentDetails) {
            const payment = event.paymentDetails
            const status = payment.status?.toLowerCase()

            if (!payment.preapproval_id) {
                return null
            }

            const providerEventId = String(event.payload.id ?? `payment:${payment.id}:${status || 'updated'}`)

            if (status === 'approved') {
                return {
                    providerEventId,
                    provider: 'MERCADOPAGO',
                    type: 'payment_succeeded',
                    providerCustomerId:
                        payment.external_reference ?? payment.payer?.email ?? String(payment.payer?.id ?? ''),
                    providerSubscriptionId: payment.preapproval_id,
                    providerPaymentId: String(payment.id),
                    amountCents: toCents(payment.transaction_amount),
                    currency: payment.currency_id?.toUpperCase(),
                    currentPeriodStart: parseDate(payment.date_created),
                    currentPeriodEnd: parseDate(payment.date_approved) ?? undefined,
                    metadata: {
                        topic: event.topic,
                        action: event.action,
                        status
                    }
                }
            }

            if (status === 'rejected' || status === 'cancelled') {
                return {
                    providerEventId,
                    provider: 'MERCADOPAGO',
                    type: 'payment_failed',
                    providerCustomerId:
                        payment.external_reference ?? payment.payer?.email ?? String(payment.payer?.id ?? ''),
                    providerSubscriptionId: payment.preapproval_id,
                    providerPaymentId: String(payment.id),
                    amountCents: toCents(payment.transaction_amount),
                    currency: payment.currency_id?.toUpperCase(),
                    metadata: {
                        topic: event.topic,
                        action: event.action,
                        status
                    }
                }
            }
        }

        return null
    }
}
