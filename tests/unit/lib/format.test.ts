/**
 * Unit tests for format utility functions.
 * Tests formatPrice with various inputs.
 */

import { describe, it, expect } from 'vitest'
import { formatPrice } from '@/lib/format'

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
