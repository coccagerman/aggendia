import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getResourceById, updateResource, deleteResource } from '@/data/repositories/resource.repo'
import { validateUpdateResourceInput, canDeleteResource } from '@/domain/resources/resource.service'
import { updateResourceSchema } from '../dto'
import { AppError, ValidationErrorCodes, ResourceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; resourceId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/resources/:resourceId
 * Obtiene un recurso / prestador específico del negocio.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, resourceId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Obtener recurso / prestador
        const resource = await getResourceById(prisma, businessId, resourceId)

        if (!resource) {
            return NextResponse.json(
                {
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Recurso / prestador no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        return NextResponse.json({ data: resource }, { status: 200 })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener recurso / prestador:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener el recurso / prestador.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/v1/businesses/:businessId/resources/:resourceId
 * Actualiza un recurso / prestador del negocio.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, resourceId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Parse y validación del body
        const body = await request.json()
        const validationResult = updateResourceSchema.safeParse(body)

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
        validateUpdateResourceInput(input)

        // Actualizar recurso / prestador
        const resource = await updateResource(prisma, businessId, resourceId, input)

        return NextResponse.json({ data: resource }, { status: 200 })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Capturar colisión (P2002 unique constraint) y responder 409
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                {
                    error: {
                        code: 'RESOURCE_NAME_CONFLICT',
                        message: 'Ya existe un recurso / prestador con ese nombre en este negocio.',
                        details: { field: 'name' }
                    }
                },
                { status: 409 }
            )
        }

        console.error('Error al actualizar recurso / prestador:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al actualizar el recurso / prestador.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/v1/businesses/:businessId/resources/:resourceId
 * Elimina un recurso / prestador del negocio (soft delete).
 *
 * - Si el recurso / prestador tiene turnos futuros, retorna 409 con sugerencia de desactivar.
 * - Si no tiene turnos futuros, cambia status a DELETED.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, resourceId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el recurso / prestador existe y pertenece al negocio
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

        // Verificar si puede ser eliminado (sin turnos futuros)
        const { canDelete, futureAppointmentsCount } = canDeleteResource(resourceId)

        if (!canDelete) {
            return NextResponse.json(
                {
                    error: {
                        code: ResourceErrorCodes.RESOURCE_HAS_FUTURE_APPOINTMENTS,
                        message: 'No se puede eliminar porque tiene turnos futuros. Desactivá el recurso / prestador en su lugar.',
                        details: { futureAppointmentsCount }
                    }
                },
                { status: 409 }
            )
        }

        // Soft delete: cambiar status a DELETED
        await deleteResource(prisma, businessId, resourceId)

        return NextResponse.json({ data: { deleted: true } }, { status: 200 })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al eliminar recurso / prestador:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al eliminar el recurso / prestador.'
                }
            },
            { status: 500 }
        )
    }
}
