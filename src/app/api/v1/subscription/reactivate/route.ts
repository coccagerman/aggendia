import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { getPlanById } from '@/data/repositories/subscription-plan.repo'
import { getPaymentProvider } from '@/lib/payments/provider-factory'
import { reactivateSubscriptionRequestSchema } from '../dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'
import { reactivateCanceledSubscription } from '@/domain/subscriptions/subscription.service'
import { resolvePlanPriceId } from '@/lib/payments/plan-price-id'

/**
 * POST /api/v1/subscription/reactivate
 *
 * Reactivates a canceled subscription before period end.
 * If target plan is an upgrade, applies immediately with proration.
 * If target plan is a downgrade, schedules the change for next renewal.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await requireAuth()

        const body = await request.json()
        const parsed = reactivateSubscriptionRequestSchema.safeParse(body)
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

        const subscription = await getSubscriptionByUserId(prisma, userId)
        if (!subscription) {
            throw new AppError(SubscriptionErrorCodes.SUBSCRIPTION_NOT_FOUND, 'No se encontró la suscripción.', 404)
        }

        if (subscription.status !== 'CANCELED') {
            throw new AppError(
                SubscriptionErrorCodes.INVALID_STATUS_TRANSITION,
                'Solo podés reactivar una suscripción cancelada.',
                400
            )
        }

        if (!subscription.planId) {
            throw new AppError(SubscriptionErrorCodes.PLAN_NOT_FOUND, 'No se encontró el plan actual.', 404)
        }

        if (!subscription.paymentProvider || !subscription.providerSubscriptionId || !subscription.currentPeriodEnd) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'No se pudo reactivar esta suscripción. Iniciá una nueva suscripción.',
                400
            )
        }

        const [currentPlan, targetPlan] = await Promise.all([
            getPlanById(prisma, subscription.planId),
            getPlanById(prisma, planId)
        ])

        if (!currentPlan || !targetPlan || !targetPlan.isActive) {
            throw new AppError(
                SubscriptionErrorCodes.PLAN_NOT_FOUND,
                'El plan seleccionado no existe o no está activo.',
                404
            )
        }

        const provider = getPaymentProvider(subscription.paymentProvider)
        const isSamePlan = currentPlan.id === targetPlan.id
        const isUpgrade = targetPlan.priceCents > currentPlan.priceCents

        if (!isSamePlan) {
            const planPriceId = resolvePlanPriceId({
                planSlug: targetPlan.slug
            })

            await provider.changeSubscriptionPlan({
                providerSubscriptionId: subscription.providerSubscriptionId,
                newPlanPriceId: planPriceId,
                effective: isUpgrade ? 'immediate_prorated' : 'next_renewal'
            })
        }

        await provider.reactivateSubscription({
            providerSubscriptionId: subscription.providerSubscriptionId
        })

        await reactivateCanceledSubscription(prisma, {
            userId,
            planId: isUpgrade ? targetPlan.id : null,
            scheduledPlanId: !isSamePlan && !isUpgrade ? targetPlan.id : null,
            scheduledPlanEffectiveAt: !isSamePlan && !isUpgrade ? subscription.currentPeriodEnd : null
        })

        return NextResponse.json({
            data: {
                message: isSamePlan
                    ? 'Suscripción reactivada. Tu próximo cobro será en la fecha de renovación ya pagada.'
                    : isUpgrade
                      ? `Suscripción reactivada. Te cobramos ahora la diferencia proporcional para pasar a ${targetPlan.name}.`
                      : `Suscripción reactivada. Cambio a ${targetPlan.name} programado para la próxima renovación.`
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al reactivar suscripción:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al reactivar la suscripción.'
                }
            },
            { status: 500 }
        )
    }
}
