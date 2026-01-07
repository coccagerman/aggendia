/**
 * Unit tests for slots calculation algorithm
 */

import { describe, it, expect } from 'vitest'
import { calculateSlots } from '@/domain/slots/slots.service'
import { CalculateSlotsInput } from '@/domain/slots/slots.types'
import { addDays, startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('calculateSlots', () => {
    it('should return empty array when no availability rules exist', () => {
        const baseDate = startOfDay(new Date('2026-01-10T00:00:00Z'))

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            bufferMinutes: 0,
            availabilityRules: [], // No rules
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)
        expect(result).toEqual([])
    })

    it('should generate slots respecting availability rules', () => {
        // Friday 2026-01-16 in Buenos Aires
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            bufferMinutes: 0,
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

        // Should generate slots at 09:00, 09:05, 09:10, 09:15, 09:20, 09:25
        // (09:30 + 30min = 10:00, which is exactly at the end, so it should fit)
        expect(result.length).toBeGreaterThan(0)
        expect(result.length).toBeLessThanOrEqual(12) // Max 12 slots in 1 hour with 5min step

        // Check first slot
        expect(result[0].displayTime).toBe('09:00')
    })

    it('should respect service duration + buffer when generating slots', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            bufferMinutes: 10, // 10min buffer
            availabilityRules: [
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 9 * 60, // 09:00
                    endMinutes: 10 * 60 // 10:00
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        // With 30min duration + 10min buffer = 40min total
        // Last possible slot that fits: 09:20 (09:20 + 40min = 10:00)
        const lastSlot = result[result.length - 1]
        expect(lastSlot.displayTime).toBe('09:20')
    })

    it('should subtract blocks from available windows', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)
        const blockStart = fromZonedTime('2026-01-16T09:30:00', TIMEZONE)
        const blockEnd = fromZonedTime('2026-01-16T09:45:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 15,
            bufferMinutes: 0,
            availabilityRules: [
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 9 * 60, // 09:00
                    endMinutes: 10 * 60 // 10:00
                }
            ],
            blocks: [
                {
                    startAt: blockStart,
                    endAt: blockEnd // Blocks 09:30-09:45
                }
            ],
            appointments: []
        }

        const result = calculateSlots(input)

        // Slots before block: 09:00, 09:05, 09:10, 09:15
        // (09:20 + 15min = 09:35 would overlap with block 09:30-09:45, so excluded)
        // (09:25 + 15min = 09:40 would overlap with block 09:30-09:45, so excluded)
        // (09:30 + 15min = 09:45 would overlap with block 09:30-09:45, so excluded)
        // Slots after block: 09:45, 09:50, 09:55
        const displayTimes = result.map(s => s.displayTime)

        expect(displayTimes).toContain('09:00')
        expect(displayTimes).toContain('09:15')
        expect(displayTimes).toContain('09:45')

        // 09:20, 09:25, 09:30, 09:35, 09:40 should be blocked (would overlap with block)
        expect(displayTimes).not.toContain('09:20')
        expect(displayTimes).not.toContain('09:25')
        expect(displayTimes).not.toContain('09:30')
        expect(displayTimes).not.toContain('09:35')
        expect(displayTimes).not.toContain('09:40')
    })

    it('should subtract appointments (using occupiedEndAt) from available windows', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)
        const apptStart = fromZonedTime('2026-01-16T09:15:00', TIMEZONE)
        const apptOccupiedEnd = fromZonedTime('2026-01-16T09:30:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 15,
            bufferMinutes: 0,
            availabilityRules: [
                {
                    dayOfWeek: 5,
                    startMinutes: 9 * 60,
                    endMinutes: 10 * 60
                }
            ],
            blocks: [],
            appointments: [
                {
                    startAt: apptStart,
                    occupiedEndAt: apptOccupiedEnd // Appointment occupies 09:15-09:30
                }
            ]
        }

        const result = calculateSlots(input)
        const displayTimes = result.map(s => s.displayTime)

        // 09:15 should be blocked by appointment
        expect(displayTimes).not.toContain('09:15')

        // Slots before appointment should be available
        expect(displayTimes).toContain('09:00')

        // Slots after appointment should be available
        expect(displayTimes).toContain('09:30')
    })

    it('should handle multiple availability rules for the same day', () => {
        const baseDate = fromZonedTime('2026-01-16T00:00:00', TIMEZONE)

        const input: CalculateSlotsInput = {
            businessTimezone: TIMEZONE,
            fromDate: baseDate,
            toDate: addDays(baseDate, 1),
            durationMinutes: 30,
            bufferMinutes: 0,
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
            bufferMinutes: 0,
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

        // endAt should be startAt + durationMinutes
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
            bufferMinutes: 0,
            availabilityRules: [
                {
                    dayOfWeek: 4, // Thursday
                    startMinutes: 10 * 60,
                    endMinutes: 11 * 60
                },
                {
                    dayOfWeek: 5, // Friday
                    startMinutes: 10 * 60,
                    endMinutes: 11 * 60
                }
            ],
            blocks: [],
            appointments: []
        }

        const result = calculateSlots(input)

        // Should have slots from both days (Thursday and Friday)
        // Each day has 1 hour window with 60min duration = 1 slot per day (10:00-11:00)
        expect(result.length).toBeGreaterThanOrEqual(2)

        // All slots should have 10:00 displayTime
        const displayTimes = result.map(s => s.displayTime)
        expect(displayTimes.every(t => t === '10:00' || t === '10:05')).toBe(true)
    })
})
