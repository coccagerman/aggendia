import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/payments/provider-factory', () => ({
    getPaymentProvider: vi.fn()
}))

import { POST as CHECKOUT_POST } from '@/app/api/v1/subscription/checkout/route'
import { POST as CANCEL_POST } from '@/app/api/v1/subscription/cancel/route'
import { POST as CHANGE_PLAN_POST } from '@/app/api/v1/subscription/change-plan/route'
import { POST as REACTIVATE_POST } from '@/app/api/v1/subscription/reactivate/route'
import { requireAuth } from '@/lib/auth'
import { getPaymentProvider } from '@/lib/payments/provider-factory'

describe('Subscription Checkout API - Integration', () => {
    const userId = `checkout-user-${Date.now()}`
    const missingSubscriptionUserId = `checkout-user-missing-${Date.now()}`
    const email = `${userId}@test.local`
    const missingSubscriptionEmail = `${missingSubscriptionUserId}@test.local`
    let basePlanId: string
    let premiumPlanId: string

    const providerMock = {
        createCustomer: vi.fn(),
        createCheckoutSession: vi.fn(),
        cancelSubscription: vi.fn(),
        changeSubscriptionPlan: vi.fn(),
        reactivateSubscription: vi.fn(),
        constructWebhookEvent: vi.fn(),
        normalizeEvent: vi.fn(),
        type: 'STRIPE' as const
    }

    beforeAll(async () => {
        const basePlan = await prisma.subscriptionPlan.upsert({
            where: { slug: 'base' },
            update: {
                name: 'Base',
                priceCents: 900,
                currency: 'USD',
                intervalMonths: 1,
                isActive: true
            },
            create: {
                name: 'Base',
                slug: 'base',
                priceCents: 900,
                currency: 'USD',
                intervalMonths: 1,
                isActive: true
            }
        })

        const premiumPlan = await prisma.subscriptionPlan.upsert({
            where: { slug: 'premium' },
            update: {
                name: 'Premium',
                priceCents: 1400,
                currency: 'USD',
                intervalMonths: 1,
                isActive: true
            },
            create: {
                name: 'Premium',
                slug: 'premium',
                priceCents: 1400,
                currency: 'USD',
                intervalMonths: 1,
                isActive: true
            }
        })

        basePlanId = basePlan.id
        premiumPlanId = premiumPlan.id

        await prisma.subscription.upsert({
            where: { userId },
            update: {
                status: 'TRIALING',
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD'
            },
            create: {
                userId,
                status: 'TRIALING',
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD'
            }
        })
    })

    afterAll(async () => {
        await prisma.subscription.deleteMany({
            where: {
                userId: {
                    in: [userId, missingSubscriptionUserId]
                }
            }
        })
    })

    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(requireAuth).mockResolvedValue({ userId, email })
        vi.mocked(getPaymentProvider).mockReturnValue(providerMock)
        providerMock.createCustomer.mockResolvedValue({ providerCustomerId: 'cus_test_123' })
        providerMock.createCheckoutSession.mockResolvedValue({
            sessionId: 'cs_test_123',
            checkoutUrl: 'https://checkout.stripe.test/session'
        })
        providerMock.cancelSubscription.mockResolvedValue(undefined)
        providerMock.changeSubscriptionPlan.mockResolvedValue(undefined)
        providerMock.reactivateSubscription.mockResolvedValue(undefined)

        process.env.STRIPE_PRICE_ID_BASE = 'price_base_test_123'
        process.env.STRIPE_PRICE_ID_PREMIUM = 'price_premium_test_123'
    })

    it('creates checkout session using BASE plan mapping and stores plan/provider fields', async () => {
        const request = new NextRequest('http://localhost/api/v1/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify({ planId: basePlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHECKOUT_POST(request)
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.data.checkoutUrl).toBeDefined()

        expect(providerMock.createCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ planPriceId: 'price_base_test_123' })
        )

        const subscription = await prisma.subscription.findUnique({ where: { userId } })
        expect(subscription?.planId).toBe(basePlanId)
        expect(subscription?.paymentProvider).toBe('STRIPE')
        expect(subscription?.providerCustomerId).toBe('cus_test_123')
    })

    it('creates checkout session using PREMIUM plan mapping', async () => {
        const request = new NextRequest('http://localhost/api/v1/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify({ planId: premiumPlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHECKOUT_POST(request)

        expect(response.status).toBe(200)
        expect(providerMock.createCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({ planPriceId: 'price_premium_test_123' })
        )
    })

    it('returns conflict when trying to subscribe again to the same active plan', async () => {
        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'ACTIVE',
                planId: basePlanId,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_test_123',
                providerSubscriptionId: 'sub_active_base_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify({ planId: basePlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHECKOUT_POST(request)
        expect(response.status).toBe(409)
        expect(providerMock.createCheckoutSession).not.toHaveBeenCalled()
    })

    it('allows checkout when upgrading from active base to premium', async () => {
        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'ACTIVE',
                planId: basePlanId,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_test_123',
                providerSubscriptionId: 'sub_active_base_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify({ planId: premiumPlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHECKOUT_POST(request)
        expect(response.status).toBe(200)
        expect(providerMock.createCheckoutSession).toHaveBeenCalledWith(
            expect.objectContaining({
                planPriceId: 'price_premium_test_123',
                successUrl: expect.stringContaining('session_id={CHECKOUT_SESSION_ID}')
            })
        )
    })

    it('schedules downgrade from premium to base without changing local plan immediately', async () => {
        const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'ACTIVE',
                planId: premiumPlanId,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_test_123',
                providerSubscriptionId: 'sub_active_premium_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/change-plan', {
            method: 'POST',
            body: JSON.stringify({ planId: basePlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHANGE_PLAN_POST(request)
        expect(response.status).toBe(200)
        expect(providerMock.changeSubscriptionPlan).toHaveBeenCalledWith({
            providerSubscriptionId: 'sub_active_premium_123',
            newPlanPriceId: 'price_base_test_123'
        })

        const subscription = await prisma.subscription.findUnique({ where: { userId } })
        expect(subscription?.planId).toBe(premiumPlanId)
        expect(subscription?.scheduledPlanId).toBe(basePlanId)
        expect(subscription?.scheduledPlanEffectiveAt?.toISOString()).toBe(currentPeriodEnd.toISOString())
    })

    it('returns conflict when same scheduled downgrade already exists', async () => {
        const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'ACTIVE',
                planId: premiumPlanId,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_test_123',
                providerSubscriptionId: 'sub_active_premium_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd,
                scheduledPlanId: basePlanId,
                scheduledPlanEffectiveAt: currentPeriodEnd
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/change-plan', {
            method: 'POST',
            body: JSON.stringify({ planId: basePlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHANGE_PLAN_POST(request)
        expect(response.status).toBe(409)
        expect(providerMock.changeSubscriptionPlan).not.toHaveBeenCalled()
    })

    it('auto-creates subscription when missing and proceeds with checkout', async () => {
        vi.mocked(requireAuth).mockResolvedValue({ userId: missingSubscriptionUserId, email: missingSubscriptionEmail })

        const request = new NextRequest('http://localhost/api/v1/subscription/checkout', {
            method: 'POST',
            body: JSON.stringify({ planId: basePlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CHECKOUT_POST(request)
        expect(response.status).toBe(200)

        const subscription = await prisma.subscription.findUnique({ where: { userId: missingSubscriptionUserId } })
        expect(subscription).not.toBeNull()
        expect(subscription?.paymentProvider).toBe('STRIPE')
        expect(subscription?.planId).toBe(basePlanId)
    })

    it('reactivates canceled subscription on the same plan without scheduling a new change', async () => {
        const currentPeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'CANCELED',
                planId: basePlanId,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_test_123',
                providerSubscriptionId: 'sub_canceled_base_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd,
                cancelAt: currentPeriodEnd,
                canceledAt: new Date(),
                scheduledPlanId: premiumPlanId,
                scheduledPlanEffectiveAt: currentPeriodEnd
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/reactivate', {
            method: 'POST',
            body: JSON.stringify({ planId: basePlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await REACTIVATE_POST(request)
        expect(response.status).toBe(200)
        expect(providerMock.reactivateSubscription).toHaveBeenCalledWith({
            providerSubscriptionId: 'sub_canceled_base_123'
        })
        expect(providerMock.changeSubscriptionPlan).not.toHaveBeenCalled()

        const subscription = await prisma.subscription.findUnique({ where: { userId } })
        expect(subscription?.status).toBe('ACTIVE')
        expect(subscription?.cancelAt).toBeNull()
        expect(subscription?.scheduledPlanId).toBeNull()
    })

    it('reactivates canceled subscription and applies upgrade immediately with proration', async () => {
        const currentPeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)

        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'CANCELED',
                planId: basePlanId,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_test_123',
                providerSubscriptionId: 'sub_canceled_base_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd,
                cancelAt: currentPeriodEnd,
                canceledAt: new Date(),
                scheduledPlanId: null,
                scheduledPlanEffectiveAt: null
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/reactivate', {
            method: 'POST',
            body: JSON.stringify({ planId: premiumPlanId }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await REACTIVATE_POST(request)
        expect(response.status).toBe(200)
        expect(providerMock.changeSubscriptionPlan).toHaveBeenCalledWith({
            providerSubscriptionId: 'sub_canceled_base_123',
            newPlanPriceId: 'price_premium_test_123',
            effective: 'immediate_prorated'
        })
        expect(providerMock.reactivateSubscription).toHaveBeenCalledWith({
            providerSubscriptionId: 'sub_canceled_base_123'
        })

        const subscription = await prisma.subscription.findUnique({ where: { userId } })
        expect(subscription?.status).toBe('ACTIVE')
        expect(subscription?.planId).toBe(premiumPlanId)
        expect(subscription?.scheduledPlanId).toBeNull()
        expect(subscription?.scheduledPlanEffectiveAt).toBeNull()
    })

    it('cancels provider subscription when providerSubscriptionId exists', async () => {
        await prisma.subscription.update({
            where: { userId },
            data: {
                status: 'ACTIVE',
                providerSubscriptionId: 'sub_test_123',
                paymentProvider: 'STRIPE',
                currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
            }
        })

        const request = new NextRequest('http://localhost/api/v1/subscription/cancel', {
            method: 'POST',
            body: JSON.stringify({ immediate: false }),
            headers: { 'Content-Type': 'application/json' }
        })

        const response = await CANCEL_POST(request)
        expect(response.status).toBe(200)

        expect(providerMock.cancelSubscription).toHaveBeenCalledWith({
            providerSubscriptionId: 'sub_test_123',
            immediate: false
        })
    })
})
