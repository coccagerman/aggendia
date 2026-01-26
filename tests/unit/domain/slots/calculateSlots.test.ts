/**
 * Unit tests for slots calculation algorithm
 * Updated for US-5.5: uses slotIntervalMinutes instead of bufferMinutes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calculateSlots } from '@/domain/slots/slots.service'
import { CalculateSlotsInput } from '@/domain/slots/slots.types'
import { addDays, startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('calculateSlots', () => {
    // Mock system time for tests that use fixed dates in the past
    // This prevents the "filter out past slots" logic from removing all results
    beforeEach(() => {
        // Set system time to before the test dates (2026-01-15)
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return empty array when no availability rules exist', () => {
        const baseDate = startOfDay(new Date('2026-01-10T00:00:00Z'))

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            availabilityRules: [], // No rules
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)
        expect(result).toEqual([])
    })

    it('should generate slots respecting availability rules and slotIntervalMinutes', () => {
        // Friday 2026-01-16 in Buenos Aires
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 30, // Slots offered every 30 minutes
            availabilityRules: [
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 9 * 60, // 09:00
                    endMinutes: 10 * 60 // 10:00 (1 hour window)
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        // With slotInterval=30, should generate slots at 09:00, 09:30
        // (10:00 + 30min = 10:30, which exceeds the end, so excluded)
        expect(result.length).toBe(2)
        expect(result[0].displayTime).toBe('09:00')
        expect(result[1].displayTime).toBe('09:30')
    })

    it('should advance by slotIntervalMinutes when generating slots', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 45, // 45min periodicity with 30min duration
            availabilityRules: [
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 9 * 60, // 09:00
                    endMinutes: 11 * 60 // 11:00 (2 hour window)
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        // With slotInterval=45:
        // 09:00 -> occupied until 09:45
        // 09:45 -> occupied until 10:30
        // 10:30 -> occupied until 11:15 (exceeds 11:00, excluded)
        expect(result.length).toBe(2)
        expect(result[0].displayTime).toBe('09:00')
        expect(result[1].displayTime).toBe('09:45')
    })

    it('should subtract blocks from available windows', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)
        const blockStart = fromZonedTime('2026-01-16T09:30:00', TIMEZONE)
        const blockEnd = fromZonedTime('2026-01-16T10:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            availabilityRules: [
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 9 * 60, // 09:00
                    endMinutes: 11 * 60 // 11:00
                }
            ],
            blocks: [
                {
                    startAt: blockStart,
                    endAt: blockEnd // Blocks 09:30-10:00
                }
            ],
            appointments: []
        }

        const result = calculateSlots(input)
        const displayTimes = result.map(s => s.displayTime)

        // Available: 09:00-09:30 (one slot: 09:00)
        // Blocked: 09:30-10:00
        // Available: 10:00-11:00 (slots: 10:00, 10:30)
        expect(displayTimes).toContain('09:00')
        expect(displayTimes).toContain('10:00')
        expect(displayTimes).toContain('10:30')

        // 09:30 is blocked
        expect(displayTimes).not.toContain('09:30')
    })

    it('should subtract appointments (using occupiedEndAt) from available windows', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)
        const apptStart = fromZonedTime('2026-01-16T09:30:00', TIMEZONE)
        const apptOccupiedEnd = fromZonedTime('2026-01-16T10:15:00', TIMEZONE) // 45min slot interval

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 45,
            availabilityRules: [
                {
                    dayOfWeek: 5,
                    startMinutes: 9 * 60,
                    endMinutes: 12 * 60 // 09:00-12:00
                }
            ],
            blocks: [],
            appointments: [
                {
                    startAt: apptStart,
                    occupiedEndAt: apptOccupiedEnd // Appointment occupies 09:30-10:15
                }
            ]
        }

        const result = calculateSlots(input)
        const displayTimes = result.map(s => s.displayTime)

        // Free windows after subtracting appointment: [09:00-09:30] and [10:15-12:00]
        // 09:00 -> occupiedEnd=09:45, but window ends at 09:30 → doesn't fit!
        // 10:15 -> occupiedEnd=11:00 → fits in [10:15-12:00]
        // 11:00 -> occupiedEnd=11:45 → fits in [10:15-12:00]
        expect(displayTimes).toContain('10:15')
        expect(displayTimes).toContain('11:00')
        expect(displayTimes).toHaveLength(2)

        // 09:00 doesn't fit because occupied range (09:00-09:45) exceeds the free window (09:00-09:30)
        expect(displayTimes).not.toContain('09:00')
        // 09:45 would start inside the appointment's occupied range
        expect(displayTimes).not.toContain('09:45')
    })

    it('should handle multiple availability rules for the same day', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            availabilityRules: [
                {
                    dayOfWeek: 5,
                    startMinutes: 9 * 60, // 09:00-10:00
                    endMinutes: 10 * 60
                },
                {
                    dayOfWeek: 5,
                    startMinutes: 14 * 60, // 14:00-15:00
                    endMinutes: 15 * 60
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)
        const displayTimes = result.map(s => s.displayTime)

        // Should have slots in both windows
        expect(displayTimes.some(t => t.startsWith('09:'))).toBe(true)
        expect(displayTimes.some(t => t.startsWith('14:'))).toBe(true)

        // Should NOT have slots in gap (10:00-14:00)
        expect(displayTimes.some(t => t.startsWith('12:'))).toBe(false)
    })

    it('should return slots in correct ISO 8601 UTC format', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            availabilityRules: [
                {
                    dayOfWeek: 5,
                    startMinutes: 9 * 60,
                    endMinutes: 10 * 60
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        expect(result.length).toBeGreaterThan(0)

        // Check format of first slot
        const firstSlot = result[0]
        expect(firstSlot.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        expect(firstSlot.endAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

        // endAt should be startAt + durationMinutes (not slotInterval)
        const start = new Date(firstSlot.startAt)
        const end = new Date(firstSlot.endAt)
        const diff = (end.getTime() - start.getTime()) / 1000 / 60
        expect(diff).toBe(30)
    })

    it('should handle multi-day ranges correctly', () => {
        const baseDate = fromZonedTime('2026-01-15T00:00:00', TIMEZONE) // Thursday

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 3), // Thu, Fri, Sat
            durationMinutes: 60,
            slotIntervalMinutes: 60,
            availabilityRules: [
                {
                    dayOfWeek: 4, // Thursday
                    startMinutes: 10 * 60,
                    endMinutes: 12 * 60 // 2 hour window
                },
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 10 * 60,
                    endMinutes: 12 * 60 // 2 hour window
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        // Each day has 2 hour window with 60min interval = 2 slots per day (10:00, 11:00)
        // Total: 4 slots
        expect(result.length).toBe(4)

        // All slots should be 10:00 or 11:00
        const displayTimes = result.map(s => s.displayTime)
        expect(displayTimes.filter(t => t === '10:00').length).toBe(2)
        expect(displayTimes.filter(t => t === '11:00').length).toBe(2)
    })

    it('should work with slotIntervalMinutes > durationMinutes (spacing between appointments)', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30, // Appointment lasts 30 min
            slotIntervalMinutes: 60, // But slots offered every 60 min
            availabilityRules: [
                {
                    dayOfWeek: 5,
                    startMinutes: 9 * 60, // 09:00
                    endMinutes: 12 * 60 // 12:00 (3 hour window)
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        // With 60min interval: slots at 09:00, 10:00, 11:00
        expect(result.length).toBe(3)
        expect(result[0].displayTime).toBe('09:00')
        expect(result[1].displayTime).toBe('10:00')
        expect(result[2].displayTime).toBe('11:00')

        // Each appointment duration is still 30 min
        const firstSlot = result[0]
        const start = new Date(firstSlot.startAt)
        const end = new Date(firstSlot.endAt)
        const diff = (end.getTime() - start.getTime()) / 1000 / 60
        expect(diff).toBe(30)
    })

    // ============================================================================
    // US-7.1: Minimum booking notice tests
    // ============================================================================

    describe('minBookingNoticeMinutes', () => {
        it('should filter out slots within minimum booking notice window', () => {
            // Generate slots starting from "now" with 60 min notice
            const now = new Date()
            const dayOfWeek = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

            const input: CalculateSlotsInput = {
                businessTimezone: TIMEZONE,
                fromDate: now,
                toDate: addDays(now, 2),
                durationMinutes: 30,
                slotIntervalMinutes: 30,
                availabilityRules: [
                    {
                        dayOfWeek,
                        startMinutes: 0, // 00:00
                        endMinutes: 24 * 60 // 24:00 (full day)
                    },
                    {
                        dayOfWeek: ((dayOfWeek + 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                        startMinutes: 0,
                        endMinutes: 24 * 60
                    }
                ],
                blocks: [],
                appointments: [],
                minBookingNoticeMinutes: 60 // 1 hour notice
            }

            const result = calculateSlots(input)

            // All returned slots should be at least 60 minutes from now (>= the boundary)
            const earliestBookableTime = new Date(now.getTime() + 60 * 60 * 1000)
            result.forEach(slot => {
                expect(new Date(slot.startAt).getTime()).toBeGreaterThanOrEqual(earliestBookableTime.getTime())
            })
        })

        it('should return all slots when minBookingNoticeMinutes is 0', () => {
            const now = new Date()
            const dayOfWeek = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

            const inputWithNotice: CalculateSlotsInput = {
                businessTimezone: TIMEZONE,
                fromDate: now,
                toDate: addDays(now, 1),
                durationMinutes: 30,
                slotIntervalMinutes: 30,
                availabilityRules: [
                    {
                        dayOfWeek,
                        startMinutes: 0,
                        endMinutes: 24 * 60
                    }
                ],
                blocks: [],
                appointments: [],
                minBookingNoticeMinutes: 0
            }

            const inputWithoutNotice: CalculateSlotsInput = {
                ...inputWithNotice
            }
            delete inputWithoutNotice.minBookingNoticeMinutes

            const resultWithNotice = calculateSlots(inputWithNotice)
            const resultWithoutNotice = calculateSlots(inputWithoutNotice)

            // Both should return the same slots (0 notice = no filtering)
            expect(resultWithNotice.length).toBe(resultWithoutNotice.length)
        })

        it('should handle large minBookingNoticeMinutes (1 day)', () => {
            const now = new Date()
            const dayOfWeek = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

            const input: CalculateSlotsInput = {
                businessTimezone: TIMEZONE,
                fromDate: now,
                toDate: addDays(now, 3),
                durationMinutes: 30,
                slotIntervalMinutes: 30,
                availabilityRules: [
                    {
                        dayOfWeek,
                        startMinutes: 9 * 60,
                        endMinutes: 12 * 60
                    },
                    {
                        dayOfWeek: ((dayOfWeek + 1) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                        startMinutes: 9 * 60,
                        endMinutes: 12 * 60
                    },
                    {
                        dayOfWeek: ((dayOfWeek + 2) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
                        startMinutes: 9 * 60,
                        endMinutes: 12 * 60
                    }
                ],
                blocks: [],
                appointments: [],
                minBookingNoticeMinutes: 1440 // 24 hours
            }

            const result = calculateSlots(input)

            // All returned slots should be at least 24 hours from now (>= the boundary)
            const earliestBookableTime = new Date(now.getTime() + 1440 * 60 * 1000)
            result.forEach(slot => {
                expect(new Date(slot.startAt).getTime()).toBeGreaterThanOrEqual(earliestBookableTime.getTime())
            })
        })

        it('should include slot exactly at minimum notice threshold (boundary test)', () => {
            // Use vi.useFakeTimers to control "now" precisely
            const fixedNow = new Date('2026-01-15T10:00:00Z')
            vi.setSystemTime(fixedNow)

            // Create availability rule that includes a slot exactly at the boundary
            // If minBookingNoticeMinutes = 60, and now = 10:00, then boundary = 11:00
            // A slot starting at 11:00 should be INCLUDED (>= behavior)
            const dayOfWeek = fixedNow.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

            const input: CalculateSlotsInput = {
                businessTimezone: 'UTC',
                fromDate: fixedNow,
                toDate: addDays(fixedNow, 1),
                durationMinutes: 30,
                slotIntervalMinutes: 30,
                availabilityRules: [
                    {
                        dayOfWeek,
                        startMinutes: 11 * 60, // 11:00 - exactly at boundary
                        endMinutes: 12 * 60 // 12:00
                    }
                ],
                blocks: [],
                appointments: [],
                minBookingNoticeMinutes: 60 // 1 hour notice
            }

            const result = calculateSlots(input)

            // Should have slots: 11:00 (boundary), 11:30
            // The 11:00 slot is EXACTLY at now + 60 minutes, should be included
            expect(result.length).toBeGreaterThanOrEqual(1)
            expect(result[0].displayTime).toBe('11:00')

            // Verify the first slot is exactly at the boundary
            const firstSlotTime = new Date(result[0].startAt).getTime()
            const boundaryTime = fixedNow.getTime() + 60 * 60 * 1000
            expect(firstSlotTime).toBe(boundaryTime)

            vi.useRealTimers()
        })
    })
})
