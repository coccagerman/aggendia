import { describe, expect, it } from 'vitest'
import { resolvePaymentRouting } from '@/domain/subscriptions/payment-provider-selection'

describe('resolvePaymentRouting', () => {
    it('uses Stripe + USD for all countries (single-provider mode)', () => {
        expect(resolvePaymentRouting()).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })

        expect(resolvePaymentRouting()).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })

        expect(resolvePaymentRouting()).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })
    })

    it('returns Stripe + USD in single-provider mode', () => {
        expect(resolvePaymentRouting()).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })
    })
})
