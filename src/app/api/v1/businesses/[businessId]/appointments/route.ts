/**
 * POST /api/v1/businesses/:businessId/appointments
 * Creates a manual appointment (by admin/staff from the dashboard)
 *
 * @see docs/user-stories.md - US-7.3 Crear turnos manualmente desde la agenda
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { createManualAppointment } from '@/domain/appointments/manualBooking.service'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { createManualAppointmentSchema } from './dto'

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

type RouteContext = {
    params: Promise<{ businessId: string }>
}

/**
 * POST /api/v1/businesses/:businessId/appointments
 * Creates a manual appointment
 */
export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // 1. Auth: verify user is authenticated
        const { userId } = await requireAuth()

        // 2. Verify user has access to the business (multi-tenant)
        await requireBusinessAccess(userId, businessId)

        // 3. Parse and validate request body
        const body = await request.json()
        const validatedInput = createManualAppointmentSchema.parse(body)

        // 4. Clean up empty strings to null/undefined
        const cleanedInput = {
            businessId,
            serviceId: validatedInput.serviceId,
            resourceId: validatedInput.resourceId,
            startAt: validatedInput.startAt,
            customer: {
                fullName: validatedInput.customer.fullName.trim(),
                email: validatedInput.customer.email?.trim() || undefined,
                phone: validatedInput.customer.phone?.trim() || undefined
            },
            notes: validatedInput.notes?.trim() || undefined,
            createdByUserId: userId
        }

        // 5. Create appointment via domain service
        const appointment = await createManualAppointment(prisma, cleanedInput)

        // 6. Validate response schema
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
        console.error('Error in POST /api/v1/businesses/:businessId/appointments:', error)
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
