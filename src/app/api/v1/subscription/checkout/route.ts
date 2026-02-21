/**
 * POST /api/v1/subscription/checkout
 *
 * Creates a Stripe Checkout Session for the authenticated user.
 * Returns a checkout URL that the client redirects to.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { getPlanById } from '@/data/repositories/subscription-plan.repo'
import { getPaymentProvider } from '@/lib/payments/provider-factory'
import { createCheckoutRequestSchema } from '../dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'
import { startTrial } from '@/domain/subscriptions/subscription.service'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'
import { resolvePaymentRouting } from '@/domain/subscriptions/payment-provider-selection'
import { resolvePlanPriceId } from '@/lib/payments/plan-price-id'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export async function POST(request: NextRequest) {
    try {
        const { userId, email } = await requireAuth()

        // Parse and validate body
        const body = await request.json()
        const parsed = createCheckoutRequestSchema.safeParse(body)
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

        const { planId } = parsed.data

        // Validate plan exists
        const plan = await getPlanById(prisma, planId)
        if (!plan || !plan.isActive) {
            throw new AppError(
                SubscriptionErrorCodes.PLAN_NOT_FOUND,
                'El plan seleccionado no existe o no está activo.',
                404
            )
        }

        // Check current subscription status — don't allow checkout if already ACTIVE
        let subscription = await getSubscriptionByUserId(prisma, userId)

        // Backfill-on-read: legacy users might not have a subscription row yet.
        // Create the same default trial used on signup/oauth so checkout can proceed.
        if (!subscription) {
            try {
                subscription = await startTrial(prisma, userId, SUBSCRIPTION_DEFAULTS.DEFAULT_TRIAL_DAYS, 'STANDARD')
            } catch (error) {
                // If another request created it concurrently, fetch and continue.
                subscription = await getSubscriptionByUserId(prisma, userId)
                if (!subscription) {
                    throw error
                }
            }
        }

        if (subscription?.status === 'ACTIVE' && subscription.planId === planId) {
            throw new AppError(SubscriptionErrorCodes.SUBSCRIPTION_ALREADY_EXISTS, 'Ya tenés este plan activo.', 409)
        }

        const countryIso2 = subscription.countryIso2

        if (!countryIso2) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                'Necesitamos que confirmes tu país antes de iniciar el checkout.',
                400
            )
        }

        const paymentRouting = resolvePaymentRouting(countryIso2)
        const planPriceId = resolvePlanPriceId({
            provider: paymentRouting.provider,
            planSlug: plan.slug,
            currency: paymentRouting.currency
        })

        const provider = getPaymentProvider(paymentRouting.provider)

        // Create or reuse Stripe customer
        let providerCustomerId = subscription.providerCustomerId
        if (!providerCustomerId) {
            const customer = await provider.createCustomer({
                email,
                businessId: userId, // user-level subscription: store userId in metadata
                businessName: email
            })
            providerCustomerId = customer.providerCustomerId
        }

        // Persist selected plan and provider info BEFORE checkout.
        // Webhooks can then activate reliably using the stored planId.
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                planId,
                countryIso2,
                providerCustomerId,
                paymentProvider: paymentRouting.provider
            }
        })

        const successUrl =
            paymentRouting.provider === 'STRIPE'
                ? `${APP_URL}/subscription?checkout=success&session_id={CHECKOUT_SESSION_ID}`
                : `${APP_URL}/subscription?checkout=success`

        const session = await provider.createCheckoutSession({
            providerCustomerId,
            planPriceId,
            businessId: userId,
            successUrl,
            cancelUrl: `${APP_URL}/subscription?checkout=canceled`
        })

        return NextResponse.json({
            data: {
                checkoutUrl: session.checkoutUrl,
                sessionId: session.sessionId
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al crear checkout:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al crear la sesión de pago.' } },
            { status: 500 }
        )
    }
}
