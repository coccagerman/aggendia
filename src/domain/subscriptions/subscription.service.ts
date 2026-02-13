/**
 * Domain service for subscriptions.
 *
 * Core business logic for the subscription lifecycle:
 * - Trial management (start, expire, warn)
 * - Payment processing (from provider webhooks)
 * - Cancellation (immediate or at period end)
 * - Access checks
 *
 * Key design decision: This service is the SINGLE source of truth
 * for subscription state. Payment providers inform us via webhooks,
 * but we decide the state transitions internally.
 *
 * This service does NOT import Next.js, Prisma models, or provider SDKs.
 * It receives a PrismaClient for persistence (repos handle the queries).
 */

import { PrismaClient } from '@prisma/client'
import type {
    Subscription,
    PaymentEvent,
    CancelSubscriptionInput,
    TrialType,
    SubscriptionStatus
} from './subscription.types'
import { assertValidTransition, hasAppAccess } from './subscription.policy'
import { SubscriptionErrorCodes } from './subscription.errors'
import { AppError } from '@/domain/common/errors'
import {
    getSubscriptionByUserId,
    getSubscriptionByProviderSubscriptionId,
    getSubscriptionByProviderCustomerId,
    updateSubscriptionStatus,
    activateSubscription as activateSubscriptionRepo,
    getExpiredTrials,
    getCanceledPastPeriodEnd,
    getPastDueExpiredGracePeriod,
    createSubscription as createSubscriptionRepo
} from '@/data/repositories/subscription.repo'
import { paymentEventExists, createPaymentTransaction } from '@/data/repositories/payment-transaction.repo'
import { getGracePeriodDays } from '@/data/repositories/subscription-config.repo'
import { markTrialLinkUsageConverted } from '@/data/repositories/trial-link.repo'

// ============================================================================
// Trial management
// ============================================================================

/**
 * Start a trial for a user.
 * Called when a user first signs up (from auth callback).
 */
export async function startTrial(
    prisma: PrismaClient,
    userId: string,
    trialDays: number,
    trialType: TrialType,
    trialLinkId?: string
): Promise<Subscription> {
    // Check if subscription already exists
    const existing = await getSubscriptionByUserId(prisma, userId)
    if (existing) {
        throw new AppError(
            SubscriptionErrorCodes.SUBSCRIPTION_ALREADY_EXISTS,
            'Este usuario ya tiene una suscripción.',
            409
        )
    }

    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)

    return createSubscriptionRepo(prisma, {
        userId,
        trialStartsAt: now,
        trialEndsAt,
        trialType,
        trialLinkId
    })
}

// ============================================================================
// Payment event handling (from webhooks)
// ============================================================================

/**
 * Handle a payment succeeded event from a provider webhook.
 *
 * Possible transitions:
 * - TRIALING → ACTIVE (first payment)
 * - PAST_DUE → ACTIVE (successful retry)
 * - EXPIRED → ACTIVE (reactivation)
 */
export async function handlePaymentSucceeded(prisma: PrismaClient, event: PaymentEvent): Promise<void> {
    // Idempotency check
    const alreadyProcessed = await paymentEventExists(prisma, event.providerEventId)
    if (alreadyProcessed) {
        console.info(`[Subscription] Payment event already processed: ${event.providerEventId}`)
        return
    }

    // Find subscription by provider subscription ID or customer ID
    let subscription = await getSubscriptionByProviderSubscriptionId(prisma, event.providerSubscriptionId)
    if (!subscription) {
        subscription = await getSubscriptionByProviderCustomerId(prisma, event.providerCustomerId)
    }

    if (!subscription) {
        console.warn(`[Subscription] No subscription found for provider event: ${event.providerEventId}`)
        return
    }

    // Record the transaction
    await createPaymentTransaction(prisma, {
        subscriptionId: subscription.id,
        provider: event.provider,
        providerEventId: event.providerEventId,
        providerPaymentId: event.providerPaymentId ?? null,
        type: 'PAYMENT_SUCCEEDED',
        amountCents: event.amountCents ?? 0,
        currency: event.currency ?? 'USD',
        status: 'SUCCEEDED',
        metadata: event.metadata ?? null
    })

    // Transition to ACTIVE if not already
    if (subscription.status === 'ACTIVE') {
        // Just update period dates if provided
        if (event.currentPeriodStart || event.currentPeriodEnd) {
            await updateSubscriptionStatus(prisma, subscription.id, 'ACTIVE', {
                currentPeriodStart: event.currentPeriodStart ?? subscription.currentPeriodStart,
                currentPeriodEnd: event.currentPeriodEnd ?? subscription.currentPeriodEnd
            })
        }
        return
    }

    // Validate transition
    const targetStatus: SubscriptionStatus = 'ACTIVE'
    assertValidTransition(subscription.status, targetStatus)

    await activateSubscriptionRepo(prisma, subscription.id, {
        userId: subscription.userId,
        planId: subscription.planId ?? '',
        provider: event.provider,
        providerCustomerId: event.providerCustomerId,
        providerSubscriptionId: event.providerSubscriptionId,
        currentPeriodStart: event.currentPeriodStart ?? new Date(),
        currentPeriodEnd: event.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    })

    // Mark trial link usage as converted (for metrics)
    if (subscription.trialLinkId) {
        await markTrialLinkUsageConverted(prisma, subscription.userId)
    }

    console.info(`[Subscription] Activated: ${subscription.id} (user: ${subscription.userId})`)
}

/**
 * Handle a payment failed event from a provider webhook.
 *
 * Transition: ACTIVE → PAST_DUE (with grace period)
 */
export async function handlePaymentFailed(prisma: PrismaClient, event: PaymentEvent): Promise<void> {
    const alreadyProcessed = await paymentEventExists(prisma, event.providerEventId)
    if (alreadyProcessed) return

    const subscription = await getSubscriptionByProviderSubscriptionId(prisma, event.providerSubscriptionId)
    if (!subscription) {
        console.warn(`[Subscription] No subscription found for failed payment: ${event.providerEventId}`)
        return
    }

    await createPaymentTransaction(prisma, {
        subscriptionId: subscription.id,
        provider: event.provider,
        providerEventId: event.providerEventId,
        providerPaymentId: event.providerPaymentId ?? null,
        type: 'PAYMENT_FAILED',
        amountCents: event.amountCents ?? 0,
        currency: event.currency ?? 'USD',
        status: 'FAILED',
        metadata: event.metadata ?? null
    })

    if (subscription.status !== 'ACTIVE') {
        console.info(`[Subscription] Payment failed but status is ${subscription.status}, skipping transition`)
        return
    }

    assertValidTransition('ACTIVE', 'PAST_DUE')

    const gracePeriodDays = await getGracePeriodDays(prisma)
    const gracePeriodEndsAt = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)

    await updateSubscriptionStatus(prisma, subscription.id, 'PAST_DUE', {
        gracePeriodEndsAt
    })

    console.info(`[Subscription] PAST_DUE: ${subscription.id} (grace until: ${gracePeriodEndsAt.toISOString()})`)
}

/**
 * Handle a subscription canceled event from a provider webhook.
 * This means the provider has terminated the subscription (e.g. after failed retries).
 */
export async function handleProviderSubscriptionCanceled(prisma: PrismaClient, event: PaymentEvent): Promise<void> {
    const alreadyProcessed = await paymentEventExists(prisma, event.providerEventId)
    if (alreadyProcessed) return

    const subscription = await getSubscriptionByProviderSubscriptionId(prisma, event.providerSubscriptionId)
    if (!subscription) return

    await createPaymentTransaction(prisma, {
        subscriptionId: subscription.id,
        provider: event.provider,
        providerEventId: event.providerEventId,
        type: 'PAYMENT_FAILED',
        amountCents: 0,
        currency: 'USD',
        status: 'FAILED',
        metadata: event.metadata ?? null
    })

    // If already expired or canceled, nothing to do
    if (subscription.status === 'EXPIRED' || subscription.status === 'CANCELED') {
        return
    }

    await updateSubscriptionStatus(prisma, subscription.id, 'EXPIRED')

    console.info(`[Subscription] Expired by provider: ${subscription.id}`)
}

// ============================================================================
// User-initiated cancellation
// ============================================================================

/**
 * Cancel a subscription by user request.
 *
 * If immediate=true: transition to EXPIRED now.
 * If immediate=false: set cancelAt to currentPeriodEnd and mark CANCELED.
 */
export async function cancelSubscription(prisma: PrismaClient, input: CancelSubscriptionInput): Promise<Subscription> {
    const subscription = await getSubscriptionByUserId(prisma, input.userId)
    if (!subscription) {
        throw new AppError(SubscriptionErrorCodes.SUBSCRIPTION_NOT_FOUND, 'No se encontró la suscripción.', 404)
    }

    if (input.immediate) {
        // Immediate cancellation → EXPIRED
        if (subscription.status === 'TRIALING') {
            assertValidTransition('TRIALING', 'EXPIRED')
        } else if (subscription.status === 'ACTIVE') {
            // ACTIVE → CANCELED → EXPIRED (we skip the intermediate state)
            // This is valid because the user explicitly wants immediate cancellation
        } else if (subscription.status === 'PAST_DUE') {
            assertValidTransition('PAST_DUE', 'EXPIRED')
        } else {
            throw new AppError(
                SubscriptionErrorCodes.INVALID_STATUS_TRANSITION,
                `No se puede cancelar una suscripción en estado ${subscription.status}.`,
                400
            )
        }

        return updateSubscriptionStatus(prisma, subscription.id, 'EXPIRED', {
            canceledAt: new Date(),
            cancelAt: null
        })
    } else {
        // Cancel at end of period
        if (subscription.status === 'TRIALING') {
            // For trials, cancel at trial end
            assertValidTransition('TRIALING', 'EXPIRED')
            return updateSubscriptionStatus(prisma, subscription.id, 'EXPIRED', {
                canceledAt: new Date()
            })
        }

        if (subscription.status !== 'ACTIVE' && subscription.status !== 'PAST_DUE') {
            throw new AppError(
                SubscriptionErrorCodes.INVALID_STATUS_TRANSITION,
                `No se puede cancelar una suscripción en estado ${subscription.status}.`,
                400
            )
        }

        assertValidTransition(subscription.status, 'CANCELED')

        const cancelAt = subscription.currentPeriodEnd ?? new Date()

        return updateSubscriptionStatus(prisma, subscription.id, 'CANCELED', {
            canceledAt: new Date(),
            cancelAt
        })
    }
}

// ============================================================================
// Access check
// ============================================================================

/**
 * Check if a user can access the app based on subscription status.
 * Returns the subscription for additional context (e.g., showing warning banners).
 */
export async function checkUserAccess(
    prisma: PrismaClient,
    userId: string
): Promise<{ allowed: boolean; subscription: Subscription | null; reason?: string }> {
    const subscription = await getSubscriptionByUserId(prisma, userId)

    // No subscription record → deny (should not happen after migration)
    if (!subscription) {
        return {
            allowed: false,
            subscription: null,
            reason: 'NO_SUBSCRIPTION'
        }
    }

    const allowed = hasAppAccess(subscription.status, subscription.cancelAt)

    return {
        allowed,
        subscription,
        reason: allowed ? undefined : `SUBSCRIPTION_${subscription.status}`
    }
}

/**
 * Get subscription status for a user.
 * Convenience wrapper used by API routes and middleware.
 */
export async function getSubscriptionStatus(prisma: PrismaClient, userId: string): Promise<Subscription | null> {
    return getSubscriptionByUserId(prisma, userId)
}

// ============================================================================
// Cron: Process expired trials and grace periods
// ============================================================================

/**
 * Process all expired trials — transitions TRIALING → EXPIRED.
 * Called by the trial warnings cron job.
 */
export async function processExpiredTrials(prisma: PrismaClient, now?: Date): Promise<{ expired: number }> {
    const currentTime = now ?? new Date()
    const expiredTrials = await getExpiredTrials(prisma, currentTime)

    let expiredCount = 0
    for (const sub of expiredTrials) {
        try {
            await updateSubscriptionStatus(prisma, sub.id, 'EXPIRED')
            expiredCount++
            console.info(`[Subscription] Trial expired: ${sub.id} (user: ${sub.userId})`)
        } catch (error) {
            console.error(`[Subscription] Error expiring trial ${sub.id}:`, error)
        }
    }

    return { expired: expiredCount }
}

/**
 * Process canceled subscriptions past their period end → EXPIRED.
 */
export async function processCanceledExpired(prisma: PrismaClient, now?: Date): Promise<{ expired: number }> {
    const currentTime = now ?? new Date()
    const canceled = await getCanceledPastPeriodEnd(prisma, currentTime)

    let expiredCount = 0
    for (const sub of canceled) {
        try {
            await updateSubscriptionStatus(prisma, sub.id, 'EXPIRED')
            expiredCount++
        } catch (error) {
            console.error(`[Subscription] Error expiring canceled sub ${sub.id}:`, error)
        }
    }

    return { expired: expiredCount }
}

/**
 * Process PAST_DUE subscriptions past their grace period → EXPIRED.
 */
export async function processPastDueExpired(prisma: PrismaClient, now?: Date): Promise<{ expired: number }> {
    const currentTime = now ?? new Date()
    const pastDue = await getPastDueExpiredGracePeriod(prisma, currentTime)

    let expiredCount = 0
    for (const sub of pastDue) {
        try {
            await updateSubscriptionStatus(prisma, sub.id, 'EXPIRED')
            expiredCount++
        } catch (error) {
            console.error(`[Subscription] Error expiring past_due sub ${sub.id}:`, error)
        }
    }

    return { expired: expiredCount }
}
