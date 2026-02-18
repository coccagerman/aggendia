import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { CompleteCountryForm } from '@/components/auth/complete-country-form'

export default async function OnboardingCountryPage() {
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const subscription = await getSubscriptionByUserId(prisma, user.id)

    if (subscription?.countryIso2) {
        redirect('/dashboard')
    }

    return <CompleteCountryForm initialCountryIso2={subscription?.countryIso2 ?? null} />
}
