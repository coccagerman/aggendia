/**
 * POST /api/v1/public/appointments/:appointmentId/reschedule
 * Public reschedule of appointment by customer (token-based auth)
 *
 * Auth: secretToken in request body (capability URL pattern)
 *
 * @see docs/user-stories.md - Épica 11
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { rescheduleAppointment, RescheduleAppointmentDeps } from '@/domain/appointments/appointment.service'
import {
    getAppointmentByIdAndToken,
    getAppointmentForReschedule,
    createRescheduledAppointment,
    getAppointmentById
} from '@/data/repositories/appointment.repo'
import { getAvailabilityByResourceId } from '@/data/repositories/availability.repo'
import { getBlocksByResourceId } from '@/data/repositories/block.repo'
import {
    sendRescheduledEmail,
    sendRescheduledWhatsApp,
    sendBusinessRescheduledEmail,
    sendBusinessRescheduledWhatsApp
} from '@/domain/notifications/notification.service'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { publicRescheduleAppointmentSchema } from '../dto'

type RouteContext = {
    params: Promise<{ appointmentId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const { appointmentId } = await context.params

        // 1. Parse and validate body
        let body: unknown
        try {
            body = await request.json()
        } catch {
            return NextResponse.json(
                { error: { code: ValidationErrorCodes.VALIDATION_ERROR, message: 'JSON inválido.' } },
                { status: 400 }
            )
        }

        const validation = publicRescheduleAppointmentSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Datos inválidos.',
                        details: validation.error.flatten()
                    }
                },
                { status: 400 }
            )
        }

        const { token, newStartAt } = validation.data

        // 2. Validate token → get appointment (returns null if invalid → 404)
        const appointment = await getAppointmentByIdAndToken(prisma, appointmentId, token)
        if (!appointment) {
            return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Turno no encontrado' } }, { status: 404 })
        }

        const businessId = appointment.businessId
        const originalStartAt = appointment.startAt

        // 3. Build domain deps (same as dashboard reschedule, using businessId from token-validated appointment)
        const deps: RescheduleAppointmentDeps = {
            getAppointmentForReschedule: (bId: string, aptId: string) =>
                getAppointmentForReschedule(prisma, bId, aptId),
            getAvailabilityRules: (resourceId: string) => getAvailabilityByResourceId(prisma, resourceId),
            getBlocksByResourceId: (resourceId: string, from: Date, to: Date) =>
                getBlocksByResourceId(prisma, { resourceId, from, to }),
            createRescheduledAppointment: input => createRescheduledAppointment(prisma, input)
        }

        // 4. Call domain service (reuses same business logic as dashboard reschedule)
        const result = await rescheduleAppointment(deps, {
            businessId,
            appointmentId,
            newStartAt
        })

        // 5. Send rescheduled notifications (non-blocking)
        const newAppointment = await getAppointmentById(prisma, businessId, result.newAppointmentId)
        if (newAppointment) {
            sendRescheduledEmail(prisma, {
                appointmentId: newAppointment.id,
                createdAt: newAppointment.createdAt,
                business: {
                    id: appointment.business.id,
                    name: appointment.business.name,
                    timezone: appointment.business.timezone,
                    resourceLabel: appointment.business.resourceLabel,
                    address: appointment.business.address,
                    emailNotificationsEnabled: appointment.business.emailNotificationsEnabled
                },
                service: { id: newAppointment.service.id, name: newAppointment.service.name },
                resource: { id: newAppointment.resource.id, name: newAppointment.resource.name },
                customer: {
                    fullName: newAppointment.customer.fullName,
                    email: newAppointment.customer.email
                },
                originalStartAt,
                newStartAt: newAppointment.startAt
            }).catch(err => {
                console.error('[PublicReschedule] Error in sendRescheduledEmail:', {
                    appointmentId: newAppointment.id,
                    error: err instanceof Error ? err.message : 'Unknown'
                })
            })

            sendRescheduledWhatsApp(prisma, {
                appointmentId: newAppointment.id,
                createdAt: newAppointment.createdAt,
                business: {
                    id: appointment.business.id,
                    name: appointment.business.name,
                    timezone: appointment.business.timezone,
                    resourceLabel: appointment.business.resourceLabel,
                    whatsappNotificationsEnabled: appointment.business.whatsappNotificationsEnabled
                },
                service: { id: newAppointment.service.id, name: newAppointment.service.name },
                resource: { id: newAppointment.resource.id, name: newAppointment.resource.name },
                customer: {
                    fullName: newAppointment.customer.fullName,
                    phoneE164: newAppointment.customer.phoneE164
                },
                originalStartAt,
                newStartAt: newAppointment.startAt
            }).catch(err => {
                console.error('[PublicReschedule] Error in sendRescheduledWhatsApp:', {
                    appointmentId: newAppointment.id,
                    error: err instanceof Error ? err.message : 'Unknown'
                })
            })

            // Send business owner rescheduled notifications
            const businessOwnerConfig = {
                id: appointment.business.id,
                name: appointment.business.name,
                timezone: appointment.business.timezone,
                resourceLabel: appointment.business.resourceLabel,
                address: appointment.business.address,
                ownerEmail: appointment.business.ownerEmail,
                ownerPhoneE164: appointment.business.ownerPhoneE164,
                ownerEmailNotificationsEnabled: appointment.business.ownerEmailNotificationsEnabled,
                ownerWhatsappNotificationsEnabled: appointment.business.ownerWhatsappNotificationsEnabled
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
                console.error('[PublicReschedule] Error in sendBusinessRescheduledEmail:', {
                    appointmentId: newAppointment.id,
                    error: err instanceof Error ? err.message : 'Unknown'
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
                console.error('[PublicReschedule] Error in sendBusinessRescheduledWhatsApp:', {
                    appointmentId: newAppointment.id,
                    error: err instanceof Error ? err.message : 'Unknown'
                })
            })
        }

        return NextResponse.json({ data: result })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error(
            'Error in POST /api/v1/public/appointments/:id/reschedule:',
            error instanceof Error ? error.message : 'UNKNOWN'
        )
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al reprogramar el turno.' } },
            { status: 500 }
        )
    }
}
