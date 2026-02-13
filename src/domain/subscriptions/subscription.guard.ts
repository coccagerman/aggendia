/**
 * Subscription access guard.
 *
 * Server-side guard for Route Handlers that require an active subscription.
 * Called AFTER auth validation, BEFORE processing the request.
 *
 * Usage in Route Handlers:
 *   const { userId } = await requireAuth()
 *   await requireActiveSubscription(userId)
 */

import { prisma } from '@/data/prisma/prisma'
import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from './subscription.errors'
import { checkUserAccess } from './subscription.service'

/**
 * Require that the user has an active subscription (or active trial).
 * Throws 403 if subscription is expired or not found.
 *
 * This guard is meant for private API routes that should only work
 * for users with valid subscriptions.
 */
export async function requireActiveSubscription(userId: string): Promise<void> {
    const { allowed, reason } = await checkUserAccess(prisma, userId)

    if (!allowed) {
        throw new AppError(
            SubscriptionErrorCodes.SUBSCRIPTION_EXPIRED,
            'Tu suscripción ha expirado. Activá un plan para continuar usando la plataforma.',
            403,
            { reason }
        )
    }
}
