/**
 * Test helper for creating subscription fixtures.
 *
 * Public routes now check the business owner's subscription.
 * Integration tests that hit public endpoints need a TRIALING
 * (or ACTIVE) subscription for the owner user.
 */

import { prisma } from '@/data/prisma/prisma'

/**
 * Creates a TRIALING subscription for the given userId.
 * Idempotent: uses upsert so it doesn't fail if one already exists.
 */
export async function ensureTrialSubscription(userId: string): Promise<void> {
    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    await prisma.subscription.upsert({
        where: { userId },
        create: {
            userId,
            status: 'TRIALING',
            trialStartsAt: now,
            trialEndsAt,
            trialType: 'STANDARD'
        },
        update: {} // no-op if already exists
    })
}
