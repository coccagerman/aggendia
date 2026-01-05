import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getResourceById } from '@/data/repositories/resource.repo'
import { getBlocksByResourceId, getOverlappingBlocks, createBlock } from '@/data/repositories/block.repo'
import { validateBlockRange, validateNoOverlap } from '@/domain/blocks/block.service'
import { createBlockSchema, listBlocksQuerySchema } from './dto'
import {
    AppError,
    ValidationErrorCodes,
    ResourceErrorCodes,
    BlockErrorCodes,
    SystemErrorCodes
} from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; resourceId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/resources/:resourceId/blocks
 * Lista los bloqueos de un recurso, con filtros opcionales de rango de fechas.
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

        // Parsear query params
        const searchParams = request.nextUrl.searchParams
        const queryResult = listBlocksQuerySchema.safeParse({
            from: searchParams.get('from') ?? undefined,
            to: searchParams.get('to') ?? undefined
        })

        if (!queryResult.success) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.INVALID_QUERY,
                        message: 'Parámetros de consulta inválidos.',
                        details: queryResult.error.flatten().fieldErrors
                    }
                },
                { status: 400 }
            )
        }

        const { from, to } = queryResult.data

        // Obtener bloqueos
        const blocks = await getBlocksByResourceId(prisma, {
            resourceId,
            from: from ? new Date(from) : undefined,
            to: to ? new Date(to) : undefined
        })

        return NextResponse.json({
            data: blocks.map(b => ({
                id: b.id,
                resourceId: b.resourceId,
                startAt: b.startAt.toISOString(),
                endAt: b.endAt.toISOString(),
                reason: b.reason,
                createdAt: b.createdAt.toISOString()
            }))
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al listar bloqueos:', {
            businessId,
            resourceId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: SystemErrorCodes.INTERNAL_ERROR,
                    message: 'Ocurrió un error al obtener los bloqueos.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * POST /api/v1/businesses/:businessId/resources/:resourceId/blocks
 * Crea un nuevo bloqueo para el recurso.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

        // Parsear body
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'El cuerpo de la solicitud debe ser JSON válido.'
                    }
                },
                { status: 400 }
            )
        }

        const result = createBlockSchema.safeParse(body)
        if (!result.success) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Datos de bloqueo inválidos.',
                        details: result.error.flatten().fieldErrors
                    }
                },
                { status: 400 }
            )
        }

        const { startAt: startAtStr, endAt: endAtStr, reason } = result.data
        const startAt = new Date(startAtStr)
        const endAt = new Date(endAtStr)

        // Validar rango (inicio < fin, duración válida)
        validateBlockRange(startAt, endAt)

        // Verificar que no haya solapamientos
        const overlappingBlocks = await getOverlappingBlocks(prisma, resourceId, startAt, endAt)
        validateNoOverlap(overlappingBlocks, startAt, endAt)

        // Crear bloqueo
        const block = await createBlock(prisma, {
            resourceId,
            startAt,
            endAt,
            reason
        })

        return NextResponse.json(
            {
                data: {
                    id: block.id,
                    resourceId: block.resourceId,
                    startAt: block.startAt.toISOString(),
                    endAt: block.endAt.toISOString(),
                    reason: block.reason,
                    createdAt: block.createdAt.toISOString()
                }
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Handle DB exclusion constraint violation (concurrent overlap)
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2004 = constraint violation, but EXCLUDE may also throw as generic DB error
            // Check error message for exclusion constraint name
            const errorMessage = error.message || ''
            if (
                error.code === 'P2004' ||
                errorMessage.includes('resource_block_no_overlap') ||
                errorMessage.includes('conflicting key value')
            ) {
                return NextResponse.json(
                    {
                        error: {
                            code: BlockErrorCodes.BLOCK_OVERLAP,
                            message: 'Ya existe un bloqueo en ese rango de tiempo.'
                        }
                    },
                    { status: 409 }
                )
            }
        }

        console.error('Error al crear bloqueo:', {
            businessId,
            resourceId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: SystemErrorCodes.INTERNAL_ERROR,
                    message: 'Ocurrió un error al crear el bloqueo.'
                }
            },
            { status: 500 }
        )
    }
}
