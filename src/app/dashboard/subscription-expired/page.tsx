import { redirect } from 'next/navigation'

/** Legacy route kept for backward compatibility. */

export default async function SubscriptionExpiredPage() {
    redirect('/subscription-expired')
}
