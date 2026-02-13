/**
 * GET /api/v1/subscription
 *
 * Returns the current subscription status for the authenticated user.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionStatus } from '@/domain/subscriptions/subscription.service'
import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

export async function GET() {
    try {
        const { userId } = await requireAuth()

        const subscription = await getSubscriptionStatus(prisma, userId)

        if (!subscription) {
            throw new AppError(
                SubscriptionErrorCodes.SUBSCRIPTION_NOT_FOUND,
                'No se encontró una suscripción para este usuario.',
                404
            )
        }

        return NextResponse.json({
            data: {
                id: subscription.id,
                status: subscription.status,
                trialStartsAt: subscription.trialStartsAt,
                trialEndsAt: subscription.trialEndsAt,
                trialType: subscription.trialType,
                currentPeriodStart: subscription.currentPeriodStart,
                currentPeriodEnd: subscription.currentPeriodEnd,
                cancelAt: subscription.cancelAt,
                canceledAt: subscription.canceledAt,
                paymentProvider: subscription.paymentProvider,
                createdAt: subscription.createdAt
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener suscripción:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al obtener la suscripción.' } },
            { status: 500 }
        )
    }
}
