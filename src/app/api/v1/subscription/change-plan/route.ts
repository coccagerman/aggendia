import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId, scheduleSubscriptionPlanChange } from '@/data/repositories/subscription.repo'
import { getPlanById } from '@/data/repositories/subscription-plan.repo'
import { getPaymentProvider } from '@/lib/payments/provider-factory'
import { changePlanRequestSchema } from '../dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'
import { resolvePlanPriceId } from '@/lib/payments/plan-price-id'

/**
 * POST /api/v1/subscription/change-plan
 *
 * Schedules a downgrade plan change (e.g. Premium -> Base) without charging twice.
 * Current premium access is preserved until next renewal date.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await requireAuth()

        const body = await request.json()
        const parsed = changePlanRequestSchema.safeParse(body)
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

        if (subscription.status !== 'ACTIVE') {
            throw new AppError(
                SubscriptionErrorCodes.INVALID_STATUS_TRANSITION,
                'Solo podés cambiar de plan cuando la suscripción está activa.',
                400
            )
        }

        if (!subscription.planId) {
            throw new AppError(SubscriptionErrorCodes.PLAN_NOT_FOUND, 'No se encontró el plan actual.', 404)
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

        if (currentPlan.id === targetPlan.id) {
            throw new AppError(SubscriptionErrorCodes.SUBSCRIPTION_ALREADY_EXISTS, 'Ya tenés este plan activo.', 409)
        }

        if (subscription.scheduledPlanId === targetPlan.id) {
            throw new AppError(
                SubscriptionErrorCodes.SUBSCRIPTION_ALREADY_EXISTS,
                'Ya tenés este cambio de plan programado para la próxima renovación.',
                409
            )
        }

        if (targetPlan.priceCents >= currentPlan.priceCents) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'Para mejorar plan, usá el flujo de suscripción.',
                400
            )
        }

        if (!subscription.paymentProvider || !subscription.providerSubscriptionId || !subscription.currentPeriodEnd) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'No se pudo programar el cambio de plan para esta suscripción.',
                400
            )
        }

        const provider = getPaymentProvider(subscription.paymentProvider)
        const planPriceId = resolvePlanPriceId({
            planSlug: targetPlan.slug
        })

        await provider.changeSubscriptionPlan({
            providerSubscriptionId: subscription.providerSubscriptionId,
            newPlanPriceId: planPriceId
        })

        await scheduleSubscriptionPlanChange(prisma, subscription.id, {
            scheduledPlanId: targetPlan.id,
            scheduledPlanEffectiveAt: subscription.currentPeriodEnd
        })

        return NextResponse.json({
            data: {
                message: `Cambio a ${targetPlan.name} programado para la próxima renovación.`,
                effectiveAt: subscription.currentPeriodEnd.toISOString()
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al cambiar plan:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al programar el cambio de plan.'
                }
            },
            { status: 500 }
        )
    }
}
