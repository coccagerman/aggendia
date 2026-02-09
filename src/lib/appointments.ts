/**
 * Shared utilities for appointments
 */

import type { AppointmentStatus } from '@prisma/client'

/**
 * All valid appointment statuses
 */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED']

/**
 * Default active statuses when no filter is specified.
 * Only confirmed (SCHEDULED) appointments are shown by default;
 * users can opt-in to other statuses via the filter dropdown.
 */
export const DEFAULT_STATUSES: AppointmentStatus[] = ['SCHEDULED']

/**
 * Status configuration for UI display
 */
export const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
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

/**
 * Validate if a string is a valid AppointmentStatus
 */
export function isValidStatus(status: string): status is AppointmentStatus {
    return APPOINTMENT_STATUSES.includes(status as AppointmentStatus)
}

/**
 * Parse status filter from URL query param (comma-separated)
 * Returns DEFAULT_STATUSES (only SCHEDULED) when param is absent,
 * or all statuses if the param is invalid.
 */
export function parseStatusFilter(statusParam: string | undefined): AppointmentStatus[] {
    if (!statusParam) {
        return [...DEFAULT_STATUSES]
    }

    const statuses = statusParam
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(isValidStatus)

    // If no valid statuses, return default
    if (statuses.length === 0) {
        return [...DEFAULT_STATUSES]
    }

    return statuses
}

/**
 * Serialize status filter to URL query param (comma-separated)
 * Returns undefined when the selection matches the default (SCHEDULED only),
 * so the URL stays clean for the most common case.
 */
export function serializeStatusFilter(statuses: AppointmentStatus[]): string | undefined {
    // If selection matches default, omit from URL
    if (statuses.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(s => statuses.includes(s))) {
        return undefined
    }
    return statuses.join(',')
}

/**
 * Filter appointments by status
 * Generic to work with any object that has a status property
 */
export function filterAppointmentsByStatus<T extends { status: AppointmentStatus }>(
    appointments: T[],
    activeStatuses: AppointmentStatus[]
): T[] {
    // If all statuses active, no filtering needed
    if (activeStatuses.length === APPOINTMENT_STATUSES.length) {
        return appointments
    }
    return appointments.filter(a => activeStatuses.includes(a.status))
}

/**
 * Count appointments by status
 */
export function countAppointmentsByStatus<T extends { status: AppointmentStatus }>(
    appointments: T[]
): Record<AppointmentStatus, number> {
    const counts: Record<AppointmentStatus, number> = {
        SCHEDULED: 0,
        CANCELLED: 0,
        RESCHEDULED: 0,
        COMPLETED: 0
    }

    for (const appointment of appointments) {
        counts[appointment.status]++
    }

    return counts
}
