import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getResourceById, updateResource } from '@/data/repositories/resource.repo'
import { validateUpdateResourceInput } from '@/domain/resources/resource.service'
import { updateResourceSchema } from '../dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; resourceId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/resources/:resourceId
 * Obtiene un recurso específico del negocio.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, resourceId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Obtener recurso
        const resource = await getResourceById(prisma, businessId, resourceId)

        if (!resource) {
            return NextResponse.json(
                {
                    error: {
                        code: 'RESOURCE_NOT_FOUND',
                        message: 'Recurso no encontrado.'
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

        console.error('Error al obtener recurso:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener el recurso.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PATCH /api/v1/businesses/:businessId/resources/:resourceId
 * Actualiza un recurso del negocio.
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

        // Actualizar recurso
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
