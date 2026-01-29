'use client'

import { useMemo } from 'react'
import { Calendar, Clock, User } from 'lucide-react'
import { formatAppointmentTime, formatShortDate } from '@/lib/format'
import { statusConfig, filterAppointmentsByStatus } from '@/lib/appointments'
import { AppointmentStatus } from '@prisma/client'
import { CancelAppointmentDialog } from './cancel-appointment-dialog'
import { RescheduleAppointmentDialog } from './reschedule-appointment-dialog'
import { CompleteAppointmentDialog } from './complete-appointment-dialog'

/**
 * Appointment data for week view
 */
interface AppointmentData {
    id: string
    status: AppointmentStatus
    startAt: string | Date
    endAt: string | Date
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

interface WeekViewProps {
    /** Array of 7 date strings (YYYY-MM-DD) from Monday to Sunday */
    weekDays: string[]
    /** Appointments grouped by date string */
    appointmentsByDay: Record<string, AppointmentData[]>
    timezone: string
    resourceLabel: string
    businessId: string
    slug: string
    /** Active status filters - if provided, appointments will be filtered client-side */
    activeStatuses?: AppointmentStatus[]
}

export function WeekView({
    weekDays,
    appointmentsByDay,
    timezone,
    resourceLabel,
    businessId,
    slug,
    activeStatuses
}: WeekViewProps) {
    // Filter appointments by status for each day (memoized)
    const filteredAppointmentsByDay = useMemo(() => {
        if (!activeStatuses || activeStatuses.length === 0) {
            return appointmentsByDay
        }

        const filtered: Record<string, AppointmentData[]> = {}
        for (const [day, appointments] of Object.entries(appointmentsByDay)) {
            filtered[day] = filterAppointmentsByStatus(appointments, activeStatuses)
        }
        return filtered
    }, [appointmentsByDay, activeStatuses])

    const totalAppointments = Object.values(filteredAppointmentsByDay).reduce((sum, apps) => sum + apps.length, 0)

    // Check if appointment can be cancelled or rescheduled
    const canModify = (status: AppointmentStatus) => status === 'SCHEDULED' || status === 'RESCHEDULED'

    // Check if appointment can be marked as completed
    const canComplete = (status: AppointmentStatus, occupiedEndAt: Date) =>
        canModify(status) && occupiedEndAt <= new Date()

    if (totalAppointments === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
                <div className='rounded-full bg-zinc-100 p-3 dark:bg-zinc-800'>
                    <Calendar className='h-6 w-6 text-zinc-400' />
                </div>
                <p className='mt-4 text-sm text-zinc-500 dark:text-zinc-400'>No hay turnos agendados esta semana</p>
            </div>
        )
    }

    return (
        <div className='space-y-4'>
            {weekDays.map(dateStr => {
                const appointments = filteredAppointmentsByDay[dateStr] || []
                const dayLabel = formatShortDate(dateStr, 'weekday', timezone)

                return (
                    <div key={dateStr} className='rounded-lg border border-zinc-200 dark:border-zinc-800'>
                        {/* Day header */}
                        <div className='flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900'>
                            <span className='font-medium text-zinc-900 dark:text-zinc-100'>{dayLabel}</span>
                            <span className='text-sm text-zinc-500 dark:text-zinc-400'>
                                {appointments.length} turno{appointments.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Appointments for this day */}
                        {appointments.length === 0 ? (
                            <div className='px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500'>Sin turnos</div>
                        ) : (
                            <div className='divide-y divide-zinc-100 dark:divide-zinc-800'>
                                {appointments.map(appointment => {
                                    const status = statusConfig[appointment.status]
                                    const startAt = new Date(appointment.startAt)
                                    const endAt = new Date(appointment.endAt)
                                    const occupiedEndAt = new Date(appointment.occupiedEndAt)
                                    const timeRange = formatAppointmentTime(startAt, endAt, timezone)

                                    return (
                                        <div
                                            key={appointment.id}
                                            className='flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
                                        >
                                            <div className='flex-1 space-y-1'>
                                                <div className='flex items-center gap-2'>
                                                    <Clock className='h-4 w-4 text-zinc-400' />
                                                    <span className='font-medium text-zinc-900 dark:text-zinc-100'>
                                                        {timeRange}
                                                    </span>
                                                    <span
                                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                                                    >
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400'>
                                                    <span className='font-medium'>{appointment.service.name}</span>
                                                    <span>
                                                        {resourceLabel}: {appointment.resource.name}
                                                    </span>
                                                    <span className='flex items-center gap-1'>
                                                        <User className='h-3 w-3' />
                                                        {appointment.customer.fullName}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
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
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
