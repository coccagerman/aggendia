/**
 * Unit Tests - Subscription Types
 *
 * Tests for constants and type safety of subscription defaults.
 */

import { describe, it, expect } from 'vitest'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'

describe('Subscription Types', () => {
    describe('SUBSCRIPTION_DEFAULTS', () => {
        it('has a 30-day default trial', () => {
            expect(SUBSCRIPTION_DEFAULTS.DEFAULT_TRIAL_DAYS).toBe(30)
        })

        it('has a 60-day special trial', () => {
            expect(SUBSCRIPTION_DEFAULTS.SPECIAL_TRIAL_DAYS).toBe(60)
        })

        it('has warning days sorted in descending order', () => {
            const days = [...SUBSCRIPTION_DEFAULTS.TRIAL_WARNING_DAYS]
            const sorted = [...days].sort((a, b) => b - a)
            expect(days).toEqual(sorted)
        })

        it('includes day 0 in warning days (expiration day)', () => {
            expect(SUBSCRIPTION_DEFAULTS.TRIAL_WARNING_DAYS).toContain(0)
        })

        it('has a 3-day grace period', () => {
            expect(SUBSCRIPTION_DEFAULTS.GRACE_PERIOD_DAYS).toBe(3)
        })
    })
})
