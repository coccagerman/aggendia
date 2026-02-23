/**
 * PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule
 * Reschedules an appointment to a new time slot
 *
 * @see docs/user-stories.md - US-6.3 Reprogramar turno
 * @see docs/user-stories.md - US-10.4 Notificaciones de reprogramación
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { rescheduleAppointment, RescheduleAppointmentDeps } from '@/domain/appointments/appointment.service'
import {
    getAppointmentForReschedule,
    createRescheduledAppointment,
    getAppointmentById
} from '@/data/repositories/appointment.repo'
import { getAvailabilityByResourceId } from '@/data/repositories/availability.repo'
import { getBlocksByResourceId } from '@/data/repositories/block.repo'
import { getBusinessById } from '@/data/repositories/business.repo'
import {
    sendRescheduledEmail,
    sendRescheduledWhatsApp,
    sendBusinessRescheduledEmail,
    sendBusinessRescheduledWhatsApp
} from '@/domain/notifications/notification.service'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { rescheduleAppointmentSchema } from './dto'

/**
 * Create repository dependencies for rescheduleAppointment domain service
 * This bridges the domain (infrastructure-agnostic) with the data layer (Prisma)
 */
function createRescheduleAppointmentDeps(): RescheduleAppointmentDeps {
    return {
        getAppointmentForReschedule: (businessId: string, appointmentId: string) =>
            getAppointmentForReschedule(prisma, businessId, appointmentId),
        getAvailabilityRules: (resourceId: string) => getAvailabilityByResourceId(prisma, resourceId),
        getBlocksByResourceId: (resourceId: string, from: Date, to: Date) =>
            getBlocksByResourceId(prisma, { resourceId, from, to }),
        createRescheduledAppointment: input => createRescheduledAppointment(prisma, input)
    }
}

type RouteContext = {
    params: Promise<{ businessId: string; appointmentId: string }>
}

/**
 * PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule
 * Reschedules an appointment to a new time slot
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { businessId, appointmentId } = await context.params

        // 1. Auth: verify user is authenticated
        const { userId } = await requireAuth()

        // 2. Verify user has access to the business (multi-tenant)
        await requireBusinessAccess(userId, businessId)

        // 3. Parse and validate request body
        let body: unknown
        try {
            body = await request.json()
        } catch {
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

        const validationResult = rescheduleAppointmentSchema.safeParse(body)

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

        const { newStartAt } = validationResult.data

        // 4. Get original appointment data for notifications (before reschedule)
        const originalAppointment = await getAppointmentById(prisma, businessId, appointmentId)
        const originalStartAt = originalAppointment?.startAt

        // 5. Call domain service to reschedule appointment
        const deps = createRescheduleAppointmentDeps()
        const result = await rescheduleAppointment(deps, {
            businessId,
            appointmentId,
            newStartAt
        })

        // 6. Send rescheduled notifications (non-blocking, fire-and-forget)
        const newAppointment = await getAppointmentById(prisma, businessId, result.newAppointmentId)
        if (newAppointment && originalStartAt) {
            const business = await getBusinessById(prisma, businessId)
            if (business) {
                // Send rescheduled email (creates PENDING record + sends immediately)
                sendRescheduledEmail(prisma, {
                    appointmentId: newAppointment.id,
                    createdAt: newAppointment.createdAt,
                    business: {
                        id: business.id,
                        name: business.name,
                        timezone: business.timezone,
                        resourceLabel: business.resourceLabel,
                        address: business.address,
                        emailNotificationsEnabled: business.emailNotificationsEnabled
                    },
                    service: {
                        id: newAppointment.service.id,
                        name: newAppointment.service.name
                    },
                    resource: {
                        id: newAppointment.resource.id,
                        name: newAppointment.resource.name
                    },
                    customer: {
                        fullName: newAppointment.customer.fullName,
                        email: newAppointment.customer.email
                    },
                    originalStartAt,
                    newStartAt: newAppointment.startAt
                }).catch(err => {
                    console.error('[Reschedule] Unexpected error in sendRescheduledEmail:', {
                        appointmentId: newAppointment.id,
                        error: err instanceof Error ? err.message : 'Unknown error'
                    })
                })

                // Send rescheduled WhatsApp (creates PENDING record + sends immediately)
                sendRescheduledWhatsApp(prisma, {
                    appointmentId: newAppointment.id,
                    createdAt: newAppointment.createdAt,
                    business: {
                        id: business.id,
                        name: business.name,
                        timezone: business.timezone,
                        resourceLabel: business.resourceLabel,
                        whatsappNotificationsEnabled: business.whatsappNotificationsEnabled
                    },
                    service: {
                        id: newAppointment.service.id,
                        name: newAppointment.service.name
                    },
                    resource: {
                        id: newAppointment.resource.id,
                        name: newAppointment.resource.name
                    },
                    customer: {
                        fullName: newAppointment.customer.fullName,
                        phoneE164: newAppointment.customer.phoneE164
                    },
                    originalStartAt,
                    newStartAt: newAppointment.startAt
                }).catch(err => {
                    console.error('[Reschedule] Unexpected error in sendRescheduledWhatsApp:', {
                        appointmentId: newAppointment.id,
                        error: err instanceof Error ? err.message : 'Unknown error'
                    })
                })

                // Send business owner rescheduled notifications
                const businessOwnerConfig = {
                    id: business.id,
                    name: business.name,
                    timezone: business.timezone,
                    resourceLabel: business.resourceLabel,
                    address: business.address,
                    ownerEmail: business.ownerEmail,
                    ownerPhoneE164: business.ownerPhoneE164,
                    ownerEmailNotificationsEnabled: business.ownerEmailNotificationsEnabled,
                    ownerWhatsappNotificationsEnabled: business.ownerWhatsappNotificationsEnabled
                }

                sendBusinessRescheduledEmail(prisma, {
                    appointmentId: newAppointment.id,
                    createdAt: newAppointment.createdAt,
                    business: businessOwnerConfig,
                    service: { id: newAppointment.service.id, name: newAppointment.service.name },
                    resource: { id: newAppointment.resource.id, name: newAppointment.resource.name },
                    customer: { fullName: newAppointment.customer.fullName },
                    originalStartAt,
                    newStartAt: newAppointment.startAt
                }).catch(err => {
                    console.error('[Reschedule] Unexpected error in sendBusinessRescheduledEmail:', {
                        appointmentId: newAppointment.id,
                        error: err instanceof Error ? err.message : 'Unknown error'
                    })
                })

                sendBusinessRescheduledWhatsApp(prisma, {
                    appointmentId: newAppointment.id,
                    createdAt: newAppointment.createdAt,
                    business: businessOwnerConfig,
                    service: { id: newAppointment.service.id, name: newAppointment.service.name },
                    resource: { id: newAppointment.resource.id, name: newAppointment.resource.name },
                    customer: { fullName: newAppointment.customer.fullName },
                    originalStartAt,
                    newStartAt: newAppointment.startAt
                }).catch(err => {
                    console.error('[Reschedule] Unexpected error in sendBusinessRescheduledWhatsApp:', {
                        appointmentId: newAppointment.id,
                        error: err instanceof Error ? err.message : 'Unknown error'
                    })
                })
            }
        }

        // 7. Return success response
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
        console.error('Error al reprogramar turno:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al reprogramar el turno.'
                }
            },
            { status: 500 }
        )
    }
}
