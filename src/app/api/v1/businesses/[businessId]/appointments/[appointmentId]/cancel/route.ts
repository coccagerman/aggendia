/**
 * PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/cancel
 * Cancels an appointment
 *
 * @see docs/user-stories.md - US-6.2 Cancelar turno
 * @see docs/user-stories.md - US-10.4 Notificaciones de cancelación
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { cancelAppointment, CancelAppointmentDeps } from '@/domain/appointments/appointment.service'
import { getAppointmentById, updateAppointmentStatus } from '@/data/repositories/appointment.repo'
import { getBusinessById } from '@/data/repositories/business.repo'
import {
    sendCancellationEmail,
    sendCancellationWhatsApp,
    sendBusinessCancellationEmail,
    sendBusinessCancellationWhatsApp
} from '@/domain/notifications/notification.service'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { cancelAppointmentSchema } from './dto'
import { AppointmentStatus } from '@/domain/appointments/appointment.types'

/**
 * Create repository dependencies for cancelAppointment domain service
 * This bridges the domain (infrastructure-agnostic) with the data layer (Prisma)
 */
function createCancelAppointmentDeps(): CancelAppointmentDeps {
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
 * PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/cancel
 * Cancels an appointment
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, appointmentId } = await context.params

        // 1. Auth: verify user is authenticated
        const { userId } = await requireAuth()

        // 2. Verify user has access to the business (multi-tenant)
        await requireBusinessAccess(userId, businessId)

        // 3. Parse and validate request body (optional - body can be empty)
        let cancellationReason: string | undefined

        try {
            const body = await request.json()
            const validationResult = cancelAppointmentSchema.safeParse(body)

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

            cancellationReason = validationResult.data.cancellationReason
        } catch (parseError) {
            // SyntaxError means malformed JSON - return 400
            if (parseError instanceof SyntaxError) {
                // Check if this is truly malformed JSON or just empty body
                // Empty body in fetch throws "Unexpected end of JSON input"
                const isEmptyBody = parseError.message.includes('Unexpected end of JSON input')
                if (!isEmptyBody) {
                    return NextResponse.json(
                        {
                            error: {
                                code: ValidationErrorCodes.VALIDATION_ERROR,
                                message: 'El cuerpo de la solicitud no es JSON válido.'
                            }
                        },
                        { status: 400 }
                    )
                }
                // Empty body is valid - continue without cancellation reason
            } else {
                // Other errors (e.g., TypeError for no body) - continue without cancellation reason
            }
        }

        // 4. Call domain service to cancel appointment
        const deps = createCancelAppointmentDeps()
        const result = await cancelAppointment(deps, {
            businessId,
            appointmentId,
            cancellationReason
        })

        // 5. Send cancellation notifications (non-blocking, fire-and-forget)
        // Only send if this was an actual cancellation, not an idempotent response
        if (!result.wasAlreadyCancelled) {
            const appointment = await getAppointmentById(prisma, businessId, appointmentId)
            if (appointment) {
                const business = await getBusinessById(prisma, businessId)
                if (business) {
                    const cancelledAt = appointment.updatedAt

                    // Send cancellation email (creates PENDING record + sends immediately)
                    sendCancellationEmail(prisma, {
                        appointmentId: appointment.id,
                        cancelledAt,
                        business: {
                            id: business.id,
                            name: business.name,
                            timezone: business.timezone,
                            resourceLabel: business.resourceLabel,
                            address: business.address,
                            emailNotificationsEnabled: business.emailNotificationsEnabled
                        },
                        service: {
                            id: appointment.service.id,
                            name: appointment.service.name
                        },
                        resource: {
                            id: appointment.resource.id,
                            name: appointment.resource.name
                        },
                        customer: {
                            fullName: appointment.customer.fullName,
                            email: appointment.customer.email
                        },
                        startAt: appointment.startAt
                    }).catch(err => {
                        console.error('[Cancel] Unexpected error in sendCancellationEmail:', {
                            appointmentId: appointment.id,
                            error: err instanceof Error ? err.message : 'Unknown error'
                        })
                    })

                    // Send cancellation WhatsApp (creates PENDING record + sends immediately)
                    sendCancellationWhatsApp(prisma, {
                        appointmentId: appointment.id,
                        cancelledAt,
                        business: {
                            id: business.id,
                            name: business.name,
                            timezone: business.timezone,
                            resourceLabel: business.resourceLabel,
                            whatsappNotificationsEnabled: business.whatsappNotificationsEnabled
                        },
                        service: {
                            id: appointment.service.id,
                            name: appointment.service.name
                        },
                        resource: {
                            id: appointment.resource.id,
                            name: appointment.resource.name
                        },
                        customer: {
                            fullName: appointment.customer.fullName,
                            phoneE164: appointment.customer.phoneE164
                        },
                        startAt: appointment.startAt
                    }).catch(err => {
                        console.error('[Cancel] Unexpected error in sendCancellationWhatsApp:', {
                            appointmentId: appointment.id,
                            error: err instanceof Error ? err.message : 'Unknown error'
                        })
                    })

                    // Send business owner cancellation notifications
                    const businessOwnerConfig = {
                        id: business.id,
                        name: business.name,
                        timezone: business.timezone,
                        resourceLabel: business.resourceLabel,
                        ownerEmail: business.ownerEmail,
                        ownerPhoneE164: business.ownerPhoneE164,
                        ownerEmailNotificationsEnabled: business.ownerEmailNotificationsEnabled,
                        ownerWhatsappNotificationsEnabled: business.ownerWhatsappNotificationsEnabled
                    }

                    sendBusinessCancellationEmail(prisma, {
                        appointmentId: appointment.id,
                        cancelledAt,
                        business: businessOwnerConfig,
                        service: { id: appointment.service.id, name: appointment.service.name },
                        resource: { id: appointment.resource.id, name: appointment.resource.name },
                        customer: { fullName: appointment.customer.fullName },
                        startAt: appointment.startAt
                    }).catch(err => {
                        console.error('[Cancel] Unexpected error in sendBusinessCancellationEmail:', {
                            appointmentId: appointment.id,
                            error: err instanceof Error ? err.message : 'Unknown error'
                        })
                    })

                    sendBusinessCancellationWhatsApp(prisma, {
                        appointmentId: appointment.id,
                        cancelledAt,
                        business: businessOwnerConfig,
                        service: { id: appointment.service.id, name: appointment.service.name },
                        resource: { id: appointment.resource.id, name: appointment.resource.name },
                        customer: { fullName: appointment.customer.fullName },
                        startAt: appointment.startAt
                    }).catch(err => {
                        console.error('[Cancel] Unexpected error in sendBusinessCancellationWhatsApp:', {
                            appointmentId: appointment.id,
                            error: err instanceof Error ? err.message : 'Unknown error'
                        })
                    })
                }
            }
        }

        // 6. Return success response
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
        console.error('Error al cancelar turno:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al cancelar el turno.'
                }
            },
            { status: 500 }
        )
    }
}
