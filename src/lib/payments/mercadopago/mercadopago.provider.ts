/**
 * MercadoPago provider stub.
 *
 * Implements PaymentProvider interface but throws "not implemented" errors.
 * Structure is ready for when MercadoPago integration is needed.
 */

import type {
    PaymentProvider,
    CreateProviderCustomerInput,
    ProviderCustomer,
    CreateCheckoutSessionInput,
    CheckoutSession,
    CancelProviderSubscriptionInput,
    ChangeProviderSubscriptionPlanInput,
    ReactivateProviderSubscriptionInput
} from '@/domain/subscriptions/payment-provider'
import type { PaymentEvent } from '@/domain/subscriptions/subscription.types'

export class MercadoPagoProvider implements PaymentProvider {
    readonly type = 'MERCADOPAGO' as const

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async createCustomer(input: CreateProviderCustomerInput): Promise<ProviderCustomer> {
        throw new Error('MercadoPago provider not implemented yet')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
        throw new Error('MercadoPago provider not implemented yet')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async cancelSubscription(input: CancelProviderSubscriptionInput): Promise<void> {
        throw new Error('MercadoPago provider not implemented yet')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async changeSubscriptionPlan(input: ChangeProviderSubscriptionPlanInput): Promise<void> {
        throw new Error('MercadoPago provider not implemented yet')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async reactivateSubscription(input: ReactivateProviderSubscriptionInput): Promise<void> {
        throw new Error('MercadoPago provider not implemented yet')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async constructWebhookEvent(payload: Buffer, signature: string): Promise<unknown> {
        throw new Error('MercadoPago provider not implemented yet')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    normalizeEvent(rawEvent: unknown): PaymentEvent | null {
        throw new Error('MercadoPago provider not implemented yet')
    }
}
