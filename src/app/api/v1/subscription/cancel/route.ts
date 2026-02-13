/**
 * POST /api/v1/subscription/cancel
 *
 * Cancels the authenticated user's subscription.
 * Can be immediate or at period end (default).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { cancelSubscription } from '@/domain/subscriptions/subscription.service'
import { cancelSubscriptionRequestSchema } from '../dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'

export async function POST(request: NextRequest) {
    try {
        const { userId } = await requireAuth()

        const body = await request.json()
        const parsed = cancelSubscriptionRequestSchema.safeParse(body)
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

        await cancelSubscription(prisma, {
            userId,
            immediate: parsed.data.immediate
        })

        return NextResponse.json({
            data: { message: 'Suscripción cancelada exitosamente.' }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al cancelar suscripción:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al cancelar la suscripción.' } },
            { status: 500 }
        )
    }
}
