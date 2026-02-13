/**
 * Payment provider factory.
 *
 * Returns the correct PaymentProvider implementation based on type.
 * Centralizes provider instantiation so consumers don't need
 * to know about concrete implementations.
 */

import type { PaymentProvider } from '@/domain/subscriptions/payment-provider'
import type { PaymentProviderType } from '@/domain/subscriptions/subscription.types'
import { StripeProvider } from './stripe/stripe.provider'
import { MercadoPagoProvider } from './mercadopago/mercadopago.provider'

const providers: Record<PaymentProviderType, () => PaymentProvider> = {
    STRIPE: () => new StripeProvider(),
    MERCADOPAGO: () => new MercadoPagoProvider()
}

/**
 * Get a PaymentProvider instance by type.
 * Default is STRIPE for the MVP.
 */
export function getPaymentProvider(type: PaymentProviderType = 'STRIPE'): PaymentProvider {
    return providers[type]()
}
