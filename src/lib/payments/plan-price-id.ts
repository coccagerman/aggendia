import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'
import type { PaymentProviderType } from '@/domain/subscriptions/subscription.types'

interface ResolvePlanPriceIdInput {
    provider: PaymentProviderType
    planSlug: string
    currency: 'ARS' | 'USD'
}

function resolveStripePriceId(planSlug: string): string {
    const normalizedSlug = planSlug.toLowerCase()

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
        `No hay Price ID configurado para el plan ${planSlug}. Configurá STRIPE_PRICE_ID_${normalizedSlug.toUpperCase()}.`,
        500
    )
}

function resolveMercadoPagoPlanId(planSlug: string, currency: 'ARS' | 'USD'): string {
    if (currency !== 'ARS') {
        throw new AppError(
            SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
            'Mercado Pago solo está habilitado para cobros en ARS.',
            400
        )
    }

    const normalizedSlug = planSlug.toLowerCase()

    if (normalizedSlug === 'base' && process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID_BASE_ARS) {
        return process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID_BASE_ARS
    }

    if (normalizedSlug === 'premium' && process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID_PREMIUM_ARS) {
        return process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID_PREMIUM_ARS
    }

    throw new AppError(
        SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
        `No hay Plan ID de Mercado Pago configurado para ${planSlug} en ARS.`,
        500
    )
}

export function resolvePlanPriceId(input: ResolvePlanPriceIdInput): string {
    if (input.provider === 'STRIPE') {
        return resolveStripePriceId(input.planSlug)
    }

    return resolveMercadoPagoPlanId(input.planSlug, input.currency)
}
