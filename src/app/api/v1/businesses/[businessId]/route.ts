import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import {
    getBusinessById,
    updateBusinessSettings,
    updateBusiness,
    deleteBusiness,
    countFutureAppointments
} from '@/data/repositories/business.repo'
import { updateBusinessSettingsSchema, updateBusinessSchema } from './dto'
import { validateUpdateBusinessInput } from '@/domain/businesses/business.service'
import { AppError, BusinessErrorCodes, ValidationErrorCodes } from '@/domain/common/errors'

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
            data: {
                id: business.id,
                name: business.name,
                slug: business.slug,
                timezone: business.timezone,
                resourceLabel: business.resourceLabel,
                address: business.address,
                area: business.area,
                status: business.status,
                remindersEnabled: business.remindersEnabled,
                reminderOffsetsMinutes: business.reminderOffsetsMinutes,
                emailNotificationsEnabled: business.emailNotificationsEnabled,
                whatsappNotificationsEnabled: business.whatsappNotificationsEnabled
            }
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
 * Actualiza datos del negocio: campos core (name, timezone, address, area, status)
 * o configuración (resourceLabel, reminders, notifications).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        const body = await request.json()

        // Detectar si es update de campos core o settings
        const coreFields = ['name', 'timezone', 'address', 'area', 'status']
        const hasCoreFields = coreFields.some(f => f in body)

        if (hasCoreFields) {
            // Validar con schema de campos core
            const validationResult = updateBusinessSchema.safeParse(body)
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

            const input = validationResult.data
            validateUpdateBusinessInput(input)

            const updatedBusiness = await updateBusiness(prisma, businessId, input)
            return NextResponse.json({ data: updatedBusiness })
        }

        // Fallback: settings update (backward compatible)
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

        const {
            resourceLabel,
            remindersEnabled,
            reminderOffsetsMinutes,
            emailNotificationsEnabled,
            whatsappNotificationsEnabled
        } = validationResult.data

        if (
            resourceLabel === undefined &&
            remindersEnabled === undefined &&
            reminderOffsetsMinutes === undefined &&
            emailNotificationsEnabled === undefined &&
            whatsappNotificationsEnabled === undefined
        ) {
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

        const updatedBusiness = await updateBusinessSettings(prisma, businessId, {
            resourceLabel,
            remindersEnabled,
            reminderOffsetsMinutes,
            emailNotificationsEnabled,
            whatsappNotificationsEnabled
        })

        return NextResponse.json({ data: updatedBusiness })
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

/**
 * DELETE /api/v1/businesses/:businessId
 * Elimina un negocio (soft delete). Solo si no tiene turnos futuros.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el negocio existe
        const business = await getBusinessById(prisma, businessId)
        if (!business || business.status === 'DELETED') {
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

        // Verificar turnos futuros
        const futureCount = await countFutureAppointments(prisma, businessId)
        if (futureCount > 0) {
            return NextResponse.json(
                {
                    error: {
                        code: BusinessErrorCodes.BUSINESS_HAS_FUTURE_APPOINTMENTS,
                        message: `Este negocio tiene ${futureCount} turno${futureCount > 1 ? 's' : ''} futuro${futureCount > 1 ? 's' : ''}. Desactivalo en su lugar.`
                    }
                },
                { status: 409 }
            )
        }

        await deleteBusiness(prisma, businessId)

        return NextResponse.json({ data: { id: businessId } })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al eliminar negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al eliminar el negocio.'
                }
            },
            { status: 500 }
        )
    }
}
