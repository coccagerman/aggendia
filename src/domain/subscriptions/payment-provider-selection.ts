import type { PaymentProviderType } from './subscription.types'

export interface PaymentRoutingDecision {
    provider: PaymentProviderType
    currency: 'USD'
}

/**
 * Resolve which payment provider and currency to use.
 *
 * Currently always returns Stripe + USD regardless of country.
 * The routing infrastructure is preserved so a second provider
 * (e.g. MercadoPago for ARS) can be added later without refactoring
 * the checkout flow.
 */
export function resolvePaymentRouting(): PaymentRoutingDecision {
    return {
        provider: 'STRIPE',
        currency: 'USD'
    }
}
