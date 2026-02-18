import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

import { POST as BUSINESSES_POST } from '@/app/api/v1/businesses/route'
import { PATCH as BUSINESS_PATCH } from '@/app/api/v1/businesses/[businessId]/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'

describe('Business plan limits API - Integration', () => {
    const baseUserId = `base-limit-user-${Date.now()}`
    const premiumUserId = `premium-limit-user-${Date.now()}`
    const trialUserId = `trial-limit-user-${Date.now()}`
    const baseEmail = `${baseUserId}@test.local`
    const premiumEmail = `${premiumUserId}@test.local`
    const trialEmail = `${trialUserId}@test.local`
    let basePlanId: string
    let premiumPlanId: string
    const createdBusinessIds: string[] = []

    const createContext = (businessId: string) => ({
        params: Promise.resolve({ businessId })
    })

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
            where: { userId: baseUserId },
            update: {
                status: 'ACTIVE',
                planId: basePlanId,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            create: {
                userId: baseUserId,
                status: 'ACTIVE',
                planId: basePlanId,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD'
            }
        })

        await prisma.subscription.upsert({
            where: { userId: premiumUserId },
            update: {
                status: 'ACTIVE',
                planId: premiumPlanId,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            create: {
                userId: premiumUserId,
                status: 'ACTIVE',
                planId: premiumPlanId,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD'
            }
        })

        await prisma.subscription.upsert({
            where: { userId: trialUserId },
            update: {
                status: 'TRIALING',
                planId: null,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            create: {
                userId: trialUserId,
                status: 'TRIALING',
                planId: null,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD'
            }
        })
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterAll(async () => {
        if (createdBusinessIds.length > 0) {
            await prisma.business.deleteMany({ where: { id: { in: createdBusinessIds } } })
        }

        await prisma.subscription.deleteMany({
            where: {
                userId: {
                    in: [baseUserId, premiumUserId, trialUserId]
                }
            }
        })
    })

    it('blocks creating a new business when trial user already has 3 active businesses', async () => {
        vi.mocked(requireAuth).mockResolvedValue({ userId: trialUserId, email: trialEmail })

        const t1 = await createBusinessWithOwner(
            prisma,
            { name: `Trial Limit 1 ${Date.now()}`, timezone: 'UTC' },
            `trial-limit-1-${Date.now()}`,
            trialUserId,
            trialEmail
        )
        const t2 = await createBusinessWithOwner(
            prisma,
            { name: `Trial Limit 2 ${Date.now()}`, timezone: 'UTC' },
            `trial-limit-2-${Date.now()}`,
            trialUserId,
            trialEmail
        )
        const t3 = await createBusinessWithOwner(
            prisma,
            { name: `Trial Limit 3 ${Date.now()}`, timezone: 'UTC' },
            `trial-limit-3-${Date.now()}`,
            trialUserId,
            trialEmail
        )

        createdBusinessIds.push(t1.business.id, t2.business.id, t3.business.id)

        const request = new NextRequest('http://localhost/api/v1/businesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Extra Trial Biz',
                timezone: 'UTC'
            })
        })

        const response = await BUSINESSES_POST(request)
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.error?.code).toBe('BUSINESS_PLAN_LIMIT_REACHED')
    })

    it('blocks creating a new business when base plan already has 3 active businesses', async () => {
        vi.mocked(requireAuth).mockResolvedValue({ userId: baseUserId, email: baseEmail })

        const b1 = await createBusinessWithOwner(
            prisma,
            { name: `Base Limit 1 ${Date.now()}`, timezone: 'UTC' },
            `base-limit-1-${Date.now()}`,
            baseUserId,
            baseEmail
        )
        const b2 = await createBusinessWithOwner(
            prisma,
            { name: `Base Limit 2 ${Date.now()}`, timezone: 'UTC' },
            `base-limit-2-${Date.now()}`,
            baseUserId,
            baseEmail
        )
        const b3 = await createBusinessWithOwner(
            prisma,
            { name: `Base Limit 3 ${Date.now()}`, timezone: 'UTC' },
            `base-limit-3-${Date.now()}`,
            baseUserId,
            baseEmail
        )

        createdBusinessIds.push(b1.business.id, b2.business.id, b3.business.id)

        const request = new NextRequest('http://localhost/api/v1/businesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Extra Base Biz',
                timezone: 'UTC'
            })
        })

        const response = await BUSINESSES_POST(request)
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.error?.code).toBe('BUSINESS_PLAN_LIMIT_REACHED')
    })

    it('allows creating a new business on premium plan even with more than 3 active businesses', async () => {
        vi.mocked(requireAuth).mockResolvedValue({ userId: premiumUserId, email: premiumEmail })

        const p1 = await createBusinessWithOwner(
            prisma,
            { name: `Premium Limit 1 ${Date.now()}`, timezone: 'UTC' },
            `premium-limit-1-${Date.now()}`,
            premiumUserId,
            premiumEmail
        )
        const p2 = await createBusinessWithOwner(
            prisma,
            { name: `Premium Limit 2 ${Date.now()}`, timezone: 'UTC' },
            `premium-limit-2-${Date.now()}`,
            premiumUserId,
            premiumEmail
        )
        const p3 = await createBusinessWithOwner(
            prisma,
            { name: `Premium Limit 3 ${Date.now()}`, timezone: 'UTC' },
            `premium-limit-3-${Date.now()}`,
            premiumUserId,
            premiumEmail
        )
        const p4 = await createBusinessWithOwner(
            prisma,
            { name: `Premium Limit 4 ${Date.now()}`, timezone: 'UTC' },
            `premium-limit-4-${Date.now()}`,
            premiumUserId,
            premiumEmail
        )

        createdBusinessIds.push(p1.business.id, p2.business.id, p3.business.id, p4.business.id)

        const request = new NextRequest('http://localhost/api/v1/businesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Extra Premium Biz',
                timezone: 'UTC'
            })
        })

        const response = await BUSINESSES_POST(request)
        const body = await response.json()

        expect(response.status).toBe(201)
        expect(body.data?.id).toBeDefined()
        if (body.data?.id) {
            createdBusinessIds.push(body.data.id)
        }
    })

    it('blocks activating an inactive business when base plan already reached active limit', async () => {
        const ts = Date.now()
        vi.mocked(requireAuth).mockResolvedValue({ userId: baseUserId, email: baseEmail })

        const activeA = await createBusinessWithOwner(
            prisma,
            { name: `Base Activate A ${ts}`, timezone: 'UTC' },
            `base-activate-a-${ts}`,
            baseUserId,
            baseEmail
        )
        const activeB = await createBusinessWithOwner(
            prisma,
            { name: `Base Activate B ${ts}`, timezone: 'UTC' },
            `base-activate-b-${ts}`,
            baseUserId,
            baseEmail
        )
        const activeC = await createBusinessWithOwner(
            prisma,
            { name: `Base Activate C ${ts}`, timezone: 'UTC' },
            `base-activate-c-${ts}`,
            baseUserId,
            baseEmail
        )
        const toActivate = await createBusinessWithOwner(
            prisma,
            { name: `Base Activate D ${ts}`, timezone: 'UTC' },
            `base-activate-d-${ts}`,
            baseUserId,
            baseEmail
        )

        createdBusinessIds.push(activeA.business.id, activeB.business.id, activeC.business.id, toActivate.business.id)

        await prisma.business.update({
            where: { id: toActivate.business.id },
            data: { status: 'INACTIVE' }
        })

        vi.mocked(requireBusinessAccess).mockResolvedValue({ role: 'OWNER', businessId: toActivate.business.id })

        const request = new NextRequest(`http://localhost/api/v1/businesses/${toActivate.business.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'ACTIVE' })
        })

        const response = await BUSINESS_PATCH(request, createContext(toActivate.business.id))
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.error?.code).toBe('BUSINESS_PLAN_LIMIT_REACHED')
    })
})
