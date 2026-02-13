/**
 * Domain events for subscriptions.
 *
 * Events represent things that happened in the subscription lifecycle.
 * Today they're dispatched synchronously within the service;
 * the typed structure allows migrating to an event bus later if needed.
 *
 * @see subscription.service.ts — where events are emitted
 */

import { PaymentProviderType, SubscriptionStatus, TrialType } from './subscription.types'

// ============================================================================
// Event types
// ============================================================================

export interface TrialStartedEvent {
    type: 'TRIAL_STARTED'
    userId: string
    trialEndsAt: Date
    trialType: TrialType
    trialLinkId?: string
}

export interface TrialExpiringEvent {
    type: 'TRIAL_EXPIRING'
    userId: string
    subscriptionId: string
    daysRemaining: number
    trialEndsAt: Date
    ownerEmail: string
}

export interface TrialExpiredEvent {
    type: 'TRIAL_EXPIRED'
    userId: string
    subscriptionId: string
    ownerEmail: string
}

export interface PaymentSucceededEvent {
    type: 'PAYMENT_SUCCEEDED'
    userId: string
    subscriptionId: string
    amountCents: number
    currency: string
    provider: PaymentProviderType
}

export interface PaymentFailedEvent {
    type: 'PAYMENT_FAILED'
    userId: string
    subscriptionId: string
    provider: PaymentProviderType
    reason?: string
}

export interface SubscriptionActivatedEvent {
    type: 'SUBSCRIPTION_ACTIVATED'
    userId: string
    subscriptionId: string
    planId: string
    previousStatus: SubscriptionStatus
}

export interface SubscriptionCanceledEvent {
    type: 'SUBSCRIPTION_CANCELED'
    userId: string
    subscriptionId: string
    cancelAt: Date | null
    immediate: boolean
}

export interface SubscriptionExpiredEvent {
    type: 'SUBSCRIPTION_EXPIRED'
    userId: string
    subscriptionId: string
    previousStatus: SubscriptionStatus
}

export interface GracePeriodStartedEvent {
    type: 'GRACE_PERIOD_STARTED'
    userId: string
    subscriptionId: string
    gracePeriodEndsAt: Date
}

export interface TrialLinkUsedEvent {
    type: 'TRIAL_LINK_USED'
    trialLinkId: string
    userId: string
    code: string
}

/**
 * Union of all subscription domain events
 */
export type SubscriptionDomainEvent =
    | TrialStartedEvent
    | TrialExpiringEvent
    | TrialExpiredEvent
    | PaymentSucceededEvent
    | PaymentFailedEvent
    | SubscriptionActivatedEvent
    | SubscriptionCanceledEvent
    | SubscriptionExpiredEvent
    | GracePeriodStartedEvent
    | TrialLinkUsedEvent
