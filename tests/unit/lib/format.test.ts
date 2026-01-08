/**
 * Unit tests for format utility functions.
 * Tests formatPrice and formatAppointmentTime with various inputs.
 */

import { describe, it, expect } from 'vitest'
import { formatPrice, formatAppointmentTime, formatDateForAgenda } from '@/lib/format'

describe('formatPrice', () => {
    describe('with valid price', () => {
        it('should format price in centavos correctly (ARS)', () => {
            // 15050 centavos = $150.50
            const result = formatPrice(15050, 'ARS')
            // es-AR locale uses "," for decimals and "." for thousands
            expect(result).toContain('150')
            expect(result).toContain('50')
            expect(result).toContain('ARS')
        })

        it('should format large price with thousand separators', () => {
            // 150000 centavos = $1500.00
            const result = formatPrice(150000, 'ARS')
            expect(result).toContain('1')
            expect(result).toContain('500')
            expect(result).toContain('ARS')
        })

        it('should format zero price', () => {
            const result = formatPrice(0, 'ARS')
            expect(result).toContain('0')
            expect(result).toContain('ARS')
        })

        it('should format price with USD currency', () => {
            const result = formatPrice(9999, 'USD')
            expect(result).toContain('99')
            expect(result).toContain('99')
            expect(result).toContain('USD')
        })

        it('should format price with null currency (ARS formatting, no code suffix)', () => {
            const result = formatPrice(5000, null)
            // When currency is null, uses ARS for formatting but doesn't add currency code
            expect(result).toContain('50')
            // No currency code appended when null
            expect(result).not.toContain('ARS')
        })
    })

    describe('with null price', () => {
        it('should return "Precio a confirmar" when priceCents is null', () => {
            const result = formatPrice(null, 'ARS')
            expect(result).toBe('Precio a confirmar')
        })

        it('should return "Precio a confirmar" regardless of currency', () => {
            const result = formatPrice(null, 'USD')
            expect(result).toBe('Precio a confirmar')
        })

        it('should return "Precio a confirmar" with null currency', () => {
            const result = formatPrice(null, null)
            expect(result).toBe('Precio a confirmar')
        })
    })

    describe('with invalid currency code', () => {
        it('should use fallback format for unknown currency', () => {
            // "XYZ" is not a valid ISO 4217 currency code
            const result = formatPrice(10000, 'XYZ')
            // Fallback should still show amount and currency code
            expect(result).toContain('100')
            expect(result).toContain('XYZ')
        })
    })

    describe('edge cases', () => {
        it('should handle single centavo', () => {
            const result = formatPrice(1, 'ARS')
            expect(result).toContain('0')
            expect(result).toContain('01')
            expect(result).toContain('ARS')
        })

        it('should handle very large amounts', () => {
            // 10000000 centavos = $100,000.00
            const result = formatPrice(10000000, 'ARS')
            expect(result).toContain('100')
            expect(result).toContain('000')
            expect(result).toContain('ARS')
        })
    })
})

describe('formatAppointmentTime', () => {
    describe('basic formatting', () => {
        it('should format time range in Argentina timezone', () => {
            // 12:00 UTC to 13:00 UTC = 09:00 to 10:00 in Argentina (UTC-3)
            const startAt = new Date('2026-01-15T12:00:00Z')
            const endAt = new Date('2026-01-15T13:00:00Z')
            const result = formatAppointmentTime(startAt, endAt, 'America/Argentina/Buenos_Aires')

            expect(result).toBe('09:00 - 10:00')
        })

        it('should format time range in UTC', () => {
            const startAt = new Date('2026-01-15T09:00:00Z')
            const endAt = new Date('2026-01-15T10:30:00Z')
            const result = formatAppointmentTime(startAt, endAt, 'UTC')

            expect(result).toBe('09:00 - 10:30')
        })

        it('should format time range in positive offset timezone (Madrid)', () => {
            // 08:00 UTC to 09:00 UTC = 09:00 to 10:00 in Madrid (UTC+1 in winter)
            const startAt = new Date('2026-01-15T08:00:00Z')
            const endAt = new Date('2026-01-15T09:00:00Z')
            const result = formatAppointmentTime(startAt, endAt, 'Europe/Madrid')

            expect(result).toBe('09:00 - 10:00')
        })

        it('should handle time range crossing midnight in display timezone', () => {
            // 02:00 UTC to 03:00 UTC = 23:00 to 00:00 in Argentina (UTC-3)
            const startAt = new Date('2026-01-15T02:00:00Z')
            const endAt = new Date('2026-01-15T03:00:00Z')
            const result = formatAppointmentTime(startAt, endAt, 'America/Argentina/Buenos_Aires')

            expect(result).toBe('23:00 - 00:00')
        })

        it('should handle half-hour slots', () => {
            const startAt = new Date('2026-01-15T12:30:00Z')
            const endAt = new Date('2026-01-15T13:00:00Z')
            const result = formatAppointmentTime(startAt, endAt, 'America/Argentina/Buenos_Aires')

            expect(result).toBe('09:30 - 10:00')
        })
    })
})

describe('formatDateForAgenda', () => {
    describe('basic formatting', () => {
        it('should format date with weekday, day, month and year', () => {
            const date = new Date('2026-01-15T12:00:00Z')
            const result = formatDateForAgenda(date, 'America/Argentina/Buenos_Aires')

            // Should contain day name (jueves), day number (15), month (enero), year (2026)
            expect(result.toLowerCase()).toContain('jueves')
            expect(result).toContain('15')
            expect(result.toLowerCase()).toContain('enero')
            expect(result).toContain('2026')
        })

        it('should handle string date input', () => {
            const isoString = '2026-01-15T12:00:00Z'
            const result = formatDateForAgenda(isoString, 'America/Argentina/Buenos_Aires')

            expect(result.toLowerCase()).toContain('jueves')
            expect(result).toContain('15')
        })

        it('should show correct day when date changes due to timezone', () => {
            // 02:00 UTC on Jan 15 = 23:00 on Jan 14 in Argentina (UTC-3)
            const date = new Date('2026-01-15T02:00:00Z')
            const result = formatDateForAgenda(date, 'America/Argentina/Buenos_Aires')

            // Should show January 14, not 15
            expect(result).toContain('14')
            expect(result.toLowerCase()).toContain('miércoles') // Wednesday
        })

        it('should handle UTC timezone', () => {
            const date = new Date('2026-01-15T12:00:00Z')
            const result = formatDateForAgenda(date, 'UTC')

            expect(result).toContain('15')
            expect(result.toLowerCase()).toContain('enero')
        })
    })
})
