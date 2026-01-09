import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById, updateBusinessResourceLabel } from '@/data/repositories/business.repo'
import { updateBusinessSettingsSchema } from './dto'
import { AppError, ValidationErrorCodes, BusinessErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/settings
 * Devuelve configuraciones del negocio (resource_label).
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        const business = await getBusinessById(prisma, businessId)

        if (!business) {
            return NextResponse.json(
                {
                    error: {
                        code: BusinessErrorCodes.BUSINESS_NOT_FOUND,
                        message: 'Negocio no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        return NextResponse.json({
            data: {
                resource_label: business.resourceLabel
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener configuración del negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener la configuración.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/v1/businesses/:businessId/settings
 * Actualiza la configuración del negocio (resource_label).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

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

        const { resource_label } = validationResult.data

        if (resource_label === undefined) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Debe proporcionar al menos un campo para actualizar.'
                    }
                },
                { status: 400 }
            )
        }

        const updated = await updateBusinessResourceLabel(prisma, businessId, resource_label)

        return NextResponse.json({
            data: {
                resource_label: updated.resourceLabel
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error(
            'Error al actualizar configuración del negocio:',
            error instanceof Error ? error.message : 'UNKNOWN'
        )
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al actualizar la configuración.'
                }
            },
            { status: 500 }
        )
    }
}
