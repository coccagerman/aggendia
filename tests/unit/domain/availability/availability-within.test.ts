/**
 * Unit tests for availability service - isWithinAvailability function
 */

import { describe, it, expect } from 'vitest'
import { isWithinAvailability } from '@/domain/availability/availability.service'
import { AvailabilityRangeInput } from '@/domain/availability/availability.types'
import { fromZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

// Helper to create a date in business timezone
function createDateInTimezone(
    year: number,
    month: number, // 0-indexed
    day: number,
    hours: number,
    minutes: number
): Date {
    return fromZonedTime(new Date(year, month, day, hours, minutes), TIMEZONE)
}

describe('isWithinAvailability', () => {
    const mondayRules: AvailabilityRangeInput[] = [
        { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 12 * 60 }, // 09:00-12:00
        { dayOfWeek: 1, startMinutes: 14 * 60, endMinutes: 18 * 60 } // 14:00-18:00
    ]

    const weekdayRules: AvailabilityRangeInput[] = [
        { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 18 * 60 }, // Monday 09:00-18:00
        { dayOfWeek: 2, startMinutes: 9 * 60, endMinutes: 18 * 60 }, // Tuesday 09:00-18:00
        { dayOfWeek: 3, startMinutes: 9 * 60, endMinutes: 18 * 60 }, // Wednesday 09:00-18:00
        { dayOfWeek: 4, startMinutes: 9 * 60, endMinutes: 18 * 60 }, // Thursday 09:00-18:00
        { dayOfWeek: 5, startMinutes: 9 * 60, endMinutes: 18 * 60 } // Friday 09:00-18:00
    ]

    describe('appointment within availability', () => {
        it('returns true when appointment is fully within a single availability window', () => {
            // Monday 2026-01-12 10:00-11:00 (within 09:00-12:00)
            const startAt = createDateInTimezone(2026, 0, 12, 10, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 11, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(true)
        })

        it('returns true when appointment starts at availability start', () => {
            // Monday 09:00-10:00
            const startAt = createDateInTimezone(2026, 0, 12, 9, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 10, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(true)
        })

        it('returns true when appointment ends at availability end', () => {
            // Monday 11:00-12:00 (ends exactly at 12:00)
            const startAt = createDateInTimezone(2026, 0, 12, 11, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 12, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(true)
        })

        it('returns true when appointment is in afternoon window', () => {
            // Monday 15:00-16:00 (within 14:00-18:00)
            const startAt = createDateInTimezone(2026, 0, 12, 15, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 16, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(true)
        })
    })

    describe('appointment outside availability', () => {
        it('returns false when no rules exist for the day', () => {
            // Sunday (day 0) - no rules
            const startAt = createDateInTimezone(2026, 0, 11, 10, 0)
            const endAt = createDateInTimezone(2026, 0, 11, 11, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false when appointment is before availability start', () => {
            // Monday 08:00-09:00 (before 09:00)
            const startAt = createDateInTimezone(2026, 0, 12, 8, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 9, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false when appointment is after availability end', () => {
            // Monday 18:30-19:30 (after 18:00)
            const startAt = createDateInTimezone(2026, 0, 12, 18, 30)
            const endAt = createDateInTimezone(2026, 0, 12, 19, 30)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false when appointment is in gap between windows', () => {
            // Monday 12:30-13:30 (between 12:00 and 14:00)
            const startAt = createDateInTimezone(2026, 0, 12, 12, 30)
            const endAt = createDateInTimezone(2026, 0, 12, 13, 30)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false when appointment starts before availability', () => {
            // Monday 08:30-10:00 (starts before 09:00)
            const startAt = createDateInTimezone(2026, 0, 12, 8, 30)
            const endAt = createDateInTimezone(2026, 0, 12, 10, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false when appointment ends after availability', () => {
            // Monday 11:00-12:30 (ends after 12:00)
            const startAt = createDateInTimezone(2026, 0, 12, 11, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 12, 30)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false when appointment spans multiple windows', () => {
            // Monday 11:00-15:00 (spans morning and afternoon windows)
            const startAt = createDateInTimezone(2026, 0, 12, 11, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 15, 0)

            expect(isWithinAvailability(mondayRules, startAt, endAt, TIMEZONE)).toBe(false)
        })
    })

    describe('edge cases', () => {
        it('returns false when rules array is empty', () => {
            const startAt = createDateInTimezone(2026, 0, 12, 10, 0)
            const endAt = createDateInTimezone(2026, 0, 12, 11, 0)

            expect(isWithinAvailability([], startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('returns false for cross-midnight appointments', () => {
            // Monday 23:00 to Tuesday 01:00
            const startAt = createDateInTimezone(2026, 0, 12, 23, 0)
            const endAt = createDateInTimezone(2026, 0, 13, 1, 0)

            const lateNightRules: AvailabilityRangeInput[] = [
                { dayOfWeek: 1, startMinutes: 22 * 60, endMinutes: 24 * 60 } // 22:00-24:00
            ]

            expect(isWithinAvailability(lateNightRules, startAt, endAt, TIMEZONE)).toBe(false)
        })

        it('handles different weekdays correctly', () => {
            // Tuesday 2026-01-13 10:00-11:00
            const tuesdayStart = createDateInTimezone(2026, 0, 13, 10, 0)
            const tuesdayEnd = createDateInTimezone(2026, 0, 13, 11, 0)

            expect(isWithinAvailability(weekdayRules, tuesdayStart, tuesdayEnd, TIMEZONE)).toBe(true)

            // Saturday 2026-01-17 (no rules for Saturday)
            const saturdayStart = createDateInTimezone(2026, 0, 17, 10, 0)
            const saturdayEnd = createDateInTimezone(2026, 0, 17, 11, 0)

            expect(isWithinAvailability(weekdayRules, saturdayStart, saturdayEnd, TIMEZONE)).toBe(false)
        })
    })
})
