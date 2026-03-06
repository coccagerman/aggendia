import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { CompleteCountryForm } from '@/components/auth/complete-country-form'
import { countryRequiresTimezoneSelection } from '@/lib/country'
import { isAppDisabledInProd } from '@/lib/app-disabled'

export default async function OnboardingCountryPage() {
    if (isAppDisabledInProd()) {
        redirect('/maintenance')
    }

    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const subscription = await getSubscriptionByUserId(prisma, user.id)

    const hasCountry = Boolean(subscription?.countryIso2)
    const requiresTimezone = countryRequiresTimezoneSelection(subscription?.countryIso2)
    const hasRequiredTimezone = !requiresTimezone || Boolean(subscription?.accountTimezone)

    if (hasCountry && hasRequiredTimezone) {
        redirect('/dashboard')
    }

    return (
        <CompleteCountryForm
            initialCountryIso2={subscription?.countryIso2 ?? null}
            initialAccountTimezone={subscription?.accountTimezone ?? null}
        />
    )
}
