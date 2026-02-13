/**
 * Stripe client singleton.
 *
 * Similar pattern to src/lib/resend/client.ts — lazy init, graceful degradation
 * when env vars are not configured.
 */

import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!STRIPE_SECRET_KEY) {
    console.warn('[Stripe] STRIPE_SECRET_KEY not configured — Stripe payments will be disabled')
}

if (!STRIPE_WEBHOOK_SECRET) {
    console.warn('[Stripe] STRIPE_WEBHOOK_SECRET not configured — webhook verification will fail')
}

/**
 * Singleton Stripe client instance. Returns null if API key not configured.
 */
export const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' }) : null

/**
 * Webhook signing secret for verifying Stripe webhook payloads.
 */
export const stripeWebhookSecret = STRIPE_WEBHOOK_SECRET ?? ''

/**
 * Check if Stripe payments are enabled.
 */
export function isStripeEnabled(): boolean {
    return stripe !== null
}
