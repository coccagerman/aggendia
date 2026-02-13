/**
 * Unit Tests - Subscription Policy
 *
 * Tests the state machine for subscription status transitions.
 * Pure logic — no DB, no providers, no side effects.
 */

import { describe, it, expect } from 'vitest'
import {
    isValidTransition,
    assertValidTransition,
    hasAppAccess,
    isWarningState
} from '@/domain/subscriptions/subscription.policy'
import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

describe('Subscription Policy', () => {
    describe('isValidTransition', () => {
        // Valid transitions
        it.each([
            ['TRIALING', 'ACTIVE'],
            ['TRIALING', 'EXPIRED'],
            ['ACTIVE', 'PAST_DUE'],
            ['ACTIVE', 'CANCELED'],
            ['PAST_DUE', 'ACTIVE'],
            ['PAST_DUE', 'EXPIRED'],
            ['PAST_DUE', 'CANCELED'],
            ['CANCELED', 'ACTIVE'],
            ['CANCELED', 'EXPIRED'],
            ['EXPIRED', 'ACTIVE']
        ] as const)('allows %s → %s', (from, to) => {
            expect(isValidTransition(from, to)).toBe(true)
        })

        // Invalid transitions
        it.each([
            ['TRIALING', 'PAST_DUE'],
            ['TRIALING', 'CANCELED'],
            ['ACTIVE', 'TRIALING'],
            ['ACTIVE', 'EXPIRED'],
            ['PAST_DUE', 'TRIALING'],
            ['CANCELED', 'TRIALING'],
            ['EXPIRED', 'TRIALING'],
            ['EXPIRED', 'PAST_DUE'],
            ['EXPIRED', 'CANCELED']
        ] as const)('rejects %s → %s', (from, to) => {
            expect(isValidTransition(from, to)).toBe(false)
        })
    })

    describe('assertValidTransition', () => {
        it('does not throw for valid transitions', () => {
            expect(() => assertValidTransition('TRIALING', 'ACTIVE')).not.toThrow()
        })

        it('throws AppError with INVALID_STATUS_TRANSITION for invalid transitions', () => {
            expect(() => assertValidTransition('TRIALING', 'CANCELED')).toThrow(AppError)
            try {
                assertValidTransition('TRIALING', 'CANCELED')
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).code).toBe(SubscriptionErrorCodes.INVALID_STATUS_TRANSITION)
            }
        })
    })

    describe('hasAppAccess', () => {
        it('grants access for TRIALING status', () => {
            expect(hasAppAccess('TRIALING')).toBe(true)
        })

        it('grants access for ACTIVE status', () => {
            expect(hasAppAccess('ACTIVE')).toBe(true)
        })

        it('grants access for PAST_DUE status (grace period)', () => {
            expect(hasAppAccess('PAST_DUE')).toBe(true)
        })

        it('grants access for CANCELED when cancelAt is in the future', () => {
            const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
            expect(hasAppAccess('CANCELED', futureDate)).toBe(true)
        })

        it('denies access for CANCELED when cancelAt is in the past', () => {
            const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
            expect(hasAppAccess('CANCELED', pastDate)).toBe(false)
        })

        it('denies access for CANCELED when cancelAt is null', () => {
            expect(hasAppAccess('CANCELED', null)).toBe(false)
        })

        it('denies access for EXPIRED status', () => {
            expect(hasAppAccess('EXPIRED')).toBe(false)
        })
    })

    describe('isWarningState', () => {
        it('returns true for TRIALING', () => {
            expect(isWarningState('TRIALING')).toBe(true)
        })

        it('returns true for PAST_DUE', () => {
            expect(isWarningState('PAST_DUE')).toBe(true)
        })

        it('returns true for CANCELED', () => {
            expect(isWarningState('CANCELED')).toBe(true)
        })

        it('returns false for other states', () => {
            expect(isWarningState('ACTIVE')).toBe(false)
            expect(isWarningState('EXPIRED')).toBe(false)
        })
    })
})
