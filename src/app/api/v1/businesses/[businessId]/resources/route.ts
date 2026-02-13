import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import {
    createResource,
    getResourcesByBusinessId,
    getResourceById,
    updateResource,
    deleteResource
} from '@/data/repositories/resource.repo'
import {
    canDeleteResource,
    validateCreateResourceInput,
    validateUpdateResourceInput
} from '@/domain/resources/resource.service'
import { createResourceSchema, patchResourceByIdSchema, deleteResourceByIdSchema } from './dto'
import { AppError, ValidationErrorCodes, ResourceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string }>
}

/**
 * POST /api/v1/businesses/:businessId/resources
 * Crea un nuevo recurso para el negocio.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Parse y validación del body
        const body = await request.json()
        const validationResult = createResourceSchema.safeParse(body)

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

        // Validación adicional del domain
        validateCreateResourceInput(input)

        // Crear recurso
        const resource = await createResource(prisma, businessId, input)

        return NextResponse.json(
            {
                data: resource
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Capturar colisión (P2002 unique constraint) y responder 409 sin loguear como error
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                {
                    error: {
                        code: 'RESOURCE_NAME_CONFLICT',
                        message: 'Ya existe un recurso con ese nombre en este negocio.',
                        details: { field: 'name' }
                    }
                },
                { status: 409 }
            )
        }

        console.error('Error al crear recurso:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al crear el recurso.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/v1/businesses/:businessId/resources
 * Obtiene todos los recursos del negocio.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Obtener recursos
        const resources = await getResourcesByBusinessId(prisma, businessId)

        return NextResponse.json({
            data: resources
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener recursos:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener los recursos.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/v1/businesses/:businessId/resources
 * Actualiza un recurso del negocio enviando { resourceId, ...campos } en body.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        const body = await request.json()
        const validationResult = patchResourceByIdSchema.safeParse(body)

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

        const { resourceId, ...input } = validationResult.data
        validateUpdateResourceInput(input)

        const resource = await updateResource(prisma, businessId, resourceId, input)
        return NextResponse.json({ data: resource }, { status: 200 })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                {
                    error: {
                        code: 'RESOURCE_NAME_CONFLICT',
                        message: 'Ya existe un recurso con ese nombre en este negocio.',
                        details: { field: 'name' }
                    }
                },
                { status: 409 }
            )
        }

        console.error('Error al actualizar recurso:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al actualizar el recurso.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/v1/businesses/:businessId/resources
 * Elimina un recurso del negocio enviando { resourceId } en body.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        const body = await request.json()
        const validationResult = deleteResourceByIdSchema.safeParse(body)

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
        const resource = await getResourceById(prisma, businessId, resourceId)

        if (!resource) {
            return NextResponse.json(
                {
                    error: {
                        code: ResourceErrorCodes.RESOURCE_NOT_FOUND,
                        message: 'Recurso no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        const { canDelete, futureAppointmentsCount } = canDeleteResource(resourceId)
        if (!canDelete) {
            return NextResponse.json(
                {
                    error: {
                        code: ResourceErrorCodes.RESOURCE_HAS_FUTURE_APPOINTMENTS,
                        message: 'No se puede eliminar porque tiene turnos futuros. Desactivá el recurso en su lugar.',
                        details: { futureAppointmentsCount }
                    }
                },
                { status: 409 }
            )
        }

        await deleteResource(prisma, businessId, resourceId)
        return NextResponse.json({ data: { deleted: true } }, { status: 200 })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al eliminar recurso:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al eliminar el recurso.'
                }
            },
            { status: 500 }
        )
    }
}
