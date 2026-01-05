import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { createService, getServicesByBusinessId } from '@/data/repositories/service.repo'
import { validateCreateServiceInput } from '@/domain/services/service.service'
import { createServiceSchema } from './dto'
import { AppError, ValidationErrorCodes, ServiceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string }>
}

/**
 * POST /api/v1/businesses/:businessId/services
 * Crea un nuevo servicio para el negocio.
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Parse y validación del body
        const body = await request.json()
        const validationResult = createServiceSchema.safeParse(body)

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

        // Validación adicional del domain (duración múltiplo de 5, etc.)
        validateCreateServiceInput(input)

        // Crear servicio
        const service = await createService(prisma, businessId, input)

        return NextResponse.json(
            {
                data: service
            },
            { status: 201 }
        )
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

        console.error('Error al crear servicio:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al crear el servicio.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/v1/businesses/:businessId/services
 * Obtiene todos los servicios del negocio (admin view).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Obtener todos los servicios (activos e inactivos)
        const services = await getServicesByBusinessId(prisma, businessId)

        return NextResponse.json({
            data: services
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener servicios:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener los servicios.'
                }
            },
            { status: 500 }
        )
    }
}
