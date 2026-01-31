/**
 * Unit tests for phone normalization utilities
 * @see src/lib/phone.ts
 * @see docs/user-stories.md - US-10.2, US-10.6
 */

import { describe, it, expect } from 'vitest'
import { normalizeToE164, isValidE164 } from '@/lib/phone'

describe('normalizeToE164', () => {
    describe('valid phone numbers with country code', () => {
        it('should normalize Argentina mobile number', () => {
            expect(normalizeToE164('+5491155667788')).toBe('+5491155667788')
        })

        it('should remove spaces from phone number', () => {
            expect(normalizeToE164('+54 9 11 5566 7788')).toBe('+5491155667788')
        })

        it('should remove dashes from phone number', () => {
            expect(normalizeToE164('+54-9-11-5566-7788')).toBe('+5491155667788')
        })

        it('should remove parentheses from phone number', () => {
            expect(normalizeToE164('+54 (9) 11 5566-7788')).toBe('+5491155667788')
        })

        it('should handle US phone number', () => {
            expect(normalizeToE164('+1 555 123 4567')).toBe('+15551234567')
        })

        it('should handle Brazilian phone number', () => {
            expect(normalizeToE164('+55 11 98765 4321')).toBe('+5511987654321')
        })

        it('should handle phone with dots', () => {
            expect(normalizeToE164('+54.9.11.5566.7788')).toBe('+5491155667788')
        })
    })

    describe('invalid phone numbers', () => {
        it('should return null for null input', () => {
            expect(normalizeToE164(null)).toBeNull()
        })

        it('should return null for undefined input', () => {
            expect(normalizeToE164(undefined)).toBeNull()
        })

        it('should return null for empty string', () => {
            expect(normalizeToE164('')).toBeNull()
        })

        it('should return null for whitespace only', () => {
            expect(normalizeToE164('   ')).toBeNull()
        })

        it('should return null for phone without country code', () => {
            // Phone must have + prefix - we don't assume country code
            expect(normalizeToE164('1155667788')).toBeNull()
        })

        it('should return null for phone with only local number', () => {
            expect(normalizeToE164('55667788')).toBeNull()
        })

        it('should return null for too short phone number', () => {
            expect(normalizeToE164('+123456')).toBeNull() // Less than 8 digits
        })

        it('should return null for too long phone number', () => {
            expect(normalizeToE164('+1234567890123456')).toBeNull() // More than 15 digits
        })
    })

    describe('edge cases', () => {
        it('should handle minimum valid length (8 digits)', () => {
            expect(normalizeToE164('+12345678')).toBe('+12345678')
        })

        it('should handle maximum valid length (15 digits)', () => {
            expect(normalizeToE164('+123456789012345')).toBe('+123456789012345')
        })

        it('should handle phone with leading/trailing spaces', () => {
            expect(normalizeToE164('  +5491155667788  ')).toBe('+5491155667788')
        })
    })
})

describe('isValidE164', () => {
    describe('valid E.164 numbers', () => {
        it('should return true for valid Argentina number', () => {
            expect(isValidE164('+5491155667788')).toBe(true)
        })

        it('should return true for valid US number', () => {
            expect(isValidE164('+15551234567')).toBe(true)
        })

        it('should return true for minimum length', () => {
            expect(isValidE164('+12345678')).toBe(true)
        })

        it('should return true for maximum length', () => {
            expect(isValidE164('+123456789012345')).toBe(true)
        })
    })

    describe('invalid E.164 numbers', () => {
        it('should return false for null', () => {
            expect(isValidE164(null)).toBe(false)
        })

        it('should return false for undefined', () => {
            expect(isValidE164(undefined)).toBe(false)
        })

        it('should return false for empty string', () => {
            expect(isValidE164('')).toBe(false)
        })

        it('should return false for number without plus', () => {
            expect(isValidE164('5491155667788')).toBe(false)
        })

        it('should return false for number with spaces', () => {
            expect(isValidE164('+54 9 11 5566 7788')).toBe(false)
        })

        it('should return false for too short', () => {
            expect(isValidE164('+1234567')).toBe(false)
        })

        it('should return false for too long', () => {
            expect(isValidE164('+1234567890123456')).toBe(false)
        })

        it('should return false for number with letters', () => {
            expect(isValidE164('+54911ABC7788')).toBe(false)
        })
    })
})
