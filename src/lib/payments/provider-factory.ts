/**
 * Payment provider factory.
 *
 * Returns the correct PaymentProvider implementation based on type.
 * Centralizes provider instantiation so consumers don't need
 * to know about concrete implementations.
 *
 * Currently only Stripe is active. The factory pattern is kept so a
 * second provider can be plugged in without touching domain logic.
 */

import type { PaymentProvider } from '@/domain/subscriptions/payment-provider'
import type { PaymentProviderType } from '@/domain/subscriptions/subscription.types'
import { StripeProvider } from './stripe/stripe.provider'

const providers: Partial<Record<PaymentProviderType, () => PaymentProvider>> = {
    STRIPE: () => new StripeProvider()
}

/**
 * Get a PaymentProvider instance by type.
 * Throws if the requested provider is not registered.
 */
export function getPaymentProvider(type: PaymentProviderType = 'STRIPE'): PaymentProvider {
    const factory = providers[type]
    if (!factory) {
        throw new Error(`Payment provider "${type}" is not registered.`)
    }
    return factory()
}
