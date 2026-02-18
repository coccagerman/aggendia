import type { PaymentProviderType } from './subscription.types'

export interface PaymentRoutingDecision {
    provider: PaymentProviderType
    currency: 'ARS' | 'USD'
}

export function resolvePaymentRouting(countryIso2: string | null | undefined): PaymentRoutingDecision {
    const normalizedCountry = countryIso2?.trim().toUpperCase() ?? null

    if (normalizedCountry === 'AR') {
        return {
            provider: 'MERCADOPAGO',
            currency: 'ARS'
        }
    }

    return {
        provider: 'STRIPE',
        currency: 'USD'
    }
}
