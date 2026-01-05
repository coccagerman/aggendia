/**
 * Domain types for AvailabilityRule entity
 */

/**
 * Days of week: 0=Sunday, 1=Monday, ..., 6=Saturday
 * Matches JavaScript Date.getDay() convention
 */
export const DAYS_OF_WEEK = [0, 1, 2, 3, 4, 5, 6] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

/**
 * Display order for UI: Monday first, Sunday last
 */
export const DAYS_OF_WEEK_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const DAY_NAMES: Record<DayOfWeek, string> = {
    0: 'Domingo',
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado'
}

/** Short names for compact UI */
export const DAY_SHORT_NAMES: Record<DayOfWeek, string> = {
    0: 'Dom',
    1: 'Lun',
    2: 'Mar',
    3: 'Mié',
    4: 'Jue',
    5: 'Vie',
    6: 'Sáb'
}

/** Minutes range constants */
export const MIN_MINUTES = 0 // 00:00
export const MAX_MINUTES = 1440 // 24:00

/** Maximum ranges allowed per day */
export const MAX_RANGES_PER_DAY = 5

export interface AvailabilityRule {
    id: string
    resourceId: string
    dayOfWeek: DayOfWeek
    startMinutes: number
    endMinutes: number
    createdAt: Date
    updatedAt: Date
}

export interface AvailabilityRangeInput {
    dayOfWeek: DayOfWeek
    startMinutes: number
    endMinutes: number
}

/**
 * Converts minutes since midnight to HH:mm format
 */
export function minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Converts HH:mm format to minutes since midnight
 */
export function timeToMinutes(time: string): number {
    const [hours, mins] = time.split(':').map(Number)
    return hours * 60 + mins
}
