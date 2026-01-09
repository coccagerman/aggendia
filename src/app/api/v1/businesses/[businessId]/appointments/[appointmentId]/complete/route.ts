/**
 * PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/complete
 * Marks an appointment as completed
 *
 * @see docs/user-stories.md - US-6.4 Marcar completado
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { markAppointmentAsCompleted, CompleteAppointmentDeps } from '@/domain/appointments/appointment.service'
import { getAppointmentById, updateAppointmentStatus } from '@/data/repositories/appointment.repo'
import { AppError } from '@/domain/common/errors'
import { AppointmentStatus } from '@/domain/appointments/appointment.types'
import { completeAppointmentSchema } from './dto'

/**
 * Create repository dependencies for markAppointmentAsCompleted domain service
 * This bridges the domain (infrastructure-agnostic) with the data layer (Prisma)
 */
function createCompleteAppointmentDeps(): CompleteAppointmentDeps {
    return {
        getAppointmentById: (businessId: string, appointmentId: string) =>
            getAppointmentById(prisma, businessId, appointmentId),
        updateAppointmentStatus: (
            appointmentId: string,
            status: AppointmentStatus,
            cancellationReason: string | undefined,
            expectedStatuses: AppointmentStatus[]
        ) => updateAppointmentStatus(prisma, appointmentId, status, cancellationReason, expectedStatuses)
    }
}

type RouteContext = {
    params: Promise<{ businessId: string; appointmentId: string }>
}

/**
 * PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/complete
 * Marks an appointment as completed
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, appointmentId } = await context.params

        // 1. Auth: verify user is authenticated
        const { userId } = await requireAuth()

        // 2. Verify user has access to the business (multi-tenant)
        await requireBusinessAccess(userId, businessId)

        // 3. Validate request body (must be empty or {})
        // Always read body to avoid depending on Content-Length header (could be omitted with chunked encoding)
        const rawBody = await request.text()
        if (rawBody.length > 0) {
            // Try to parse as JSON - if malformed, return 400
            let body: unknown
            try {
                body = JSON.parse(rawBody)
            } catch {
                return NextResponse.json(
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'El cuerpo de la petición contiene JSON inválido'
                        }
                    },
                    { status: 400 }
                )
            }

            // Validate with DTO schema (must be empty object {})
            const parsed = completeAppointmentSchema.safeParse(body)
            if (!parsed.success) {
                return NextResponse.json(
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'El cuerpo de la petición debe estar vacío',
                            details: parsed.error.flatten().fieldErrors
                        }
                    },
                    { status: 400 }
                )
            }
        }

        // 4. Call domain service to mark appointment as completed
        // Pass current time for validation (cannot complete in-progress or future appointments)
        const deps = createCompleteAppointmentDeps()
        const result = await markAppointmentAsCompleted(deps, {
            businessId,
            appointmentId,
            currentTime: new Date()
        })

        // 5. Return success response
        return NextResponse.json({ data: result })
    } catch (error) {
        // Handle known domain errors (AppError)
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        // Handle errors with httpStatus and toJSON (e.g., from auth middleware)
        if (
            error &&
            typeof error === 'object' &&
            'httpStatus' in error &&
            'toJSON' in error &&
            typeof (error as { toJSON: () => unknown }).toJSON === 'function'
        ) {
            const typedError = error as { httpStatus: number; toJSON: () => unknown }
            return NextResponse.json(typedError.toJSON(), { status: typedError.httpStatus })
        }

        // Log and return generic error
        console.error('Error al marcar turno como completado:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al marcar el turno como completado.'
                }
            },
            { status: 500 }
        )
    }
}
