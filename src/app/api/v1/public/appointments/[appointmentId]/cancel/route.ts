/**
 * POST /api/v1/public/appointments/:appointmentId/cancel
 * Public cancellation of appointment by customer (token-based auth)
 *
 * Auth: secretToken in request body (capability URL pattern)
 *
 * @see docs/user-stories.md - Épica 11
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { cancelAppointment, CancelAppointmentDeps } from '@/domain/appointments/appointment.service'
import { getAppointmentByIdAndToken, updateAppointmentStatus } from '@/data/repositories/appointment.repo'
import {
    sendCancellationEmail,
    sendCancellationWhatsApp,
    sendBusinessCancellationEmail,
    sendBusinessCancellationWhatsApp
} from '@/domain/notifications/notification.service'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { publicCancelAppointmentSchema } from '../dto'
import { AppointmentStatus } from '@/domain/appointments/appointment.types'

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

        const validation = publicCancelAppointmentSchema.safeParse(body)
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

        const { token } = validation.data

        // 2. Validate token → get appointment (returns null if token invalid → 404)
        const appointment = await getAppointmentByIdAndToken(prisma, appointmentId, token)
        if (!appointment) {
            return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Turno no encontrado' } }, { status: 404 })
        }

        // 3. Call domain service (reuses same business logic as dashboard cancel)
        const deps: CancelAppointmentDeps = {
            getAppointmentById: async (businessId: string, aptId: string) => {
                // We already validated via token, so we trust the businessId
                if (aptId !== appointmentId) return null
                return {
                    id: appointment.id,
                    status: appointment.status as AppointmentStatus,
                    cancellationReason: appointment.cancellationReason
                }
            },
            updateAppointmentStatus: (
                aptId: string,
                status: AppointmentStatus,
                reason: string | undefined,
                expected: AppointmentStatus[]
            ) => updateAppointmentStatus(prisma, aptId, status, reason, expected)
        }

        const result = await cancelAppointment(deps, {
            businessId: appointment.businessId,
            appointmentId,
            cancellationReason: undefined
        })

        // 4. Send cancellation notifications (non-blocking)
        if (!result.wasAlreadyCancelled) {
            const cancelledAt = new Date()

            sendCancellationEmail(prisma, {
                appointmentId: appointment.id,
                cancelledAt,
                business: {
                    id: appointment.business.id,
                    name: appointment.business.name,
                    timezone: appointment.business.timezone,
                    resourceLabel: appointment.business.resourceLabel,
                    address: appointment.business.address,
                    emailNotificationsEnabled: appointment.business.emailNotificationsEnabled
                },
                service: { id: appointment.service.id, name: appointment.service.name },
                resource: { id: appointment.resource.id, name: appointment.resource.name },
                customer: { fullName: appointment.customer.fullName, email: appointment.customer.email },
                startAt: appointment.startAt
            }).catch(err => {
                console.error('[PublicCancel] Error in sendCancellationEmail:', {
                    appointmentId,
                    error: err instanceof Error ? err.message : 'Unknown'
                })
            })

            sendCancellationWhatsApp(prisma, {
                appointmentId: appointment.id,
                cancelledAt,
                business: {
                    id: appointment.business.id,
                    name: appointment.business.name,
                    timezone: appointment.business.timezone,
                    resourceLabel: appointment.business.resourceLabel,
                    whatsappNotificationsEnabled: appointment.business.whatsappNotificationsEnabled
                },
                service: { id: appointment.service.id, name: appointment.service.name },
                resource: { id: appointment.resource.id, name: appointment.resource.name },
                customer: { fullName: appointment.customer.fullName, phoneE164: appointment.customer.phoneE164 },
                startAt: appointment.startAt
            }).catch(err => {
                console.error('[PublicCancel] Error in sendCancellationWhatsApp:', {
                    appointmentId,
                    error: err instanceof Error ? err.message : 'Unknown'
                })
            })

            // Send business owner cancellation notifications
            const businessOwnerConfig = {
                id: appointment.business.id,
                name: appointment.business.name,
                timezone: appointment.business.timezone,
                resourceLabel: appointment.business.resourceLabel,
                ownerEmail: appointment.business.ownerEmail,
                ownerPhoneE164: appointment.business.ownerPhoneE164,
                ownerEmailNotificationsEnabled: appointment.business.ownerEmailNotificationsEnabled,
                ownerWhatsappNotificationsEnabled: appointment.business.ownerWhatsappNotificationsEnabled
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
                console.error('[PublicCancel] Error in sendBusinessCancellationEmail:', {
                    appointmentId,
                    error: err instanceof Error ? err.message : 'Unknown'
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
                console.error('[PublicCancel] Error in sendBusinessCancellationWhatsApp:', {
                    appointmentId,
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
            'Error in POST /api/v1/public/appointments/:id/cancel:',
            error instanceof Error ? error.message : 'UNKNOWN'
        )
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al cancelar el turno.' } },
            { status: 500 }
        )
    }
}
