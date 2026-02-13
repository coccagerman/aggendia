import { redirect } from 'next/navigation'

/**
 * User-level subscription settings page.
 *
 * Shows the user's subscription status, trial info, and plan options.
 * One subscription per user — covers all their businesses.
 */

interface PageProps {
    searchParams: Promise<{ checkout?: string }>
}

export default async function SubscriptionPage({ searchParams }: PageProps) {
    const { checkout } = await searchParams
    redirect(checkout ? `/subscription?checkout=${checkout}` : '/subscription')
}
