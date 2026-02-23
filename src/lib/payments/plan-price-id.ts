import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

interface ResolvePlanPriceIdInput {
    planSlug: string
}

/**
 * Resolve the Stripe Price ID for a given plan slug.
 * Reads from environment variables STRIPE_PRICE_ID_BASE / STRIPE_PRICE_ID_PREMIUM.
 */
export function resolvePlanPriceId(input: ResolvePlanPriceIdInput): string {
    const normalizedSlug = input.planSlug.toLowerCase()

    if (normalizedSlug === 'base' && process.env.STRIPE_PRICE_ID_BASE) {
        return process.env.STRIPE_PRICE_ID_BASE
    }

    if (normalizedSlug === 'premium' && process.env.STRIPE_PRICE_ID_PREMIUM) {
        return process.env.STRIPE_PRICE_ID_PREMIUM
    }

    if (process.env.STRIPE_PRICE_ID) {
        return process.env.STRIPE_PRICE_ID
    }

    throw new AppError(
        SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
        `No hay Price ID configurado para el plan ${input.planSlug}. Configurá STRIPE_PRICE_ID_${normalizedSlug.toUpperCase()}.`,
        500
    )
}
