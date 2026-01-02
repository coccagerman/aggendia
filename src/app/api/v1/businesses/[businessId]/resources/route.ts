import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { createResource, getResourcesByBusinessId } from '@/data/repositories/resource.repo'
import { validateCreateResourceInput } from '@/domain/resources/resource.service'
import { createResourceSchema } from './dto'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'

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
