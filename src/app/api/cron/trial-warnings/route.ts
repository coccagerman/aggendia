/**
 * Cron endpoint for processing trial warnings and expiration
 * Called by Vercel Cron Jobs daily at midnight UTC
 *
 * Responsibilities:
 * 1. Send trial expiring emails (7, 6, 5, 4, 3, 2, 1, 0 days before)
 * 2. Expire trials that have passed their end date (TRIALING → EXPIRED)
 * 3. Expire canceled subscriptions past their period end
 * 4. Expire past_due subscriptions past their grace period
 *
 * Security:
 * - Protected by CRON_SECRET header validation
 * - Only Vercel can call this endpoint in production
 *
 * Note: Subscription is per-user. We resolve the user's email via
 * BusinessMember → Business.ownerEmail (the first business they own).
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'
import {
    processExpiredTrials,
    processCanceledExpired,
    processPastDueExpired
} from '@/domain/subscriptions/subscription.service'
import { getTrialingSubscriptionsExpiringBetween } from '@/data/repositories/subscription.repo'
import {
    subscriptionNotificationExists,
    createSubscriptionNotification,
    updateSubscriptionNotificationStatus
} from '@/data/repositories/subscription-notification.repo'
import { resend, defaultFromEmail, isEmailEnabled } from '@/lib/resend/client'
import { renderTrialExpiringEmail } from '@/lib/resend/templates/trial-expiring.template'
import { renderTrialExpiredEmail } from '@/lib/resend/templates/trial-expired.template'

const CRON_SECRET = process.env.CRON_SECRET
const IS_DEV = process.env.NODE_ENV === 'development'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function isAuthorized(request: NextRequest): boolean {
    if (!CRON_SECRET) {
        if (IS_DEV) {
            console.warn('[Cron:TrialWarnings] CRON_SECRET not configured - allowing request in development')
            return true
        }
        return false
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader === `Bearer ${CRON_SECRET}`) return true

    const cronSecretHeader = request.headers.get('x-cron-secret')
    if (cronSecretHeader === CRON_SECRET) return true

    return false
}

/**
 * Resolve user email and a representative business name from BusinessMember.
 * Since subscription is per-user (not per-business), we look up the first
 * business the user owns to get the ownerEmail.
 */
async function resolveUserEmailAndBusinessName(
    userId: string
): Promise<{ email: string | null; businessName: string | null }> {
    const member = await prisma.businessMember.findFirst({
        where: { userId, role: 'OWNER' },
        include: { business: { select: { ownerEmail: true, name: true } } }
    })

    return {
        email: member?.business?.ownerEmail ?? null,
        businessName: member?.business?.name ?? null
    }
}

export async function GET(request: NextRequest) {
    const startTime = Date.now()

    if (!CRON_SECRET && !IS_DEV) {
        console.error('[Cron:TrialWarnings] CRON_SECRET not configured')
        return NextResponse.json(
            { error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET is not configured' } },
            { status: 500 }
        )
    }

    if (!isAuthorized(request)) {
        console.warn('[Cron:TrialWarnings] Unauthorized request')
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authorization' } },
            { status: 401 }
        )
    }

    console.info('[Cron:TrialWarnings] Starting processing', {
        timestamp: new Date().toISOString()
    })

    const now = new Date()
    let warningsSent = 0
    let expiredSent = 0
    let errors = 0

    // -----------------------------------------------------------------------
    // 1. Send trial expiring warnings
    // -----------------------------------------------------------------------
    try {
        for (const daysRemaining of SUBSCRIPTION_DEFAULTS.TRIAL_WARNING_DAYS) {
            const from = new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000)
            const to = new Date(now.getTime() + (daysRemaining + 1) * 24 * 60 * 60 * 1000)

            const subscriptions = await getTrialingSubscriptionsExpiringBetween(prisma, from, to)

            for (const sub of subscriptions) {
                try {
                    const alreadySent = await subscriptionNotificationExists(
                        prisma,
                        sub.id,
                        'TRIAL_EXPIRING',
                        daysRemaining
                    )
                    if (alreadySent) continue

                    const { email: ownerEmail, businessName } = await resolveUserEmailAndBusinessName(sub.userId)
                    if (!ownerEmail) {
                        console.warn(
                            `[Cron:TrialWarnings] No owner email for subscription ${sub.id} (user: ${sub.userId})`
                        )
                        continue
                    }

                    const notification = await createSubscriptionNotification(prisma, {
                        subscriptionId: sub.id,
                        userId: sub.userId,
                        type: 'TRIAL_EXPIRING',
                        daysRemaining,
                        to: ownerEmail
                    })

                    if (!notification) continue

                    if (isEmailEnabled()) {
                        const subscribeUrl = `${APP_URL}/subscription`
                        const html = renderTrialExpiringEmail({
                            businessName: businessName || 'Tu negocio',
                            daysRemaining,
                            trialEndsAt: sub.trialEndsAt.toLocaleDateString('es-AR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            }),
                            subscribeUrl
                        })

                        const { error: sendError } = await resend!.emails.send({
                            from: defaultFromEmail,
                            to: ownerEmail,
                            subject:
                                daysRemaining === 0
                                    ? '⏰ Tu prueba de TurnosApp termina hoy'
                                    : `⏰ Tu prueba de TurnosApp termina en ${daysRemaining} día${daysRemaining > 1 ? 's' : ''}`,
                            html
                        })

                        if (sendError) {
                            console.error('[Cron:TrialWarnings] Email send error:', sendError)
                            await updateSubscriptionNotificationStatus(prisma, notification.id, 'FAILED')
                            errors++
                        } else {
                            await updateSubscriptionNotificationStatus(prisma, notification.id, 'SENT')
                            warningsSent++
                        }
                    } else {
                        console.warn(`[Cron:TrialWarnings] Email disabled, skipping notification ${notification.id}`)
                        await updateSubscriptionNotificationStatus(prisma, notification.id, 'FAILED')
                    }
                } catch (error) {
                    console.error(`[Cron:TrialWarnings] Error processing subscription ${sub.id}:`, error)
                    errors++
                }
            }
        }
    } catch (error) {
        console.error('[Cron:TrialWarnings] Error in warning phase:', error)
        errors++
    }

    // -----------------------------------------------------------------------
    // 2. Expire trials
    // -----------------------------------------------------------------------
    let expiredTrialsResult = { expired: 0 }
    try {
        expiredTrialsResult = await processExpiredTrials(prisma, now)

        if (expiredTrialsResult.expired > 0) {
            expiredSent = await sendTrialExpiredEmails(now)
        }
    } catch (error) {
        console.error('[Cron:TrialWarnings] Error expiring trials:', error)
        errors++
    }

    // -----------------------------------------------------------------------
    // 3. Expire canceled subscriptions past period end
    // -----------------------------------------------------------------------
    let canceledResult = { expired: 0 }
    try {
        canceledResult = await processCanceledExpired(prisma, now)
    } catch (error) {
        console.error('[Cron:TrialWarnings] Error processing canceled expirations:', error)
        errors++
    }

    // -----------------------------------------------------------------------
    // 4. Expire past_due subscriptions past grace period
    // -----------------------------------------------------------------------
    let pastDueResult = { expired: 0 }
    try {
        pastDueResult = await processPastDueExpired(prisma, now)
    } catch (error) {
        console.error('[Cron:TrialWarnings] Error processing past_due expirations:', error)
        errors++
    }

    const duration = Date.now() - startTime
    const summary = {
        warningsSent,
        expiredSent,
        trialsExpired: expiredTrialsResult.expired,
        canceledExpired: canceledResult.expired,
        pastDueExpired: pastDueResult.expired,
        errors,
        durationMs: duration
    }

    console.info('[Cron:TrialWarnings] Completed', summary)

    return NextResponse.json({ data: summary })
}

/**
 * Send trial-expired emails to recently expired subscriptions.
 */
async function sendTrialExpiredEmails(now: Date): Promise<number> {
    let sent = 0

    const recentlyExpired = await prisma.subscription.findMany({
        where: {
            status: 'EXPIRED',
            trialEndsAt: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                lte: now
            }
        }
    })

    for (const sub of recentlyExpired) {
        try {
            const alreadySent = await subscriptionNotificationExists(prisma, sub.id, 'TRIAL_EXPIRED', null)
            if (alreadySent) continue

            const { email: ownerEmail, businessName } = await resolveUserEmailAndBusinessName(sub.userId)
            if (!ownerEmail) continue

            const notification = await createSubscriptionNotification(prisma, {
                subscriptionId: sub.id,
                userId: sub.userId,
                type: 'TRIAL_EXPIRED',
                daysRemaining: null,
                to: ownerEmail
            })

            if (!notification) continue

            if (isEmailEnabled()) {
                const subscribeUrl = `${APP_URL}/subscription`
                const html = renderTrialExpiredEmail({
                    businessName: businessName || 'Tu negocio',
                    subscribeUrl
                })

                const { error: sendError } = await resend!.emails.send({
                    from: defaultFromEmail,
                    to: ownerEmail,
                    subject: '🔒 Tu período de prueba de TurnosApp terminó',
                    html
                })

                if (sendError) {
                    console.error('[Cron:TrialWarnings] Expired email error:', sendError)
                    await updateSubscriptionNotificationStatus(prisma, notification.id, 'FAILED')
                } else {
                    await updateSubscriptionNotificationStatus(prisma, notification.id, 'SENT')
                    sent++
                }
            } else {
                await updateSubscriptionNotificationStatus(prisma, notification.id, 'FAILED')
            }
        } catch (error) {
            console.error(`[Cron:TrialWarnings] Error sending expired email for sub ${sub.id}:`, error)
        }
    }

    return sent
}
