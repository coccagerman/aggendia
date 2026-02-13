import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { checkBusinessAccess } from '@/lib/auth/require-business-access'

/**
 * Layout for /dashboard/business/[businessId]/**
 *
 * Validates:
 * 1. User is authenticated
 * 2. User has access (membership) to the business
 *
 * Subscription check is handled by the parent /dashboard/layout.tsx
 * which gates ALL dashboard pages globally (per-user subscription).
 */
export default async function BusinessLayout({
    children,
    params
}: {
    children: React.ReactNode
    params: Promise<{ businessId: string }>
}) {
    const { businessId } = await params

    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const hasMembership = await checkBusinessAccess(user.id, businessId)
    if (!hasMembership) {
        notFound()
    }

    return <>{children}</>
}
