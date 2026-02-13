/**
 * Subscription state machine policy.
 *
 * Defines which status transitions are valid and what event triggers each.
 * Used by subscription.service.ts to validate transitions before applying them.
 *
 * Why a separate policy file?
 * - Keeps transition rules explicit and testable independently.
 * - Prevents accidental invalid state changes (e.g. EXPIRED → CANCELED).
 * - Documents the state machine in code, not just diagrams.
 */

import { SubscriptionStatus } from './subscription.types'
import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from './subscription.errors'

/**
 * Map of valid transitions: from → [allowed destinations]
 *
 * State machine:
 *   TRIALING  → ACTIVE, EXPIRED
 *   ACTIVE    → PAST_DUE, CANCELED
 *   PAST_DUE  → ACTIVE, EXPIRED, CANCELED
 *   CANCELED  → ACTIVE, EXPIRED
 *   EXPIRED   → ACTIVE (reactivation via payment)
 */
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    TRIALING: ['ACTIVE', 'EXPIRED'],
    ACTIVE: ['PAST_DUE', 'CANCELED'],
    PAST_DUE: ['ACTIVE', 'EXPIRED', 'CANCELED'],
    CANCELED: ['ACTIVE', 'EXPIRED'],
    EXPIRED: ['ACTIVE']
}

/**
 * Check whether a transition from one status to another is valid.
 */
export function isValidTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Assert that a transition is valid. Throws AppError if not.
 */
export function assertValidTransition(from: SubscriptionStatus, to: SubscriptionStatus): void {
    if (!isValidTransition(from, to)) {
        throw new AppError(
            SubscriptionErrorCodes.INVALID_STATUS_TRANSITION,
            `Transición de suscripción inválida: ${from} → ${to}`,
            400,
            { from, to, validTargets: VALID_TRANSITIONS[from] }
        )
    }
}

/**
 * Check if a subscription status grants app access.
 * TRIALING and ACTIVE have full access.
 * PAST_DUE has degraded access (grace period).
 * CANCELED has access until period end.
 */
export function hasAppAccess(status: SubscriptionStatus, cancelAt?: Date | null, now?: Date): boolean {
    const currentTime = now ?? new Date()

    switch (status) {
        case 'TRIALING':
        case 'ACTIVE':
            return true
        case 'PAST_DUE':
            // Grace period — allow access but should show warning
            return true
        case 'CANCELED':
            // Access until the end of paid period
            if (cancelAt && cancelAt > currentTime) {
                return true
            }
            return false
        case 'EXPIRED':
            return false
        default:
            return false
    }
}

/**
 * Check if a subscription is in a warning state (should show banner).
 */
export function isWarningState(status: SubscriptionStatus): boolean {
    return status === 'TRIALING' || status === 'PAST_DUE' || status === 'CANCELED'
}
