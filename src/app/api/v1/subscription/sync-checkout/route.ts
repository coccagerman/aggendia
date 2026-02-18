import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { stripe } from '@/lib/payments/stripe/stripe.client'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { syncCheckoutRequestSchema } from '../dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'
import { activateSubscriptionFromProviderSnapshot } from '@/domain/subscriptions/subscription.service'
import { getMercadoPagoPreapproval } from '@/lib/payments/mercadopago/mercadopago.client'

function toDate(unixSeconds: number | null | undefined): Date | null {
    if (!unixSeconds || unixSeconds <= 0) {
        return null
    }
    return new Date(unixSeconds * 1000)
}

function getExpandedSubscription(value: string | Stripe.Subscription | null): Stripe.Subscription | null {
    if (!value || typeof value === 'string') {
        return null
    }
    return value
}

function getSubscriptionPeriod(subscription: Stripe.Subscription | null): {
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
} {
    if (!subscription) {
        return {
            currentPeriodStart: null,
            currentPeriodEnd: null
        }
    }

    const raw = subscription as unknown as Record<string, unknown>
    const start = typeof raw.current_period_start === 'number' ? raw.current_period_start : null
    const end = typeof raw.current_period_end === 'number' ? raw.current_period_end : null

    return {
        currentPeriodStart: toDate(start),
        currentPeriodEnd: toDate(end)
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await requireAuth()

        const body = await request.json().catch(() => ({}))
        const parsed = syncCheckoutRequestSchema.safeParse(body)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Datos inválidos.',
                        details: parsed.error.flatten()
                    }
                },
                { status: 400 }
            )
        }

        const subscription = await getSubscriptionByUserId(prisma, userId)
        if (!subscription) {
            throw new AppError(SubscriptionErrorCodes.SUBSCRIPTION_NOT_FOUND, 'No se encontró la suscripción.', 404)
        }

        if (!subscription.providerCustomerId || !subscription.paymentProvider) {
            return NextResponse.json({ data: { synced: false, reason: 'PROVIDER_NOT_READY' } })
        }

        if (subscription.paymentProvider === 'MERCADOPAGO') {
            const preapprovalId = parsed.data.preapprovalId ?? subscription.providerSubscriptionId
            if (!preapprovalId) {
                return NextResponse.json({ data: { synced: false, reason: 'SUBSCRIPTION_NOT_FOUND' } })
            }

            const preapproval = await getMercadoPagoPreapproval(preapprovalId)

            if (preapproval.external_reference && preapproval.external_reference !== subscription.providerCustomerId) {
                throw new AppError(
                    SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                    'La suscripción de Mercado Pago no pertenece al usuario autenticado.',
                    403
                )
            }

            const status = preapproval.status?.toLowerCase()
            if (status !== 'authorized') {
                return NextResponse.json({ data: { synced: false, reason: 'SUBSCRIPTION_NOT_FOUND' } })
            }

            const currentPeriodStart = preapproval.date_last_modified
                ? new Date(preapproval.date_last_modified)
                : preapproval.date_created
                  ? new Date(preapproval.date_created)
                  : new Date()

            const currentPeriodEnd = preapproval.next_payment_date
                ? new Date(preapproval.next_payment_date)
                : new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000)

            await activateSubscriptionFromProviderSnapshot(prisma, {
                userId,
                provider: 'MERCADOPAGO',
                providerCustomerId: subscription.providerCustomerId,
                providerSubscriptionId: preapproval.id,
                currentPeriodStart,
                currentPeriodEnd
            })

            return NextResponse.json({ data: { synced: true } })
        }

        if (!stripe) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'Stripe no está configurado correctamente.',
                500
            )
        }

        let providerSubscriptionId: string | null = null
        let currentPeriodStart: Date | null = null
        let currentPeriodEnd: Date | null = null

        if (parsed.data.sessionId) {
            const session = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, {
                expand: ['subscription']
            })

            const sessionCustomerId =
                typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null)

            if (!sessionCustomerId || sessionCustomerId !== subscription.providerCustomerId) {
                throw new AppError(
                    SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                    'La sesión de checkout no pertenece al usuario autenticado.',
                    403
                )
            }

            const expanded = getExpandedSubscription(session.subscription)
            providerSubscriptionId =
                expanded?.id ?? (typeof session.subscription === 'string' ? session.subscription : null)
            const period = getSubscriptionPeriod(expanded)
            currentPeriodStart = period.currentPeriodStart
            currentPeriodEnd = period.currentPeriodEnd
        } else if (subscription.providerSubscriptionId) {
            const providerSub = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId)
            providerSubscriptionId = providerSub.id
            const period = getSubscriptionPeriod(providerSub)
            currentPeriodStart = period.currentPeriodStart
            currentPeriodEnd = period.currentPeriodEnd
        }

        if (!providerSubscriptionId || !currentPeriodStart || !currentPeriodEnd) {
            return NextResponse.json({ data: { synced: false, reason: 'SUBSCRIPTION_NOT_FOUND' } })
        }

        await activateSubscriptionFromProviderSnapshot(prisma, {
            userId,
            provider: subscription.paymentProvider,
            providerCustomerId: subscription.providerCustomerId,
            providerSubscriptionId,
            currentPeriodStart,
            currentPeriodEnd
        })

        return NextResponse.json({ data: { synced: true } })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al sincronizar checkout:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'No se pudo sincronizar el estado de la suscripción.'
                }
            },
            { status: 500 }
        )
    }
}
