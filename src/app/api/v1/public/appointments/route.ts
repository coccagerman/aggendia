/**
 * POST /api/v1/public/appointments
 * Creates a public appointment (booking) from the public booking page
 *
 * @see docs/user-stories.md - US-5.4
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/data/prisma/prisma'
import { createPublicAppointment } from '@/domain/appointments/publicBooking.service'
import { AppError, ValidationErrorCodes, SystemErrorCodes } from '@/domain/common/errors'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

/**
 * Strip HTML tags from input to prevent XSS
 */
function stripHtmlTags(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}

/**
 * Request DTO schema for creating a public appointment
 */
const createPublicAppointmentSchema = z.object({
    slug: z.string().min(1, 'slug es requerido'),
    serviceId: z.string().uuid('serviceId debe ser un UUID válido'),
    resourceId: z.string().uuid('resourceId debe ser un UUID válido'),
    startAt: z.string().datetime({ message: 'startAt debe ser una fecha ISO 8601 válida' }),
    customer: z
        .object({
            fullName: z
                .string()
                .min(1, 'El nombre es requerido')
                .max(100, 'El nombre es muy largo')
                .transform(stripHtmlTags),
            email: z.string().email('Email inválido').optional().or(z.literal('')),
            phone: z.string().min(6, 'Teléfono muy corto').max(20, 'Teléfono muy largo').optional().or(z.literal(''))
        })
        .refine(c => (c.email && c.email.length > 0) || (c.phone && c.phone.length > 0), {
            message: 'Debe proporcionar email o teléfono'
        }),
    notes: z.string().max(500, 'Las notas son muy largas').transform(stripHtmlTags).optional()
})

/**
 * Response DTO schema
 */
const appointmentResponseSchema = z.object({
    data: z.object({
        appointmentId: z.string(),
        status: z.string(),
        startAt: z.string(),
        endAt: z.string(),
        service: z.object({
            id: z.string(),
            name: z.string()
        }),
        resource: z.object({
            id: z.string(),
            name: z.string()
        }),
        business: z.object({
            name: z.string(),
            timezone: z.string()
        }),
        customer: z.object({
            fullName: z.string()
        })
    })
})

export async function POST(request: NextRequest) {
    try {
        // Rate limit: 10 requests per 5 minutes per IP
        const ip = getClientIp(request)
        const rateLimitResult = checkRateLimit(ip, 10, 5 * 60 * 1000)
        if (!rateLimitResult.success) {
            const resetInSeconds = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            return NextResponse.json(
                {
                    error: {
                        code: SystemErrorCodes.RATE_LIMIT_EXCEEDED,
                        message: 'Demasiados intentos. Esperá unos minutos.'
                    }
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': resetInSeconds.toString(),
                        'X-RateLimit-Limit': '10',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
                    }
                }
            )
        }

        // Parse request body
        const body = await request.json()

        // Validate input
        const validatedInput = createPublicAppointmentSchema.parse(body)

        // Clean up empty strings to null/undefined
        const cleanedInput = {
            ...validatedInput,
            customer: {
                fullName: validatedInput.customer.fullName.trim(),
                email: validatedInput.customer.email?.trim() || undefined,
                phone: validatedInput.customer.phone?.trim() || undefined
            },
            notes: validatedInput.notes?.trim() || undefined
        }

        // Create appointment via domain service
        const appointment = await createPublicAppointment(prisma, cleanedInput)

        // Validate response schema
        const response = appointmentResponseSchema.parse({ data: appointment })

        return NextResponse.json(response, { status: 201 })
    } catch (error) {
        // Zod validation error
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Datos inválidos',
                        details: error.issues
                    }
                },
                { status: 400 }
            )
        }

        // Domain/App error
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Unexpected error
        console.error('Error in POST /api/v1/public/appointments:', error)
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error interno del servidor'
                }
            },
            { status: 500 }
        )
    }
}
