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
        const subscription = await getSubscriptionByUserId(prisma, userId)
        if (subscription?.status === 'ACTIVE') {
            throw new AppError(
                SubscriptionErrorCodes.SUBSCRIPTION_ALREADY_EXISTS,
                'Ya tenés una suscripción activa.',
                409
            )
        }

        const provider = getPaymentProvider('STRIPE')

        // Create or reuse Stripe customer
        let providerCustomerId = subscription?.providerCustomerId
        if (!providerCustomerId) {
            const customer = await provider.createCustomer({
                email,
                businessId: userId, // Use userId as the "business" identifier in Stripe metadata
                businessName: email
            })
            providerCustomerId = customer.providerCustomerId

            // Store the customer ID on the subscription
            if (subscription) {
                await prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { providerCustomerId, paymentProvider: 'STRIPE' }
                })
            }
        }

        // Create Checkout Session
        const stripePriceId = process.env.STRIPE_PRICE_ID || plan.slug
        const session = await provider.createCheckoutSession({
            providerCustomerId,
            planPriceId: stripePriceId,
            businessId: userId, // metadata — userId stored as businessId in Stripe for now
            successUrl: `${APP_URL}/dashboard/subscription?checkout=success`,
            cancelUrl: `${APP_URL}/dashboard/subscription?checkout=canceled`
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
