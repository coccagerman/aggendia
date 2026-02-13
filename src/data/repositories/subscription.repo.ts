/**
 * Repository for Subscription entity.
 *
 * Handles all DB operations for subscriptions.
 * No business logic here — only persistence.
 *
 * Key change: Subscription is now per-user (userId), not per-business.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import type {
    Subscription,
    SubscriptionStatus,
    TrialType,
    PaymentProviderType,
    ActivateSubscriptionInput
} from '@/domain/subscriptions/subscription.types'

// ============================================================================
// Queries
// ============================================================================

export async function getSubscriptionByUserId(prisma: PrismaClient, userId: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
        where: { userId }
    })
}

export async function getSubscriptionById(prisma: PrismaClient, subscriptionId: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
        where: { id: subscriptionId }
    })
}

export async function getSubscriptionByProviderSubscriptionId(
    prisma: PrismaClient,
    providerSubscriptionId: string
): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
        where: { providerSubscriptionId }
    })
}

export async function getSubscriptionByProviderCustomerId(
    prisma: PrismaClient,
    providerCustomerId: string
): Promise<Subscription | null> {
    return prisma.subscription.findFirst({
        where: { providerCustomerId }
    })
}

/**
 * Get all subscriptions that are currently trialing and expiring within a range.
 * Used by the trial warning cron job.
 * Returns userId so the caller can look up the user's email.
 */
export async function getTrialingSubscriptionsExpiringBetween(
    prisma: PrismaClient,
    from: Date,
    to: Date
): Promise<Subscription[]> {
    return prisma.subscription.findMany({
        where: {
            status: 'TRIALING',
            trialEndsAt: {
                gte: from,
                lte: to
            }
        }
    })
}

/**
 * Get all subscriptions that are trialing and past their trial end date.
 */
export async function getExpiredTrials(prisma: PrismaClient, now: Date): Promise<Subscription[]> {
    return prisma.subscription.findMany({
        where: {
            status: 'TRIALING',
            trialEndsAt: { lt: now }
        }
    })
}

/**
 * Get subscriptions in CANCELED status that have passed their cancelAt date.
 */
export async function getCanceledPastPeriodEnd(prisma: PrismaClient, now: Date): Promise<Subscription[]> {
    return prisma.subscription.findMany({
        where: {
            status: 'CANCELED',
            cancelAt: { lte: now }
        }
    })
}

/**
 * Get subscriptions in PAST_DUE status that have passed their grace period.
 */
export async function getPastDueExpiredGracePeriod(prisma: PrismaClient, now: Date): Promise<Subscription[]> {
    return prisma.subscription.findMany({
        where: {
            status: 'PAST_DUE',
            gracePeriodEndsAt: { lte: now }
        }
    })
}

// ============================================================================
// Mutations
// ============================================================================

export async function createSubscription(
    prisma: PrismaClient,
    input: {
        userId: string
        trialStartsAt: Date
        trialEndsAt: Date
        trialType: TrialType
        trialLinkId?: string
    }
): Promise<Subscription> {
    return prisma.subscription.create({
        data: {
            userId: input.userId,
            status: 'TRIALING',
            trialStartsAt: input.trialStartsAt,
            trialEndsAt: input.trialEndsAt,
            trialType: input.trialType,
            trialLinkId: input.trialLinkId ?? null
        }
    })
}

export async function updateSubscriptionStatus(
    prisma: PrismaClient,
    subscriptionId: string,
    status: SubscriptionStatus,
    additionalData?: Partial<{
        planId: string | null
        scheduledPlanId: string | null
        currentPeriodStart: Date | null
        currentPeriodEnd: Date | null
        scheduledPlanEffectiveAt: Date | null
        cancelAt: Date | null
        canceledAt: Date | null
        gracePeriodEndsAt: Date | null
        paymentProvider: PaymentProviderType | null
        providerCustomerId: string | null
        providerSubscriptionId: string | null
    }>
): Promise<Subscription> {
    return prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            status,
            ...additionalData
        }
    })
}

/**
 * Activate subscription after successful payment.
 * Transitions from TRIALING or EXPIRED to ACTIVE.
 */
export async function activateSubscription(
    prisma: PrismaClient,
    subscriptionId: string,
    input: ActivateSubscriptionInput
): Promise<Subscription> {
    return prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            status: 'ACTIVE',
            planId: input.planId,
            paymentProvider: input.provider,
            providerCustomerId: input.providerCustomerId,
            providerSubscriptionId: input.providerSubscriptionId,
            currentPeriodStart: input.currentPeriodStart,
            currentPeriodEnd: input.currentPeriodEnd,
            scheduledPlanId: null,
            scheduledPlanEffectiveAt: null,
            cancelAt: null,
            canceledAt: null,
            gracePeriodEndsAt: null
        }
    })
}

export async function scheduleSubscriptionPlanChange(
    prisma: PrismaClient,
    subscriptionId: string,
    input: {
        scheduledPlanId: string
        scheduledPlanEffectiveAt: Date
    }
): Promise<Subscription> {
    return prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
            scheduledPlanId: input.scheduledPlanId,
            scheduledPlanEffectiveAt: input.scheduledPlanEffectiveAt
        }
    })
}

/**
 * Used within a transaction (e.g., auth callback trial start).
 */
export async function createSubscriptionInTransaction(
    tx: Prisma.TransactionClient,
    input: {
        userId: string
        trialStartsAt: Date
        trialEndsAt: Date
        trialType: TrialType
        trialLinkId?: string
    }
): Promise<Subscription> {
    return tx.subscription.create({
        data: {
            userId: input.userId,
            status: 'TRIALING',
            trialStartsAt: input.trialStartsAt,
            trialEndsAt: input.trialEndsAt,
            trialType: input.trialType,
            trialLinkId: input.trialLinkId ?? null
        }
    })
}
