/**
 * Domain service for availability rules
 * Contains validation and business logic (no DB/HTTP dependencies)
 */

import {
    AvailabilityRangeInput,
    DayOfWeek,
    DAYS_OF_WEEK,
    MIN_MINUTES,
    MAX_MINUTES,
    MAX_RANGES_PER_DAY
} from './availability.types'
import { AppError, AvailabilityErrorCodes } from '@/domain/common/errors'
import { toZonedTime } from 'date-fns-tz'

export interface ValidationResult {
    valid: boolean
    error?: string
}

/**
 * Validates a single availability range
 */
export function validateRange(range: AvailabilityRangeInput): ValidationResult {
    // Validate dayOfWeek
    if (!DAYS_OF_WEEK.includes(range.dayOfWeek as DayOfWeek)) {
        return { valid: false, error: 'Día de semana inválido' }
    }

    // Validate startMinutes
    if (range.startMinutes < MIN_MINUTES || range.startMinutes >= MAX_MINUTES) {
        return { valid: false, error: 'Hora de inicio inválida' }
    }

    // Validate endMinutes
    if (range.endMinutes <= MIN_MINUTES || range.endMinutes > MAX_MINUTES) {
        return { valid: false, error: 'Hora de fin inválida' }
    }

    // Validate start < end
    if (range.startMinutes >= range.endMinutes) {
        return { valid: false, error: 'La hora de inicio debe ser menor que la de fin' }
    }

    return { valid: true }
}

/**
 * Checks if two ranges overlap (exclusive of endpoints for contiguous ranges)
 */
function rangesOverlap(a: AvailabilityRangeInput, b: AvailabilityRangeInput): boolean {
    // Ranges overlap if they share any time (contiguous is allowed: 09:00-12:00 and 12:00-15:00)
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes
}

/**
 * Validates and normalizes an array of availability ranges
 * Throws AppError if validation fails
 */
export function validateAndNormalizeRanges(ranges: AvailabilityRangeInput[]): AvailabilityRangeInput[] {
    // Validate each range individually
    for (const range of ranges) {
        const result = validateRange(range)
        if (!result.valid) {
            throw new AppError(AvailabilityErrorCodes.AVAILABILITY_INVALID_RANGE, result.error!, 400)
        }
    }

    // Group by day
    const byDay = new Map<DayOfWeek, AvailabilityRangeInput[]>()
    for (const range of ranges) {
        const day = range.dayOfWeek as DayOfWeek
        if (!byDay.has(day)) {
            byDay.set(day, [])
        }
        byDay.get(day)!.push(range)
    }

    // Validate per-day constraints
    for (const [day, dayRanges] of byDay) {
        // Check max ranges per day
        if (dayRanges.length > MAX_RANGES_PER_DAY) {
            throw new AppError(
                AvailabilityErrorCodes.AVAILABILITY_TOO_MANY_RANGES,
                `Máximo ${MAX_RANGES_PER_DAY} rangos por día`,
                400,
                { dayOfWeek: day }
            )
        }

        // Sort by start time
        dayRanges.sort((a, b) => a.startMinutes - b.startMinutes)

        // Check for overlaps
        for (let i = 0; i < dayRanges.length - 1; i++) {
            if (rangesOverlap(dayRanges[i], dayRanges[i + 1])) {
                throw new AppError(AvailabilityErrorCodes.AVAILABILITY_OVERLAP, 'Los rangos no pueden solaparse', 400, {
                    dayOfWeek: day
                })
            }
        }
    }

    // Return normalized (sorted by day, then by start time)
    const normalized: AvailabilityRangeInput[] = []
    for (const day of DAYS_OF_WEEK) {
        const dayRanges = byDay.get(day) || []
        dayRanges.sort((a, b) => a.startMinutes - b.startMinutes)
        normalized.push(...dayRanges)
    }

    return normalized
}

/**
 * Check if a time range falls within availability rules
 * Used to validate bookings against resource availability
 *
 * @param rules - Availability rules for the resource
 * @param startAt - Appointment start time (Date)
 * @param endAt - Appointment end time (Date)
 * @param timezone - Business timezone for day-of-week calculation
 * @returns true if the entire appointment fits within availability
 */
export function isWithinAvailability(
    rules: AvailabilityRangeInput[],
    startAt: Date,
    endAt: Date,
    timezone: string
): boolean {
    // Convert to business timezone to get correct day of week
    const zonedStart = toZonedTime(startAt, timezone)
    const zonedEnd = toZonedTime(endAt, timezone)

    // Get day of week (0-6, Sunday=0)
    const dayOfWeek = zonedStart.getDay() as DayOfWeek

    // Get minutes since midnight in business timezone
    const startMinutes = zonedStart.getHours() * 60 + zonedStart.getMinutes()
    const endMinutes = zonedEnd.getHours() * 60 + zonedEnd.getMinutes()

    // Handle cross-midnight appointments (not supported for now - must be same day)
    if (zonedStart.toDateString() !== zonedEnd.toDateString()) {
        // For simplicity, reject cross-midnight appointments
        // This could be enhanced in the future
        return false
    }

    // Find rules for this day
    const dayRules = rules.filter(r => r.dayOfWeek === dayOfWeek)

    if (dayRules.length === 0) {
        // No availability on this day
        return false
    }

    // Check if the entire appointment fits within any availability window
    for (const rule of dayRules) {
        if (startMinutes >= rule.startMinutes && endMinutes <= rule.endMinutes) {
            return true
        }
    }

    return false
}
