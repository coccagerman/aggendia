import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const {
    getUserMock,
    getSubscriptionStatusMock,
    getActivePlansMock,
    countActiveBusinessesByUserIdMock,
    getMercadoPagoPreapprovalPlanMock
} = vi.hoisted(() => ({
    getUserMock: vi.fn(),
    getSubscriptionStatusMock: vi.fn(),
    getActivePlansMock: vi.fn(),
    countActiveBusinessesByUserIdMock: vi.fn(),
    getMercadoPagoPreapprovalPlanMock: vi.fn()
}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: {
            getUser: getUserMock
        }
    })
}))

vi.mock('@/data/repositories/subscription-plan.repo', () => ({
    getActivePlans: getActivePlansMock
}))

vi.mock('@/domain/subscriptions/subscription.service', () => ({
    getSubscriptionStatus: getSubscriptionStatusMock
}))

vi.mock('@/data/repositories/business.repo', () => ({
    countActiveBusinessesByUserId: countActiveBusinessesByUserIdMock
}))

vi.mock('@/lib/payments/mercadopago/mercadopago.client', () => ({
    getMercadoPagoPreapprovalPlan: getMercadoPagoPreapprovalPlanMock
}))

vi.mock('next/navigation', () => ({
    redirect: vi.fn()
}))

vi.mock('@/components/dashboard/subscription-settings', () => ({
    SubscriptionSettingsClient: ({
        plans
    }: {
        plans: Array<{ slug: string; priceCents: number; currency: string }>
    }) => (
        <div>
            {plans.map(plan => (
                <div key={plan.slug} data-testid={`plan-${plan.slug}`}>
                    {`${plan.slug}:${plan.priceCents}:${plan.currency}`}
                </div>
            ))}
        </div>
    )
}))

import SubscriptionPage from '@/app/subscription/page'

describe('Subscription page - Unit', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        getUserMock.mockResolvedValue({
            data: {
                user: {
                    id: 'user-ar-1'
                }
            }
        })

        getSubscriptionStatusMock.mockResolvedValue({
            id: 'sub-1',
            planId: null,
            scheduledPlanId: null,
            status: 'TRIALING',
            countryIso2: 'AR',
            trialStartsAt: new Date(),
            trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            trialType: 'STANDARD',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            scheduledPlanEffectiveAt: null,
            cancelAt: null,
            canceledAt: null
        })

        getActivePlansMock.mockResolvedValue([
            {
                id: 'plan-base',
                name: 'Base',
                slug: 'base',
                priceCents: 900,
                currency: 'USD',
                intervalMonths: 1
            },
            {
                id: 'plan-premium',
                name: 'Premium',
                slug: 'premium',
                priceCents: 1400,
                currency: 'USD',
                intervalMonths: 1
            }
        ])

        countActiveBusinessesByUserIdMock.mockResolvedValue(1)

        getMercadoPagoPreapprovalPlanMock.mockImplementation(async (planId: string) => {
            if (planId.includes('base')) {
                return {
                    id: planId,
                    auto_recurring: {
                        transaction_amount: 12000,
                        currency_id: 'ARS'
                    }
                }
            }

            return {
                id: planId,
                auto_recurring: {
                    transaction_amount: 25000,
                    currency_id: 'ARS'
                }
            }
        })

        process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID_BASE_ARS = 'mp_plan_base_ars_test_123'
        process.env.MERCADOPAGO_PREAPPROVAL_PLAN_ID_PREMIUM_ARS = 'mp_plan_premium_ars_test_123'
    })

    it('uses Mercado Pago preapproval plan prices for AR users', async () => {
        const ui = await SubscriptionPage({
            searchParams: Promise.resolve({})
        })

        render(ui)

        expect(screen.getByTestId('plan-base')).toHaveTextContent('base:1200000:ARS')
        expect(screen.getByTestId('plan-premium')).toHaveTextContent('premium:2500000:ARS')
        expect(getMercadoPagoPreapprovalPlanMock).toHaveBeenCalledTimes(2)
    })
})
