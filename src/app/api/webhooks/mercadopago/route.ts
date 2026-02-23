import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { MercadoPagoProvider } from '@/lib/payments/mercadopago/mercadopago.provider'
import {
    getMercadoPagoPayment,
    getMercadoPagoPreapproval,
    isMercadoPagoEnabled
} from '@/lib/payments/mercadopago/mercadopago.client'
import { paymentEventExists } from '@/data/repositories/payment-transaction.repo'
import {
    handlePaymentSucceeded,
    handlePaymentFailed,
    handleProviderSubscriptionCanceled
} from '@/domain/subscriptions/subscription.service'

const mercadopagoProvider = new MercadoPagoProvider()

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

function ack(data: Record<string, unknown> = {}) {
    return NextResponse.json(
        {
            data: {
                received: true,
                ...data
            }
        },
        { status: 200 }
    )
}

async function constructWebhookEventWithoutSignature(rawBody: Buffer): Promise<MercadoPagoConstructedWebhook> {
    const payload = JSON.parse(rawBody.toString('utf-8')) as MercadoPagoWebhookPayload
    const topic = (payload.type ?? payload.topic ?? '').toLowerCase()
    const action = (payload.action ?? '').toLowerCase()
    const resourceIdValue = payload.data?.id ?? payload.id
    const resourceId = resourceIdValue ? String(resourceIdValue) : null

    let preapprovalDetails: Awaited<ReturnType<typeof getMercadoPagoPreapproval>> | null = null
    let paymentDetails: Awaited<ReturnType<typeof getMercadoPagoPayment>> | null = null

    if (topic === 'preapproval' && resourceId) {
        preapprovalDetails = await getMercadoPagoPreapproval(resourceId)
    }

    if (topic === 'payment' && resourceId) {
        paymentDetails = await getMercadoPagoPayment(resourceId)
    }

    return {
        payload,
        topic,
        action,
        resourceId,
        preapprovalDetails,
        paymentDetails
    }
}

/**
 * POST /api/webhooks/mercadopago
 */
export async function POST(request: NextRequest) {
    try {
        if (!isMercadoPagoEnabled()) {
            console.error('[Webhook:MercadoPago] Mercado Pago no está configurado.')
            return ack({ processed: false })
        }

        const isProduction = process.env.APP_ENV === 'production'
        const rawBody = Buffer.from(await request.arrayBuffer())
        const signature = request.headers.get('x-signature')
        const requestId = request.headers.get('x-request-id') ?? undefined
        const dataId = request.nextUrl.searchParams.get('data.id') ?? undefined

        let rawEvent: unknown

        if (isProduction) {
            if (!signature) {
                console.error('[Webhook:MercadoPago] Missing x-signature header in production.')
                return ack({ processed: false })
            }

            try {
                rawEvent = await mercadopagoProvider.constructWebhookEvent(rawBody, signature, {
                    dataId,
                    requestId
                })
            } catch (error) {
                console.error('[Webhook:MercadoPago] Signature verification failed in production:', error)
                return ack({ processed: false })
            }
        } else {
            // Non-production: still validate signature if present, but don't fail on missing
            if (signature) {
                try {
                    rawEvent = await mercadopagoProvider.constructWebhookEvent(rawBody, signature, {
                        dataId,
                        requestId
                    })
                } catch (error) {
                    console.warn('[Webhook:MercadoPago] Signature verification failed (non-prod, proceeding):', error)
                    rawEvent = await constructWebhookEventWithoutSignature(rawBody)
                }
            } else {
                rawEvent = await constructWebhookEventWithoutSignature(rawBody)
            }
        }

        const event = mercadopagoProvider.normalizeEvent(rawEvent)

        if (!event) {
            return ack({ processed: false })
        }

        const alreadyProcessed = await paymentEventExists(prisma, event.providerEventId)
        if (alreadyProcessed) {
            return ack({ processed: false, duplicate: true })
        }

        switch (event.type) {
            case 'payment_succeeded':
                await handlePaymentSucceeded(prisma, event)
                break

            case 'payment_failed':
                await handlePaymentFailed(prisma, event)
                break

            case 'subscription_canceled':
                await handleProviderSubscriptionCanceled(prisma, event)
                break

            default:
                break
        }

        return ack({ processed: true })
    } catch (error) {
        console.error('[Webhook:MercadoPago] Unexpected error:', {
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return ack({ processed: false })
    }
}
