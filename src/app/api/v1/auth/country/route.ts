import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId, updateSubscriptionCountry } from '@/data/repositories/subscription.repo'
import { startTrial } from '@/domain/subscriptions/subscription.service'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { isSupportedCountryIso2, resolveTimezoneForCountry } from '@/lib/country'

const updateCountrySchema = z.object({
    countryIso2: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, 'País inválido'),
    timezone: z.string().trim().optional().nullable()
})

/**
 * POST /api/v1/auth/country
 *
 * Persiste o actualiza el país del usuario autenticado.
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await requireAuth()

        const body = await request.json()
        const parsed = updateCountrySchema.safeParse(body)

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

        const { countryIso2, timezone } = parsed.data

        if (!isSupportedCountryIso2(countryIso2)) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Seleccioná un país válido.'
                    }
                },
                { status: 400 }
            )
        }

        const timezoneResolution = resolveTimezoneForCountry(countryIso2, timezone)
        if (!timezoneResolution.timezone) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: timezoneResolution.requiresManualSelection
                            ? 'Debés seleccionar una zona horaria válida para tu país.'
                            : 'No se pudo resolver la zona horaria para el país seleccionado.'
                    }
                },
                { status: 400 }
            )
        }

        const existingSubscription = await getSubscriptionByUserId(prisma, userId)

        if (!existingSubscription) {
            await startTrial(
                prisma,
                userId,
                SUBSCRIPTION_DEFAULTS.DEFAULT_TRIAL_DAYS,
                'STANDARD',
                undefined,
                countryIso2,
                timezoneResolution.timezone
            )
        } else {
            await updateSubscriptionCountry(prisma, existingSubscription.id, {
                countryIso2,
                accountTimezone: timezoneResolution.timezone
            })
        }

        return NextResponse.json({
            data: {
                countryIso2,
                timezone: timezoneResolution.timezone,
                message: 'País actualizado correctamente.'
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al guardar país:', error instanceof Error ? error.message : 'UNKNOWN')

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'No se pudo guardar el país.'
                }
            },
            { status: 500 }
        )
    }
}
