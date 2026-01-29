'use client'

import { useMemo } from 'react'
import { formatAppointmentTime } from '@/lib/format'
import { statusConfig, filterAppointmentsByStatus } from '@/lib/appointments'
import { AppointmentStatus } from '@prisma/client'
import { Calendar, Clock, User } from 'lucide-react'
import { CancelAppointmentDialog } from './cancel-appointment-dialog'
import { RescheduleAppointmentDialog } from './reschedule-appointment-dialog'
import { CompleteAppointmentDialog } from './complete-appointment-dialog'

/**
 * Appointment data received from Server Component.
 * Dates are serialized to ISO strings when passed across the RSC boundary.
 */
interface AppointmentData {
    id: string
    status: AppointmentStatus
    startAt: string | Date
    endAt: string | Date
    /** End time including buffer - used to determine if appointment can be completed */
    occupiedEndAt: string | Date
    service: {
        id: string
        name: string
    }
    resource: {
        id: string
        name: string
    }
    customer: {
        id: string
        fullName: string
        email: string | null
        phone: string | null
    }
}

interface AppointmentListProps {
    appointments: AppointmentData[]
    timezone: string
    resourceLabel: string
    businessId: string
    /** Business slug for fetching available slots */
    slug: string
    /** Active status filters - if provided, appointments will be filtered client-side */
    activeStatuses?: AppointmentStatus[]
}

export function AppointmentList({
    appointments,
    timezone,
    resourceLabel,
    businessId,
    slug,
    activeStatuses
}: AppointmentListProps) {
    // Filter appointments by status (memoized)
    const filteredAppointments = useMemo(() => {
        if (!activeStatuses || activeStatuses.length === 0) {
            return appointments
        }
        return filterAppointmentsByStatus(appointments, activeStatuses)
    }, [appointments, activeStatuses])

    if (filteredAppointments.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
                <div className='rounded-full bg-zinc-100 p-3 dark:bg-zinc-800'>
                    <Calendar className='h-6 w-6 text-zinc-400' />
                </div>
                <p className='mt-4 text-sm text-zinc-500 dark:text-zinc-400'>No hay turnos agendados para este día</p>
            </div>
        )
    }

    // Check if appointment can be cancelled or rescheduled (SCHEDULED or RESCHEDULED)
    const canModify = (status: AppointmentStatus) => status === 'SCHEDULED' || status === 'RESCHEDULED'

    // Check if appointment can be marked as completed (SCHEDULED or RESCHEDULED and already finished)
    const canComplete = (status: AppointmentStatus, occupiedEndAt: Date) =>
        canModify(status) && occupiedEndAt <= new Date()

    return (
        <div className='divide-y divide-zinc-200 dark:divide-zinc-800'>
            {filteredAppointments.map(appointment => {
                const status = statusConfig[appointment.status]
                // Convert serialized dates back to Date objects (RSC boundary serializes Date -> string)
                const startAt = new Date(appointment.startAt)
                const endAt = new Date(appointment.endAt)
                const occupiedEndAt = new Date(appointment.occupiedEndAt)
                const timeRange = formatAppointmentTime(startAt, endAt, timezone)

                return (
                    <div
                        key={appointment.id}
                        className='flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'
                    >
                        {/* Left side: Time and service info */}
                        <div className='flex-1 space-y-1'>
                            <div className='flex items-center gap-2'>
                                <Clock className='h-4 w-4 text-zinc-400' />
                                <span className='font-medium text-zinc-900 dark:text-zinc-100'>{timeRange}</span>
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                                >
                                    {status.label}
                                </span>
                            </div>

                            <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400'>
                                <span className='font-medium'>{appointment.service.name}</span>
                                <span>
                                    {resourceLabel}: {appointment.resource.name}
                                </span>
                            </div>
                        </div>

                        {/* Right side: Customer info and actions */}
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'>
                                <User className='h-4 w-4' />
                                <span>{appointment.customer.fullName}</span>
                            </div>

                            {/* Action buttons - only for SCHEDULED or RESCHEDULED */}
                            {canModify(appointment.status) && (
                                <div className='flex items-center gap-1'>
                                    <RescheduleAppointmentDialog
                                        appointmentId={appointment.id}
                                        businessId={businessId}
                                        slug={slug}
                                        serviceId={appointment.service.id}
                                        resourceId={appointment.resource.id}
                                        customerName={appointment.customer.fullName}
                                        serviceName={appointment.service.name}
                                        resourceName={appointment.resource.name}
                                        currentTimeRange={timeRange}
                                        timezone={timezone}
                                    />
                                    {/* Complete button - only for finished appointments */}
                                    {canComplete(appointment.status, occupiedEndAt) && (
                                        <CompleteAppointmentDialog
                                            appointmentId={appointment.id}
                                            businessId={businessId}
                                            customerName={appointment.customer.fullName}
                                            serviceName={appointment.service.name}
                                            timeRange={timeRange}
                                        />
                                    )}
                                    <CancelAppointmentDialog
                                        appointmentId={appointment.id}
                                        businessId={businessId}
                                        customerName={appointment.customer.fullName}
                                        serviceName={appointment.service.name}
                                        timeRange={timeRange}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
