import { describe, expect, it } from 'vitest'
import { resolvePaymentRouting } from '@/domain/subscriptions/payment-provider-selection'

describe('resolvePaymentRouting', () => {
    it('uses Mercado Pago + ARS for Argentina', () => {
        expect(resolvePaymentRouting('AR')).toEqual({
            provider: 'MERCADOPAGO',
            currency: 'ARS'
        })
    })

    it('uses Stripe + USD for non-Argentina countries', () => {
        expect(resolvePaymentRouting('US')).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })

        expect(resolvePaymentRouting('CL')).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })
    })

    it('defaults to Stripe + USD when country is missing', () => {
        expect(resolvePaymentRouting(null)).toEqual({
            provider: 'STRIPE',
            currency: 'USD'
        })
    })
})
