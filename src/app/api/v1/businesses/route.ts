import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner, getBusinessesByUserId, findBusinessBySlug } from '@/data/repositories/business.repo'
import { generateUniqueSlug, validateCreateBusinessInput } from '@/domain/businesses/business.service'
import { createBusinessRequestSchema } from './dto'
import { AppError, ValidationErrorCodes, BusinessErrorCodes } from '@/domain/common/errors'

/**
 * POST /api/v1/businesses
 * Crea un nuevo negocio asociado al usuario autenticado como OWNER.
 */
export async function POST(request: NextRequest) {
    try {
        // Auth: obtener usuario autenticado
        const { userId } = await requireAuth()

        // Parse y validación del body
        const body = await request.json()
        const validationResult = createBusinessRequestSchema.safeParse(body)

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
        validateCreateBusinessInput(input)

        // Generar slug único
        const slug = await generateUniqueSlug(input.name, async candidateSlug => {
            const existing = await findBusinessBySlug(prisma, candidateSlug)
            return existing !== null
        })

        // Crear business + member en transacción
        const result = await createBusinessWithOwner(prisma, input, slug, userId)

        return NextResponse.json(
            {
                data: result.business
            },
            { status: 201 }
        )
    } catch (error) {
        // Si es AppError, usar su estructura
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Capturar colisión de slug (P2002 unique constraint)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = error.meta?.target as string[] | undefined
            if (target?.includes('slug')) {
                return NextResponse.json(
                    {
                        error: {
                            code: BusinessErrorCodes.BUSINESS_SLUG_CONFLICT,
                            message: 'Ya existe un negocio con ese nombre. Intentá con otro nombre.',
                            details: { field: 'slug' }
                        }
                    },
                    { status: 409 }
                )
            }
        }

        // Error inesperado
        console.error('Error al crear negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al crear el negocio. Intentá de nuevo más tarde.'
                }
            },
            { status: 500 }
        )
    }
}

/**
 * GET /api/v1/businesses
 * Devuelve todos los negocios del usuario autenticado.
 */
export async function GET() {
    try {
        // Auth: obtener usuario autenticado
        const { userId } = await requireAuth()

        // Obtener negocios del usuario
        const businesses = await getBusinessesByUserId(prisma, userId)

        return NextResponse.json({
            data: businesses
        })
    } catch (error) {
        // Si es AppError, usar su estructura
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Error inesperado
        console.error('Error al obtener negocios:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al obtener los negocios. Intentá de nuevo más tarde.'
                }
            },
            { status: 500 }
        )
    }
}
