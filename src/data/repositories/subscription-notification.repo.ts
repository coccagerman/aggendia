/**
 * Repository for SubscriptionNotification entity.
 *
 * Handles trial warning and billing notification persistence.
 * Separate from appointment notifications — different lifecycle.
 */

import { PrismaClient } from '@prisma/client'
import type {
    SubscriptionNotificationRecord,
    SubscriptionNotificationType
} from '@/domain/subscriptions/subscription.types'

/**
 * Check if a subscription notification already exists (idempotency).
 */
export async function subscriptionNotificationExists(
    prisma: PrismaClient,
    subscriptionId: string,
    type: SubscriptionNotificationType,
    daysRemaining: number | null
): Promise<boolean> {
    const existing = await prisma.subscriptionNotification.findUnique({
        where: {
            subscriptionId_type_daysRemaining: {
                subscriptionId,
                type,
                daysRemaining: daysRemaining ?? 0
            }
        },
        select: { id: true }
    })
    return existing !== null
}

/**
 * Create a subscription notification record.
 * Returns null if duplicate (idempotent).
 */
export async function createSubscriptionNotification(
    prisma: PrismaClient,
    input: {
        subscriptionId: string
        userId: string
        type: SubscriptionNotificationType
        daysRemaining?: number | null
        to: string
    }
): Promise<SubscriptionNotificationRecord | null> {
    try {
        return await prisma.subscriptionNotification.create({
            data: {
                subscriptionId: input.subscriptionId,
                userId: input.userId,
                type: input.type,
                channel: 'EMAIL',
                daysRemaining: input.daysRemaining ?? null,
                to: input.to,
                status: 'PENDING'
            }
        })
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
            // Duplicate — already sent for this subscription+type+day combo
            return null
        }
        throw error
    }
}

/**
 * Update notification status after sending.
 */
export async function updateSubscriptionNotificationStatus(
    prisma: PrismaClient,
    notificationId: string,
    status: 'SENT' | 'FAILED',
    error?: string
): Promise<void> {
    await prisma.subscriptionNotification.update({
        where: { id: notificationId },
        data: {
            status,
            sentAt: status === 'SENT' ? new Date() : undefined,
            error: error ?? null
        }
    })
}
