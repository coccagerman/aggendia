import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getResourceById } from '@/data/repositories/resource.repo'
import { getAvailabilityByResourceId, setAvailability } from '@/data/repositories/availability.repo'
import { validateAndNormalizeRanges } from '@/domain/availability/availability.service'
import { AvailabilityRangeInput } from '@/domain/availability/availability.types'
import { setAvailabilitySchema } from './dto'
import { AppError, ValidationErrorCodes, ResourceErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; resourceId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/resources/:resourceId/availability
 * Obtiene la disponibilidad semanal de un recurso.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let resourceId: string | undefined
    try {
        ;({ businessId, resourceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el recurso existe y pertenece al negocio
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

        // Obtener availability rules
        const rules = await getAvailabilityByResourceId(prisma, resourceId)

        return NextResponse.json({
            data: {
                resourceId,
                ranges: rules.map(r => ({
                    id: r.id,
                    dayOfWeek: r.dayOfWeek,
                    startMinutes: r.startMinutes,
                    endMinutes: r.endMinutes
                }))
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al obtener disponibilidad:', {
            businessId,
            resourceId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener la disponibilidad.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/v1/businesses/:businessId/resources/:resourceId/availability
 * Reemplaza la disponibilidad semanal de un recurso.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let resourceId: string | undefined
    try {
        ;({ businessId, resourceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el recurso existe y pertenece al negocio
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

        // Parse y validación del body
        const body = await request.json()
        const validationResult = setAvailabilitySchema.safeParse(body)

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

        // Domain validation (overlaps, max per day, etc.)
        const normalizedRanges = validateAndNormalizeRanges(input.ranges as AvailabilityRangeInput[])

        // Persist
        const rules = await setAvailability(prisma, resourceId, normalizedRanges)

        return NextResponse.json({
            data: {
                resourceId,
                ranges: rules.map(r => ({
                    id: r.id,
                    dayOfWeek: r.dayOfWeek,
                    startMinutes: r.startMinutes,
                    endMinutes: r.endMinutes
                }))
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al guardar disponibilidad:', {
            businessId,
            resourceId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al guardar la disponibilidad.'
                }
            },
            { status: 500 }
        )
    }
}
