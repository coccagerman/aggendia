import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/data/prisma/prisma'
import { checkUserAccess } from '@/domain/subscriptions/subscription.service'
import { isWarningState } from '@/domain/subscriptions/subscription.policy'
import { SubscriptionBanner } from '@/components/dashboard/subscription-banner'

/**
 * Paths exempt from the subscription gate.
 * These pages must be accessible even when the subscription is expired.
 */
const EXEMPT_PATHS = ['/dashboard/subscription-expired', '/dashboard/subscription']

/**
 * Root layout for /dashboard/**
 *
 * Responsibilities:
 * 1. Validate user authentication
 * 2. Check subscription status (per-user, not per-business)
 * 3. If subscription expired → redirect to /dashboard/subscription-expired
 *    (except for exempt pages to avoid redirect loops)
 * 4. If subscription in warning state → show global banner across ALL views
 *
 * This layout runs for every dashboard page, ensuring the banner and gate
 * are consistent regardless of which business or section the user is viewing.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check user-level subscription
    const { allowed, subscription } = await checkUserAccess(prisma, user.id)

    // Determine current path from middleware header
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') || ''
    const isExempt = EXEMPT_PATHS.some(p => pathname.startsWith(p))

    // Gate: redirect to expired page (skip if we're already on an exempt page)
    if (!allowed && !isExempt) {
        redirect('/dashboard/subscription-expired')
    }

    // Determine if we need a global warning banner (only on non-exempt pages)
    const showBanner = !isExempt && subscription ? isWarningState(subscription.status) : false
    const now = new Date()
    const trialDaysLeft =
        subscription?.status === 'TRIALING' && subscription.trialEndsAt
            ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : null

    return (
        <>
            {showBanner && subscription && trialDaysLeft !== null && (
                <SubscriptionBanner status='TRIALING' trialDaysLeft={trialDaysLeft} />
            )}
            {showBanner && subscription && subscription.status === 'PAST_DUE' && (
                <SubscriptionBanner status='PAST_DUE' />
            )}
            {showBanner && subscription && subscription.status === 'CANCELED' && (
                <SubscriptionBanner status='CANCELED' />
            )}
            {children}
        </>
    )
}
