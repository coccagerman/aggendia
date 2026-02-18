import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionStatus } from '@/domain/subscriptions/subscription.service'
import { getActivePlans } from '@/data/repositories/subscription-plan.repo'
import { countActiveBusinessesByUserId } from '@/data/repositories/business.repo'
import { SubscriptionSettingsClient } from '@/components/dashboard/subscription-settings'
import { Button } from '@/components/ui/button'

interface PageProps {
    searchParams: Promise<{ checkout?: string; session_id?: string }>
}

/**
 * Top-level subscription page.
 * Lives outside /dashboard gate so expired users can always manage billing.
 */
export default async function SubscriptionPage({ searchParams }: PageProps) {
    const { checkout, session_id: sessionId } = await searchParams

    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const [subscription, plans, activeBusinessesCount] = await Promise.all([
        getSubscriptionStatus(prisma, user.id),
        getActivePlans(prisma),
        countActiveBusinessesByUserId(prisma, user.id)
    ])

    const currentPlan = subscription?.planId ? plans.find(plan => plan.id === subscription.planId) : null
    const showPremiumDowngradeWarning =
        subscription?.status === 'ACTIVE' && currentPlan?.slug === 'premium' && activeBusinessesCount > 3

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white border-b'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
                    <div className='flex items-center gap-4'>
                        <Link href='/dashboard'>
                            <Button variant='ghost' size='icon'>
                                <ArrowLeft className='h-5 w-5' />
                            </Button>
                        </Link>
                        <div className='flex items-center gap-2'>
                            <CreditCard className='h-5 w-5 text-muted-foreground' />
                            <div>
                                <h1 className='text-xl font-semibold text-gray-900'>Suscripción</h1>
                                <p className='text-sm text-muted-foreground'>Gestioná tu plan de TurnosApp</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className='max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
                <SubscriptionSettingsClient
                    subscription={
                        subscription
                            ? {
                                  id: subscription.id,
                                  planId: subscription.planId,
                                  status: subscription.status,
                                  trialStartsAt: subscription.trialStartsAt?.toISOString() ?? null,
                                  trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
                                  trialType: subscription.trialType,
                                  currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
                                  currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
                                  scheduledPlanId: subscription.scheduledPlanId,
                                  scheduledPlanEffectiveAt:
                                      subscription.scheduledPlanEffectiveAt?.toISOString() ?? null,
                                  cancelAt: subscription.cancelAt?.toISOString() ?? null,
                                  canceledAt: subscription.canceledAt?.toISOString() ?? null
                              }
                            : null
                    }
                    plans={plans.map(p => ({
                        id: p.id,
                        name: p.name,
                        slug: p.slug,
                        priceCents: p.priceCents,
                        currency: p.currency,
                        intervalMonths: p.intervalMonths
                    }))}
                    showPremiumDowngradeWarning={showPremiumDowngradeWarning}
                    checkoutResult={checkout ?? null}
                    checkoutSessionId={sessionId ?? null}
                />
            </main>
        </div>
    )
}
