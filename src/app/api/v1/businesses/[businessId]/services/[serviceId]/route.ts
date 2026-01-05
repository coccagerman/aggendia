import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getServiceById, updateService } from '@/data/repositories/service.repo'
import { updateServiceSchema } from '../dto'
import { AppError, ValidationErrorCodes, ServiceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; serviceId: string }>
}

/**
 * PATCH /api/v1/businesses/:businessId/services/:serviceId
 * Actualiza un servicio existente.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let serviceId: string | undefined
    try {
        ;({ businessId, serviceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el servicio existe y pertenece al negocio
        const existingService = await getServiceById(prisma, businessId, serviceId)
        if (!existingService) {
            return NextResponse.json(
                {
                    error: {
                        code: ServiceErrorCodes.SERVICE_NOT_FOUND,
                        message: 'Servicio no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        // Parse y validación del body
        const body = await request.json()
        const validationResult = updateServiceSchema.safeParse(body)

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

        // Verificar que hay al menos un campo para actualizar
        if (Object.keys(input).length === 0) {
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

        // Actualizar servicio
        const service = await updateService(prisma, businessId, serviceId, input)

        return NextResponse.json({
            data: service
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Capturar colisión (P2002 unique constraint) y responder 409
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                {
                    error: {
                        code: ServiceErrorCodes.SERVICE_NAME_CONFLICT,
                        message: 'Ya existe un servicio con ese nombre en este negocio.',
                        details: { field: 'name' }
                    }
                },
                { status: 409 }
            )
        }

        console.error('Error al actualizar servicio:', {
            businessId,
            serviceId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al actualizar el servicio.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/v1/businesses/:businessId/services/:serviceId
 * Obtiene un servicio por ID.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let serviceId: string | undefined
    try {
        ;({ businessId, serviceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Obtener servicio
        const service = await getServiceById(prisma, businessId, serviceId)

        if (!service) {
            return NextResponse.json(
                {
                    error: {
                        code: ServiceErrorCodes.SERVICE_NOT_FOUND,
                        message: 'Servicio no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        return NextResponse.json({
            data: service
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener servicio:', {
            businessId,
            serviceId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener el servicio.'
                }
            },
            { status: 500 }
        )
    }
}
