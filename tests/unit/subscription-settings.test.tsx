import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubscriptionSettingsClient } from '@/components/dashboard/subscription-settings'

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: vi.fn()
    })
}))

describe('SubscriptionSettingsClient - Unit', () => {
    const plans = [
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
    ]

    const activePremiumSubscription = {
        id: 'sub-1',
        planId: 'plan-premium',
        scheduledPlanId: null,
        status: 'ACTIVE' as const,
        trialStartsAt: null,
        trialEndsAt: null,
        trialType: 'STANDARD',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        scheduledPlanEffectiveAt: null,
        cancelAt: null,
        canceledAt: null
    }

    const trialSubscription = {
        id: 'sub-2',
        planId: null,
        scheduledPlanId: null,
        status: 'TRIALING' as const,
        trialStartsAt: new Date().toISOString(),
        trialEndsAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        trialType: 'STANDARD',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        scheduledPlanEffectiveAt: null,
        cancelAt: null,
        canceledAt: null
    }

    beforeEach(() => {
        vi.restoreAllMocks()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('shows premium downgrade warning only when prop is enabled', () => {
        const { rerender } = render(
            <SubscriptionSettingsClient
                subscription={activePremiumSubscription}
                plans={plans}
                showPremiumDowngradeWarning
                checkoutProvider='STRIPE'
                checkoutResult={null}
                checkoutSessionId={null}
            />
        )

        expect(screen.getByText(/si pasás de premium a base con más de 3 activos/i)).toBeInTheDocument()

        rerender(
            <SubscriptionSettingsClient
                subscription={activePremiumSubscription}
                plans={plans}
                showPremiumDowngradeWarning={false}
                checkoutProvider='STRIPE'
                checkoutResult={null}
                checkoutSessionId={null}
            />
        )

        expect(screen.queryByText(/si pasás de premium a base con más de 3 activos/i)).not.toBeInTheDocument()
    })

    it('calls change-plan endpoint when downgrading from premium to base', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { message: 'Cambio de plan programado para la próxima renovación.' } })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <SubscriptionSettingsClient
                subscription={activePremiumSubscription}
                plans={plans}
                showPremiumDowngradeWarning
                checkoutProvider='STRIPE'
                checkoutResult={null}
                checkoutSessionId={null}
            />
        )

        await user.click(screen.getByRole('button', { name: /cambiar plan/i }))

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/v1/subscription/change-plan',
                expect.objectContaining({ method: 'POST' })
            )
        })

        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        expect(body.planId).toBe('plan-base')
    })

    it('shows checkout error when subscribe request fails during trial', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ error: { message: 'Error al iniciar el pago.' } })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <SubscriptionSettingsClient
                subscription={trialSubscription}
                plans={plans}
                showPremiumDowngradeWarning={false}
                checkoutProvider='STRIPE'
                checkoutResult={null}
                checkoutSessionId={null}
            />
        )

        await user.click(screen.getAllByRole('button', { name: /suscribirse/i })[0])

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/v1/subscription/checkout',
                expect.objectContaining({ method: 'POST' })
            )
        })

        expect(screen.getByText('Error al iniciar el pago.')).toBeInTheDocument()
    })
})
