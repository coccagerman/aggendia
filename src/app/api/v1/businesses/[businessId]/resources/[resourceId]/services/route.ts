import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getResourceById } from '@/data/repositories/resource.repo'
import { getServiceIdsByResourceId, setResourceServices } from '@/data/repositories/serviceResource.repo'
import { setResourceServicesSchema } from './dto'
import { AppError, ValidationErrorCodes, ResourceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; resourceId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/resources/:resourceId/services
 * Lista los IDs de servicios asociados a un recurso / prestador
 */
export async function GET(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let resourceId: string | undefined
    try {
        ;({ businessId, resourceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el recurso / prestador existe
        const resource = await getResourceById(prisma, businessId, resourceId)
        if (!resource) {
            return NextResponse.json(
                {
                    error: {
                        code: ResourceErrorCodes.RESOURCE_NOT_FOUND,
                        message: 'Recurso / prestador no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        // Obtener IDs de servicios asociados
        const serviceIds = await getServiceIdsByResourceId(prisma, businessId, resourceId)

        return NextResponse.json({
            data: { serviceIds }
        })
    } catch (error) {
        console.error(
            `Error al obtener servicios del recurso / prestador [businessId=${businessId}, resourceId=${resourceId}]:`,
            error instanceof Error ? error.message : 'UNKNOWN'
        )

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al obtener servicios del recurso / prestador.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/v1/businesses/:businessId/resources/:resourceId/services
 * Reemplaza todos los servicios asociados al recurso / prestador (bulk update)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let resourceId: string | undefined
    try {
        ;({ businessId, resourceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el recurso / prestador existe
        const resource = await getResourceById(prisma, businessId, resourceId)
        if (!resource) {
            return NextResponse.json(
                {
                    error: {
                        code: ResourceErrorCodes.RESOURCE_NOT_FOUND,
                        message: 'Recurso / prestador no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        // Parse y validación del body
        const body = await request.json()
        const validationResult = setResourceServicesSchema.safeParse(body)

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

        const { serviceIds } = validationResult.data

        // Actualizar servicios
        await setResourceServices(prisma, businessId, resourceId, serviceIds)

        // Obtener los IDs actualizados para la respuesta
        const updatedServiceIds = await getServiceIdsByResourceId(prisma, businessId, resourceId)

        return NextResponse.json({
            data: { serviceIds: updatedServiceIds },
            meta: {
                count: updatedServiceIds.length
            }
        })
    } catch (error) {
        console.error(
            `Error al actualizar servicios del recurso / prestador [businessId=${businessId}, resourceId=${resourceId}]:`,
            error instanceof Error ? error.message : 'UNKNOWN'
        )

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al actualizar servicios del recurso / prestador.'
                }
            },
            { status: 500 }
        )
    }
}
