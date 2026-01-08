import { formatAppointmentTime } from '@/lib/format'
import { AppointmentStatus } from '@prisma/client'
import { Calendar, Clock, User } from 'lucide-react'

interface AppointmentData {
    id: string
    status: AppointmentStatus
    startAt: Date
    endAt: Date
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
}

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
    SCHEDULED: {
        label: 'Confirmado',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    },
    CANCELLED: {
        label: 'Cancelado',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    },
    RESCHEDULED: {
        label: 'Reprogramado',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    },
    COMPLETED: {
        label: 'Completado',
        className: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
    }
}

export function AppointmentList({ appointments, timezone, resourceLabel }: AppointmentListProps) {
    if (appointments.length === 0) {
        return (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
                <div className='rounded-full bg-zinc-100 p-3 dark:bg-zinc-800'>
                    <Calendar className='h-6 w-6 text-zinc-400' />
                </div>
                <p className='mt-4 text-sm text-zinc-500 dark:text-zinc-400'>No hay turnos agendados para este día</p>
            </div>
        )
    }

    return (
        <div className='divide-y divide-zinc-200 dark:divide-zinc-800'>
            {appointments.map(appointment => {
                const status = statusConfig[appointment.status]
                const timeRange = formatAppointmentTime(appointment.startAt, appointment.endAt, timezone)

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

                        {/* Right side: Customer info */}
                        <div className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'>
                            <User className='h-4 w-4' />
                            <span>{appointment.customer.fullName}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
