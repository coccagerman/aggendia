import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById, updateBusinessSettings } from '@/data/repositories/business.repo'
import { updateBusinessSettingsSchema } from './dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string }>
}

/**
 * GET /api/v1/businesses/:businessId
 * Obtiene los datos del negocio especificado.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado
        const { userId } = await requireAuth()

        // Verificar acceso al negocio
        await requireBusinessAccess(userId, businessId)

        // Obtener negocio
        const business = await getBusinessById(prisma, businessId)

        if (!business) {
            return NextResponse.json(
                {
                    error: {
                        code: 'BUSINESS_NOT_FOUND',
                        message: 'Negocio no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        return NextResponse.json({
            data: business
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener el negocio.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/v1/businesses/:businessId
 * Actualiza la configuración del negocio.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado
        const { userId } = await requireAuth()

        // Verificar acceso al negocio
        await requireBusinessAccess(userId, businessId)

        // Parse y validación del body
        const body = await request.json()
        const validationResult = updateBusinessSettingsSchema.safeParse(body)

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Datos inválidos.',
                        details: validationResult.error.flatten()
                    }
                },
                { status: 400 }
            )
        }

        const { resourceLabel, remindersEnabled, reminderOffsetsMinutes } = validationResult.data

        // Check if there's anything to update
        if (resourceLabel === undefined && remindersEnabled === undefined && reminderOffsetsMinutes === undefined) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'No hay campos para actualizar.'
                    }
                },
                { status: 400 }
            )
        }

        // Update business settings
        const updatedBusiness = await updateBusinessSettings(prisma, businessId, {
            resourceLabel,
            remindersEnabled,
            reminderOffsetsMinutes
        })

        return NextResponse.json({
            data: updatedBusiness
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al actualizar negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al actualizar el negocio.'
                }
            },
            { status: 500 }
        )
    }
}
