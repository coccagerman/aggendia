/**
 * Stripe implementation of the PaymentProvider interface.
 *
 * Encapsulates all Stripe-specific logic:
 * - Customer creation
 * - Checkout session creation
 * - Subscription cancellation
 * - Webhook event verification and normalization
 *
 * The domain layer never imports Stripe directly — only this provider.
 */

import Stripe from 'stripe'
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
import { stripe, stripeWebhookSecret } from './stripe.client'
import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

export class StripeProvider implements PaymentProvider {
    readonly type = 'STRIPE' as const

    private getClient(): Stripe {
        if (!stripe) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'Stripe is not configured. Set STRIPE_SECRET_KEY.',
                500
            )
        }
        return stripe
    }

    async createCustomer(input: CreateProviderCustomerInput): Promise<ProviderCustomer> {
        const client = this.getClient()

        const customer = await client.customers.create({
            email: input.email,
            metadata: {
                businessId: input.businessId,
                businessName: input.businessName
            }
        })

        return { providerCustomerId: customer.id }
    }

    async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSession> {
        const client = this.getClient()

        const session = await client.checkout.sessions.create({
            customer: input.providerCustomerId,
            mode: 'subscription',
            line_items: [
                {
                    price: input.planPriceId,
                    quantity: 1
                }
            ],
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            metadata: {
                businessId: input.businessId
            }
        })

        if (!session.url) {
            throw new AppError(
                SubscriptionErrorCodes.CHECKOUT_SESSION_FAILED,
                'Stripe checkout session URL not available.',
                500
            )
        }

        return {
            sessionId: session.id,
            checkoutUrl: session.url
        }
    }

    async cancelSubscription(input: CancelProviderSubscriptionInput): Promise<void> {
        const client = this.getClient()

        if (input.immediate) {
            await client.subscriptions.cancel(input.providerSubscriptionId)
        } else {
            await client.subscriptions.update(input.providerSubscriptionId, {
                cancel_at_period_end: true
            })
        }
    }

    async changeSubscriptionPlan(input: ChangeProviderSubscriptionPlanInput): Promise<void> {
        const client = this.getClient()

        const subscription = await client.subscriptions.retrieve(input.providerSubscriptionId)
        const currentItem = subscription.items.data[0]

        if (!currentItem) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'No se encontró el ítem de suscripción en Stripe para cambiar de plan.',
                500
            )
        }

        await client.subscriptions.update(input.providerSubscriptionId, {
            items: [
                {
                    id: currentItem.id,
                    price: input.newPlanPriceId
                }
            ],
            proration_behavior: input.effective === 'immediate_prorated' ? 'always_invoice' : 'none'
        })
    }

    async reactivateSubscription(input: ReactivateProviderSubscriptionInput): Promise<void> {
        const client = this.getClient()

        await client.subscriptions.update(input.providerSubscriptionId, {
            cancel_at_period_end: false,
            proration_behavior: 'none'
        })
    }

    async constructWebhookEvent(payload: Buffer, signature: string): Promise<unknown> {
        const client = this.getClient()

        if (!stripeWebhookSecret) {
            throw new AppError(
                SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
                'Stripe webhook secret not configured.',
                500
            )
        }

        return client.webhooks.constructEvent(payload, signature, stripeWebhookSecret)
    }

    /**
     * Normalize a Stripe event into a domain PaymentEvent.
     * Returns null for event types we don't care about.
     *
     * Events we handle:
     * - checkout.session.completed → triggers subscription activation
     * - invoice.payment_succeeded → payment confirmation
     * - invoice.payment_failed → payment failure
     * - customer.subscription.deleted → subscription canceled by provider
     */
    normalizeEvent(rawEvent: unknown): PaymentEvent | null {
        const event = rawEvent as Stripe.Event

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                if (session.mode !== 'subscription' || !session.subscription || !session.customer) {
                    return null
                }
                return {
                    providerEventId: event.id,
                    provider: 'STRIPE',
                    type: 'payment_succeeded',
                    providerCustomerId: typeof session.customer === 'string' ? session.customer : session.customer.id,
                    providerSubscriptionId:
                        typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
                    amountCents: session.amount_total ?? undefined,
                    currency: session.currency?.toUpperCase(),
                    metadata: session.metadata ? { ...session.metadata } : undefined
                }
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice
                // Stripe v20: subscription moved to invoice.parent.subscription_details
                const subDetails = invoice.parent?.subscription_details
                if (!subDetails?.subscription || !invoice.customer) return null
                const subId =
                    typeof subDetails.subscription === 'string' ? subDetails.subscription : subDetails.subscription.id
                // payment_intent is now on InvoicePayment.payment
                const firstPayment = invoice.payments?.data?.[0]
                const paymentIntentId = firstPayment?.payment?.payment_intent
                    ? typeof firstPayment.payment.payment_intent === 'string'
                        ? firstPayment.payment.payment_intent
                        : firstPayment.payment.payment_intent.id
                    : undefined
                return {
                    providerEventId: event.id,
                    provider: 'STRIPE',
                    type: 'payment_succeeded',
                    providerCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id,
                    providerSubscriptionId: subId,
                    providerPaymentId: paymentIntentId,
                    amountCents: invoice.amount_paid,
                    currency: invoice.currency?.toUpperCase(),
                    currentPeriodStart: invoice.lines?.data?.[0]?.period?.start
                        ? new Date(invoice.lines.data[0].period.start * 1000)
                        : undefined,
                    currentPeriodEnd: invoice.lines?.data?.[0]?.period?.end
                        ? new Date(invoice.lines.data[0].period.end * 1000)
                        : undefined
                }
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice
                const subDetails = invoice.parent?.subscription_details
                if (!subDetails?.subscription || !invoice.customer) return null
                const subId =
                    typeof subDetails.subscription === 'string' ? subDetails.subscription : subDetails.subscription.id
                return {
                    providerEventId: event.id,
                    provider: 'STRIPE',
                    type: 'payment_failed',
                    providerCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id,
                    providerSubscriptionId: subId,
                    amountCents: invoice.amount_due,
                    currency: invoice.currency?.toUpperCase()
                }
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                return {
                    providerEventId: event.id,
                    provider: 'STRIPE',
                    type: 'subscription_canceled',
                    providerCustomerId:
                        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
                    providerSubscriptionId: subscription.id
                }
            }

            default:
                return null
        }
    }
}
