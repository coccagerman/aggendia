/**
 * Domain types for subscriptions and payments.
 *
 * @see docs/data-model.md — Subscription, SubscriptionPlan, PaymentTransaction
 *
 * Key concepts:
 * - Subscription status is the internal source of truth (not the payment provider).
 * - A Business has exactly one Subscription (1:1).
 * - Trial is a subscription state, not a separate entity.
 */

// Re-export Prisma enums for domain use
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'
export type TrialType = 'STANDARD' | 'SPECIAL'
export type PaymentProviderType = 'STRIPE' | 'MERCADOPAGO'
export type PaymentTransactionType = 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'REFUND'
export type PaymentTransactionStatus = 'SUCCEEDED' | 'FAILED' | 'PENDING'
export type SubscriptionNotificationType =
    | 'TRIAL_EXPIRING'
    | 'TRIAL_EXPIRED'
    | 'PAYMENT_FAILED'
    | 'SUBSCRIPTION_CANCELED'

/**
 * Subscription entity (domain representation)
 */
export interface Subscription {
    id: string
    userId: string
    countryIso2: string | null
    accountTimezone: string | null
    planId: string | null
    scheduledPlanId: string | null
    status: SubscriptionStatus
    trialStartsAt: Date
    trialEndsAt: Date
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    scheduledPlanEffectiveAt: Date | null
    cancelAt: Date | null
    canceledAt: Date | null
    gracePeriodEndsAt: Date | null
    paymentProvider: PaymentProviderType | null
    providerCustomerId: string | null
    providerSubscriptionId: string | null
    trialType: TrialType
    trialLinkId: string | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Subscription plan entity
 */
export interface SubscriptionPlan {
    id: string
    name: string
    slug: string
    priceCents: number
    currency: string
    intervalMonths: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
}

/**
 * Payment transaction entity (log of all transactions)
 */
export interface PaymentTransaction {
    id: string
    subscriptionId: string
    provider: PaymentProviderType
    providerEventId: string
    providerPaymentId: string | null
    type: PaymentTransactionType
    amountCents: number
    currency: string
    status: PaymentTransactionStatus
    metadata: Record<string, unknown> | null
    createdAt: Date
}

/**
 * Trial link entity for special registration links
 */
export interface TrialLink {
    id: string
    code: string
    trialDays: number
    maxUses: number | null
    usedCount: number
    expiresAt: Date | null
    isActive: boolean
    metadata: Record<string, unknown> | null
    createdBy: string | null
    createdAt: Date
}

/**
 * Trial link usage record (audit trail)
 */
export interface TrialLinkUsage {
    id: string
    trialLinkId: string
    userId: string
    usedAt: Date
    convertedAt: Date | null
}

/**
 * Subscription notification entity
 */
export interface SubscriptionNotificationRecord {
    id: string
    subscriptionId: string
    userId: string
    type: SubscriptionNotificationType
    channel: 'EMAIL' | 'WHATSAPP'
    daysRemaining: number | null
    to: string
    status: 'PENDING' | 'SENT' | 'FAILED'
    sentAt: Date | null
    error: string | null
    createdAt: Date
}

// ============================================================================
// Inputs
// ============================================================================

export interface StartTrialInput {
    userId: string
    trialDays: number
    trialType: TrialType
    trialLinkId?: string
    ownerEmail: string
}

export interface ActivateSubscriptionInput {
    userId: string
    planId: string
    provider: PaymentProviderType
    providerCustomerId: string
    providerSubscriptionId: string
    currentPeriodStart: Date
    currentPeriodEnd: Date
}

export interface CancelSubscriptionInput {
    userId: string
    immediate: boolean
}

export interface CreateTrialLinkInput {
    code: string
    trialDays?: number
    maxUses?: number | null
    expiresAt?: Date | null
    metadata?: Record<string, unknown> | null
    createdBy?: string
}

export interface UpdateTrialLinkInput {
    isActive?: boolean
    maxUses?: number | null
    expiresAt?: Date | null
    metadata?: Record<string, unknown> | null
}

/**
 * Normalized payment event from any provider.
 * Providers normalize their webhooks into this shape
 * before passing to domain logic.
 */
export interface PaymentEvent {
    providerEventId: string
    provider: PaymentProviderType
    type: 'payment_succeeded' | 'payment_failed' | 'subscription_canceled' | 'subscription_updated'
    providerCustomerId: string
    providerSubscriptionId: string
    providerPaymentId?: string
    amountCents?: number
    currency?: string
    currentPeriodStart?: Date
    currentPeriodEnd?: Date
    cancelAtPeriodEnd?: boolean
    metadata?: Record<string, unknown>
}

// ============================================================================
// Config defaults (used when SubscriptionConfig table has no entry)
// ============================================================================

export const SUBSCRIPTION_DEFAULTS = {
    DEFAULT_TRIAL_DAYS: 30,
    SPECIAL_TRIAL_DAYS: 60,
    TRIAL_WARNING_DAYS: [7, 6, 5, 4, 3, 2, 1, 0],
    GRACE_PERIOD_DAYS: 3
} as const
