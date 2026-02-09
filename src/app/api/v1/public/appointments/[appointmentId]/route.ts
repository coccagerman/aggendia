/**
 * GET /api/v1/public/appointments/:appointmentId?token=...
 * Returns appointment details for customer self-service page
 *
 * Auth: token-based (capability URL pattern, no session required)
 *
 * @see docs/user-stories.md - Épica 11
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { getAppointmentByIdAndToken } from '@/data/repositories/appointment.repo'
import { formatDateTimeForNotification, getTimezoneDisplayName } from '@/lib/notifications/notification-time'

type RouteContext = {
    params: Promise<{ appointmentId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { appointmentId } = await context.params
        const token = request.nextUrl.searchParams.get('token')

        // Token is required
        if (!token) {
            return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Turno no encontrado' } }, { status: 404 })
        }

        // Lookup by ID + token (returns null if token doesn't match → 404)
        const appointment = await getAppointmentByIdAndToken(prisma, appointmentId, token)

        if (!appointment) {
            return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Turno no encontrado' } }, { status: 404 })
        }

        return NextResponse.json({
            data: {
                appointmentId: appointment.id,
                status: appointment.status,
                startAt: appointment.startAt.toISOString(),
                endAt: appointment.endAt.toISOString(),
                formattedDateTime: formatDateTimeForNotification(appointment.startAt, appointment.business.timezone),
                timezone: getTimezoneDisplayName(appointment.business.timezone),
                service: {
                    id: appointment.service.id,
                    name: appointment.service.name
                },
                resource: {
                    id: appointment.resource.id,
                    name: appointment.resource.name
                },
                business: {
                    name: appointment.business.name,
                    slug: appointment.business.slug,
                    timezone: appointment.business.timezone,
                    resourceLabel: appointment.business.resourceLabel,
                    address: appointment.business.address
                },
                customer: {
                    fullName: appointment.customer.fullName
                }
            }
        })
    } catch (error) {
        console.error(
            'Error in GET /api/v1/public/appointments/:id:',
            error instanceof Error ? error.message : 'UNKNOWN'
        )
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } },
            { status: 500 }
        )
    }
}
