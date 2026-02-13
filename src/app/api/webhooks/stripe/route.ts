/**
 * Stripe webhook endpoint
 *
 * Receives events from Stripe, verifies the signature, normalizes
 * them into domain PaymentEvents, and delegates to the subscription service.
 *
 * Key design decisions:
 * - Raw body is read with request.arrayBuffer() (Next.js doesn't parse webhooks)
 * - Signature verification via StripeProvider.constructWebhookEvent()
 * - Idempotency: duplicate events are silently ignored (paymentEventExists check)
 * - Only known event types are processed; others return 200 to avoid Stripe retries
 *
 * @see docs/flows.md — Stripe webhook flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { StripeProvider } from '@/lib/payments/stripe/stripe.provider'
import { isStripeEnabled } from '@/lib/payments/stripe/stripe.client'
import { paymentEventExists } from '@/data/repositories/payment-transaction.repo'
import {
    handlePaymentSucceeded,
    handlePaymentFailed,
    handleProviderSubscriptionCanceled
} from '@/domain/subscriptions/subscription.service'

const stripeProvider = new StripeProvider()

/**
 * POST /api/webhooks/stripe
 *
 * Stripe sends webhook events here. We MUST return 200 quickly
 * to avoid Stripe retrying the event.
 */
export async function POST(request: NextRequest) {
    if (!isStripeEnabled()) {
        console.error('[Webhook:Stripe] Stripe is not configured')
        return NextResponse.json(
            { error: { code: 'CONFIG_ERROR', message: 'Stripe is not configured' } },
            { status: 500 }
        )
    }

    // Read raw body for signature verification
    const rawBody = Buffer.from(await request.arrayBuffer())
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json(
            { error: { code: 'INVALID_REQUEST', message: 'Missing stripe-signature header' } },
            { status: 400 }
        )
    }

    // Verify signature and construct event
    let rawEvent: unknown
    try {
        rawEvent = await stripeProvider.constructWebhookEvent(rawBody, signature)
    } catch (error) {
        console.error('[Webhook:Stripe] Signature verification failed:', error)
        return NextResponse.json(
            { error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } },
            { status: 400 }
        )
    }

    // Normalize to domain event
    const event = stripeProvider.normalizeEvent(rawEvent)

    if (!event) {
        // Unknown event type — return 200 so Stripe doesn't retry
        return NextResponse.json({ data: { received: true, processed: false } })
    }

    console.info('[Webhook:Stripe] Processing event', {
        type: event.type,
        providerEventId: event.providerEventId
    })

    // Idempotency check — skip if we already processed this event
    const alreadyProcessed = await paymentEventExists(prisma, event.providerEventId)
    if (alreadyProcessed) {
        console.info('[Webhook:Stripe] Duplicate event, skipping', { providerEventId: event.providerEventId })
        return NextResponse.json({ data: { received: true, duplicate: true } })
    }

    // Process the event
    try {
        switch (event.type) {
            case 'payment_succeeded':
                await handlePaymentSucceeded(prisma, event)
                break

            case 'payment_failed':
                await handlePaymentFailed(prisma, event)
                break

            case 'subscription_canceled':
                await handleProviderSubscriptionCanceled(prisma, event)
                break
        }

        // Record the transaction for idempotency and audit trail
        // (handled internally by domain service handlers)
    } catch (error) {
        console.error('[Webhook:Stripe] Error processing event:', {
            type: event.type,
            providerEventId: event.providerEventId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })

        // Return 500 so Stripe retries the event
        return NextResponse.json(
            { error: { code: 'PROCESSING_ERROR', message: 'Error processing webhook event' } },
            { status: 500 }
        )
    }

    return NextResponse.json({ data: { received: true, processed: true } })
}
