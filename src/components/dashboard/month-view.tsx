'use client'

import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { getTodayInTimezone, getWeekdayInTimezone } from '@/lib/timezone'
import { filterAppointmentsByStatus } from '@/lib/appointments'
import type { AppointmentStatus } from '@prisma/client'

interface AppointmentData {
    status: AppointmentStatus
    startAt: string | Date
}

interface MonthViewProps {
    /** Array of all date strings in the month */
    monthDays: string[]
    /** Count of appointments per day (used when no status filter) */
    appointmentCountByDay: Record<string, number>
    timezone: string
    /** Callback when a day is clicked */
    onDayClick?: (dateStr: string) => void
    /** Full appointments data (needed for status filtering) */
    appointments?: AppointmentData[]
    /** Active status filters */
    activeStatuses?: AppointmentStatus[]
}

export function MonthView({
    monthDays,
    appointmentCountByDay,
    timezone,
    onDayClick,
    appointments,
    activeStatuses
}: MonthViewProps) {
    // Calculate filtered counts by day (memoized)
    const filteredCountByDay = useMemo(() => {
        // If we have appointments and status filters, calculate filtered counts
        if (appointments && activeStatuses && activeStatuses.length > 0) {
            const filtered = filterAppointmentsByStatus(appointments, activeStatuses)

            const countByDay: Record<string, number> = {}
            for (const appt of filtered) {
                const startAt = new Date(appt.startAt)
                const dateStr = startAt.toLocaleDateString('en-CA', { timeZone: timezone })
                countByDay[dateStr] = (countByDay[dateStr] || 0) + 1
            }
            return countByDay
        }

        // Otherwise use pre-calculated counts from backend
        return appointmentCountByDay
    }, [appointments, activeStatuses, appointmentCountByDay, timezone])

    const totalAppointments = Object.values(filteredCountByDay).reduce((sum, count) => sum + count, 0)

    // Get today's date for highlighting
    const today = getTodayInTimezone(timezone)

    // Calculate calendar grid
    // We need to know what day of week the first day is (to add padding)
    const firstDay = monthDays[0]

    // Calculate padding days before month starts (using business timezone)
    const firstDayOfWeek = getWeekdayInTimezone(firstDay, timezone) // 0=Sun, 1=Mon, ..., 6=Sat
    // Convert to Monday-based: Mon=0, Tue=1, ..., Sun=6
    const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

    // Build calendar grid (6 rows x 7 columns max)
    const calendarDays: (string | null)[] = []

    // Add padding nulls for days before month starts
    for (let i = 0; i < paddingDays; i++) {
        calendarDays.push(null)
    }

    // Add month days
    for (const day of monthDays) {
        calendarDays.push(day)
    }

    // Pad to complete last week
    while (calendarDays.length % 7 !== 0) {
        calendarDays.push(null)
    }

    // Split into weeks
    const weeks: (string | null)[][] = []
    for (let i = 0; i < calendarDays.length; i += 7) {
        weeks.push(calendarDays.slice(i, i + 7))
    }

    const weekDayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    return (
        <div className='space-y-4'>
            {/* Calendar grid */}
            <div className='overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800'>
                {/* Weekday headers */}
                <div className='grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'>
                    {weekDayLabels.map(label => (
                        <div
                            key={label}
                            className='px-2 py-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400'
                        >
                            {label}
                        </div>
                    ))}
                </div>

                {/* Calendar weeks */}
                {weeks.map((week, weekIndex) => (
                    <div
                        key={weekIndex}
                        className='grid grid-cols-7 divide-x divide-zinc-200 border-b border-zinc-200 last:border-b-0 dark:divide-zinc-800 dark:border-zinc-800'
                    >
                        {week.map((dateStr, dayIndex) => {
                            if (dateStr === null) {
                                return (
                                    <div
                                        key={`empty-${weekIndex}-${dayIndex}`}
                                        className='min-h-20 bg-zinc-50 p-2 dark:bg-zinc-900/50'
                                    />
                                )
                            }

                            const appointmentCount = filteredCountByDay[dateStr] || 0
                            const isToday = dateStr === today
                            const dayNum = parseInt(dateStr.split('-')[2], 10)

                            return (
                                <button
                                    key={dateStr}
                                    onClick={() => onDayClick?.(dateStr)}
                                    className={`min-h-20 p-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                                        isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                    }`}
                                >
                                    <div className='flex flex-col gap-1'>
                                        <span
                                            className={`text-sm font-medium ${
                                                isToday
                                                    ? 'text-blue-600 dark:text-blue-400'
                                                    : 'text-zinc-900 dark:text-zinc-100'
                                            }`}
                                        >
                                            {dayNum}
                                        </span>
                                        {appointmentCount > 0 && (
                                            <span className='inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400'>
                                                <Calendar className='h-3 w-3' />
                                                {appointmentCount}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                ))}
            </div>

            {/* Summary */}
            <div className='text-center text-sm text-zinc-500 dark:text-zinc-400'>
                {totalAppointments === 0 ? (
                    <div className='flex flex-col items-center justify-center py-4'>
                        <div className='rounded-full bg-zinc-100 p-3 dark:bg-zinc-800'>
                            <Calendar className='h-6 w-6 text-zinc-400' />
                        </div>
                        <p className='mt-4'>No hay turnos agendados este mes</p>
                    </div>
                ) : (
                    <p>
                        {totalAppointments} turno{totalAppointments !== 1 ? 's' : ''} en el mes
                    </p>
                )}
            </div>
        </div>
    )
}
