/**
 * Unit tests for timezone utility functions.
 * Tests localInputToISO and getTimezoneOffsetMinutes with various timezones.
 */

import { describe, it, expect } from 'vitest'
import { localInputToISO, getTimezoneOffsetMinutes, formatDateTimeInTimezone } from '@/lib/timezone'

describe('timezone utilities', () => {
    describe('getTimezoneOffsetMinutes', () => {
        it('should return correct offset for UTC', () => {
            const date = new Date('2026-01-15T12:00:00Z')
            const offset = getTimezoneOffsetMinutes('UTC', date)
            expect(offset).toBe(0)
        })

        it('should return correct offset for America/Argentina/Buenos_Aires (UTC-3)', () => {
            // Argentina does not observe DST, always UTC-3
            const date = new Date('2026-01-15T12:00:00Z')
            const offset = getTimezoneOffsetMinutes('America/Argentina/Buenos_Aires', date)
            expect(offset).toBe(-180) // -3 hours = -180 minutes
        })

        it('should return correct offset for America/New_York in winter (EST, UTC-5)', () => {
            // January is winter, EST (UTC-5)
            const date = new Date('2026-01-15T12:00:00Z')
            const offset = getTimezoneOffsetMinutes('America/New_York', date)
            expect(offset).toBe(-300) // -5 hours = -300 minutes
        })

        it('should return correct offset for America/New_York in summer (EDT, UTC-4)', () => {
            // July is summer, EDT (UTC-4)
            const date = new Date('2026-07-15T12:00:00Z')
            const offset = getTimezoneOffsetMinutes('America/New_York', date)
            expect(offset).toBe(-240) // -4 hours = -240 minutes
        })

        it('should return correct offset for Europe/Madrid in winter (CET, UTC+1)', () => {
            const date = new Date('2026-01-15T12:00:00Z')
            const offset = getTimezoneOffsetMinutes('Europe/Madrid', date)
            expect(offset).toBe(60) // +1 hour = 60 minutes
        })

        it('should return correct offset for Europe/Madrid in summer (CEST, UTC+2)', () => {
            const date = new Date('2026-07-15T12:00:00Z')
            const offset = getTimezoneOffsetMinutes('Europe/Madrid', date)
            expect(offset).toBe(120) // +2 hours = 120 minutes
        })
    })

    describe('localInputToISO', () => {
        it('should convert Argentina time to correct UTC', () => {
            // 09:00 in Buenos Aires (UTC-3) should be 12:00 UTC
            const result = localInputToISO('2026-01-15', '09:00', 'America/Argentina/Buenos_Aires')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(12)
            expect(date.getUTCMinutes()).toBe(0)
            expect(date.getUTCDate()).toBe(15)
            expect(date.getUTCMonth()).toBe(0) // January
            expect(date.getUTCFullYear()).toBe(2026)
        })

        it('should convert UTC time correctly (no offset)', () => {
            const result = localInputToISO('2026-01-15', '09:00', 'UTC')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(9)
            expect(date.getUTCMinutes()).toBe(0)
        })

        it('should handle New York winter time (EST, UTC-5)', () => {
            // 09:00 in New York (UTC-5 in January) should be 14:00 UTC
            const result = localInputToISO('2026-01-15', '09:00', 'America/New_York')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(14)
            expect(date.getUTCMinutes()).toBe(0)
        })

        it('should handle New York summer time (EDT, UTC-4)', () => {
            // 09:00 in New York (UTC-4 in July) should be 13:00 UTC
            const result = localInputToISO('2026-07-15', '09:00', 'America/New_York')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(13)
            expect(date.getUTCMinutes()).toBe(0)
        })

        it('should handle positive offset timezones (Europe/Madrid winter)', () => {
            // 09:00 in Madrid (UTC+1 in January) should be 08:00 UTC
            const result = localInputToISO('2026-01-15', '09:00', 'Europe/Madrid')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(8)
            expect(date.getUTCMinutes()).toBe(0)
        })

        it('should handle positive offset timezones (Europe/Madrid summer)', () => {
            // 09:00 in Madrid (UTC+2 in July) should be 07:00 UTC
            const result = localInputToISO('2026-07-15', '09:00', 'Europe/Madrid')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(7)
            expect(date.getUTCMinutes()).toBe(0)
        })

        it('should handle midnight correctly', () => {
            // 00:00 in Buenos Aires (UTC-3) should be 03:00 UTC
            const result = localInputToISO('2026-01-15', '00:00', 'America/Argentina/Buenos_Aires')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(3)
            expect(date.getUTCMinutes()).toBe(0)
            expect(date.getUTCDate()).toBe(15)
        })

        it('should handle late night times that cross midnight in UTC', () => {
            // 23:00 in Buenos Aires (UTC-3) should be 02:00 UTC next day
            const result = localInputToISO('2026-01-15', '23:00', 'America/Argentina/Buenos_Aires')
            const date = new Date(result)

            expect(date.getUTCHours()).toBe(2)
            expect(date.getUTCMinutes()).toBe(0)
            expect(date.getUTCDate()).toBe(16) // Next day in UTC
        })

        it('should return valid ISO string format', () => {
            const result = localInputToISO('2026-01-15', '09:30', 'America/Argentina/Buenos_Aires')

            // Should be valid ISO format
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

            // Should be parseable
            const date = new Date(result)
            expect(date.toISOString()).toBe(result)
        })
    })

    describe('formatDateTimeInTimezone', () => {
        it('should format UTC date in Argentina timezone', () => {
            // 12:00 UTC should be 09:00 in Argentina (UTC-3)
            const isoString = '2026-01-15T12:00:00.000Z'
            const formatted = formatDateTimeInTimezone(isoString, 'America/Argentina/Buenos_Aires')

            // Should contain 09:00 a. m. (Argentina local time, es-AR format)
            expect(formatted).toMatch(/09:00/)
            expect(formatted).toContain('15')
        })

        it('should format UTC date in different timezone', () => {
            // 12:00 UTC should be 13:00 in Madrid (UTC+1 in winter)
            const isoString = '2026-01-15T12:00:00.000Z'
            const formatted = formatDateTimeInTimezone(isoString, 'Europe/Madrid')

            // Should contain 01:00 p. m. (13:00 in 12h format, es-AR locale)
            expect(formatted).toMatch(/01:00/)
            expect(formatted).toMatch(/p\.\s*m\./)
        })

        it('should handle date crossing midnight when converting', () => {
            // 02:00 UTC should be 23:00 previous day in Argentina (UTC-3)
            const isoString = '2026-01-15T02:00:00.000Z'
            const formatted = formatDateTimeInTimezone(isoString, 'America/Argentina/Buenos_Aires')

            // Should contain 11:00 p. m. (23:00 in 12h format) and be on the 14th
            expect(formatted).toMatch(/11:00/)
            expect(formatted).toMatch(/p\.\s*m\./)
            expect(formatted).toContain('14')
        })
    })

    describe('round-trip conversion', () => {
        it('should correctly round-trip Argentina timezone', () => {
            const timezone = 'America/Argentina/Buenos_Aires'
            const dateStr = '2026-01-15'
            const timeStr = '09:00'

            // Convert local -> UTC
            const isoString = localInputToISO(dateStr, timeStr, timezone)

            // Format back to local
            const formatted = formatDateTimeInTimezone(isoString, timezone)

            // Should contain the original time (09:00 a. m. in 12h format)
            expect(formatted).toMatch(/09:00/)
            expect(formatted).toContain('15')
        })

        it('should correctly round-trip New York summer time', () => {
            const timezone = 'America/New_York'
            const dateStr = '2026-07-15'
            const timeStr = '14:30'

            // Convert local -> UTC
            const isoString = localInputToISO(dateStr, timeStr, timezone)

            // Format back to local
            const formatted = formatDateTimeInTimezone(isoString, timezone)

            // Should contain the original time (02:30 p. m. in 12h format)
            expect(formatted).toMatch(/02:30/)
            expect(formatted).toMatch(/p\.\s*m\./)
            expect(formatted).toContain('15')
        })
    })
})
