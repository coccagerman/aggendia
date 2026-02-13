/**
 * Payment Provider interface (Strategy Pattern).
 *
 * This is the core abstraction that decouples the subscription domain
 * from specific payment providers (Stripe, MercadoPago, etc.).
 *
 * Each provider implements this interface. The domain service
 * receives it via injection and never imports provider SDKs directly.
 *
 * Why Strategy Pattern here?
 * - Allows switching providers per business or per region without touching domain logic.
 * - Each provider encapsulates its own API quirks (webhooks, signatures, flows).
 * - Makes testing trivial: inject a mock provider in tests.
 */

import { PaymentEvent, PaymentProviderType } from './subscription.types'

/**
 * Input for creating a customer in the payment provider
 */
export interface CreateProviderCustomerInput {
    email: string
    businessId: string
    businessName: string
}

/**
 * Result of customer creation
 */
export interface ProviderCustomer {
    providerCustomerId: string
}

/**
 * Input for creating a checkout session
 */
export interface CreateCheckoutSessionInput {
    providerCustomerId: string
    planPriceId: string
    businessId: string
    successUrl: string
    cancelUrl: string
}

/**
 * Result of checkout session creation
 */
export interface CheckoutSession {
    sessionId: string
    checkoutUrl: string
}

/**
 * Input for canceling a subscription in the provider
 */
export interface CancelProviderSubscriptionInput {
    providerSubscriptionId: string
    immediate: boolean
}

/**
 * The PaymentProvider interface that all providers must implement.
 */
export interface PaymentProvider {
    readonly type: PaymentProviderType

    /**
     * Create a customer record in the payment provider.
     */
    createCustomer(input: CreateProviderCustomerInput): Promise<ProviderCustomer>

    /**
     * Create a checkout session for the customer to complete payment.
     * Returns a URL to redirect the user to.
     */
    createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession>

    /**
     * Cancel a subscription in the provider.
     * If immediate=false, cancels at end of current billing period.
     */
    cancelSubscription(input: CancelProviderSubscriptionInput): Promise<void>

    /**
     * Verify and parse a webhook payload from the provider.
     * Each provider has its own signature verification mechanism.
     */
    constructWebhookEvent(payload: Buffer, signature: string): Promise<unknown>

    /**
     * Normalize a provider-specific webhook event into a domain PaymentEvent.
     * Returns null if the event type is not relevant to us.
     */
    normalizeEvent(rawEvent: unknown): PaymentEvent | null
}
