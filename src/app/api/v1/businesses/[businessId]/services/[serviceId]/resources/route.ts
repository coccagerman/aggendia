import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getServiceById } from '@/data/repositories/service.repo'
import {
    getResourcesByServiceId,
    setServiceResources,
    addResourceToService
} from '@/data/repositories/serviceResource.repo'
import { setServiceResourcesSchema, addServiceResourceSchema } from './dto'
import { AppError, ValidationErrorCodes, ServiceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; serviceId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/services/:serviceId/resources
 * Lista los recursos / prestadores asociados a un servicio (incluye todos los estados)
 */
export async function GET(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let serviceId: string | undefined
    try {
        ;({ businessId, serviceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el servicio existe
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

        // Obtener recursos / prestadores asociados
        const serviceResources = await getResourcesByServiceId(prisma, businessId, serviceId)

        // Mapear a formato de respuesta (incluir datos del recurso / prestador)
        const resources = serviceResources.map(sr => ({
            id: sr.id,
            resourceId: sr.resource.id,
            resourceName: sr.resource.name,
            resourceStatus: sr.resource.status,
            resourceType: sr.resource.type,
            createdAt: sr.createdAt
        }))

        return NextResponse.json({
            data: resources
        })
    } catch (error) {
        console.error(
            `Error al obtener recursos / prestadores del servicio [businessId=${businessId}, serviceId=${serviceId}]:`,
            error instanceof Error ? error.message : 'UNKNOWN'
        )

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al obtener recursos / prestadores del servicio.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/v1/businesses/:businessId/services/:serviceId/resources
 * Reemplaza todos los recursos / prestadores asociados al servicio (bulk update)
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let serviceId: string | undefined
    try {
        ;({ businessId, serviceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el servicio existe
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

        // Parse y validación del body
        const body = await request.json()
        const validationResult = setServiceResourcesSchema.safeParse(body)

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

        const { resourceIds } = validationResult.data

        // Actualizar recursos / prestadores
        await setServiceResources(prisma, businessId, serviceId, resourceIds)

        // Obtener los datos completos para la respuesta
        const updatedResources = await getResourcesByServiceId(prisma, businessId, serviceId)

        const resources = updatedResources.map(sr => ({
            id: sr.id,
            resourceId: sr.resource.id,
            resourceName: sr.resource.name,
            resourceStatus: sr.resource.status,
            resourceType: sr.resource.type,
            createdAt: sr.createdAt
        }))

        return NextResponse.json({
            data: resources,
            meta: {
                count: resources.length
            }
        })
    } catch (error) {
        console.error(
            `Error al actualizar recursos / prestadores del servicio [businessId=${businessId}, serviceId=${serviceId}]:`,
            error instanceof Error ? error.message : 'UNKNOWN'
        )

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al actualizar recursos / prestadores del servicio.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * POST /api/v1/businesses/:businessId/services/:serviceId/resources
 * Agrega un recurso / prestador al servicio
 */
export async function POST(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let serviceId: string | undefined
    try {
        ;({ businessId, serviceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Parse y validación del body
        const body = await request.json()
        const validationResult = addServiceResourceSchema.safeParse(body)

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

        const { resourceId } = validationResult.data

        // Agregar recurso / prestador
        const serviceResource = await addResourceToService(prisma, businessId, serviceId, resourceId)

        return NextResponse.json(
            {
                data: serviceResource
            },
            { status: 201 }
        )
    } catch (error) {
        console.error(
            `Error al agregar recurso / prestador al servicio [businessId=${businessId}, serviceId=${serviceId}]:`,
            error instanceof Error ? error.message : 'UNKNOWN'
        )

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al agregar recurso / prestador al servicio.'
                }
            },
            { status: 500 }
        )
    }
}
