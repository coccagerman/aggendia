import { test, expect } from './fixtures/business.fixture'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'

async function getOwnerUserIdByBusinessId(businessId: string): Promise<string> {
    const member = await prisma.businessMember.findFirst({
        where: {
            businessId,
            role: 'OWNER'
        },
        select: {
            userId: true
        }
    })

    if (!member) {
        throw new Error(`No owner member found for business ${businessId}`)
    }

    return member.userId
}

async function ensurePlans() {
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

    return { basePlan, premiumPlan }
}

test.describe('Subscription Payments E2E', () => {
    test('trial user can start checkout from subscription page', async ({ authenticatedPage }) => {
        const page = authenticatedPage
        let checkoutRequestBody: string | null = null

        await page.route('**/api/v1/subscription/checkout', async route => {
            checkoutRequestBody = route.request().postData() ?? null
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        checkoutUrl: '/subscription?checkout=success&session_id=e2e-session',
                        sessionId: 'e2e-session'
                    }
                })
            })
        })

        await page.route('**/api/v1/subscription/sync-checkout', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data: { synced: true } })
            })
        })

        await page.goto('/subscription')
        await page
            .getByRole('button', { name: /suscribirse/i })
            .first()
            .click()

        await expect(page).toHaveURL(/\/subscription\?checkout=success/)
        expect(checkoutRequestBody).not.toBeNull()
    })

    test('active premium user can schedule downgrade to base from UI', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const ownerUserId = await getOwnerUserIdByBusinessId(testBusiness.businessId)
        const { basePlan, premiumPlan } = await ensurePlans()

        await prisma.subscription.upsert({
            where: { userId: ownerUserId },
            update: {
                status: 'ACTIVE',
                planId: premiumPlan.id,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_e2e_123',
                providerSubscriptionId: 'sub_e2e_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                scheduledPlanId: null,
                scheduledPlanEffectiveAt: null
            },
            create: {
                userId: ownerUserId,
                status: 'ACTIVE',
                planId: premiumPlan.id,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD',
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_e2e_123',
                providerSubscriptionId: 'sub_e2e_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        })

        let changePlanBody: string | null = null
        await page.route('**/api/v1/subscription/change-plan', async route => {
            changePlanBody = route.request().postData() ?? null
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        message: 'Cambio a Base programado para la próxima renovación.',
                        effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                    }
                })
            })
        })

        await page.goto('/subscription')
        await page.getByRole('button', { name: /cambiar plan/i }).click()

        await expect(page.getByText(/cambio a base programado para la próxima renovación/i)).toBeVisible()
        expect(changePlanBody).not.toBeNull()
        if (changePlanBody === null) {
            throw new Error('Expected change-plan request body to be present')
        }
        expect(JSON.parse(changePlanBody).planId).toBe(basePlan.id)
    })

    test('premium user with >3 active businesses sees downgrade warning in subscription view', async ({
        authenticatedPage,
        testBusiness,
        testUser
    }) => {
        const page = authenticatedPage
        const ownerUserId = await getOwnerUserIdByBusinessId(testBusiness.businessId)
        const { premiumPlan } = await ensurePlans()

        await prisma.subscription.upsert({
            where: { userId: ownerUserId },
            update: {
                status: 'ACTIVE',
                planId: premiumPlan.id,
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_warn_123',
                providerSubscriptionId: 'sub_warn_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            create: {
                userId: ownerUserId,
                status: 'ACTIVE',
                planId: premiumPlan.id,
                trialStartsAt: new Date(),
                trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                trialType: 'STANDARD',
                paymentProvider: 'STRIPE',
                providerCustomerId: 'cus_warn_123',
                providerSubscriptionId: 'sub_warn_123',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        })

        const createdBusinessIds: string[] = []
        const baseSlug = `e2e-extra-${Date.now()}`

        const b2 = await createBusinessWithOwner(
            prisma,
            { name: `Extra 2 ${Date.now()}`, timezone: 'UTC' },
            `${baseSlug}-2`,
            ownerUserId,
            testUser.email
        )
        const b3 = await createBusinessWithOwner(
            prisma,
            { name: `Extra 3 ${Date.now()}`, timezone: 'UTC' },
            `${baseSlug}-3`,
            ownerUserId,
            testUser.email
        )
        const b4 = await createBusinessWithOwner(
            prisma,
            { name: `Extra 4 ${Date.now()}`, timezone: 'UTC' },
            `${baseSlug}-4`,
            ownerUserId,
            testUser.email
        )

        createdBusinessIds.push(b2.business.id, b3.business.id, b4.business.id)

        await page.goto('/subscription')

        await expect(
            page.getByText(/si pasás de premium a base con más de 3 activos, se desactivan y podés reactivar hasta 3/i)
        ).toBeVisible()

        if (createdBusinessIds.length > 0) {
            await prisma.business.deleteMany({
                where: {
                    id: {
                        in: createdBusinessIds
                    }
                }
            })
        }
    })
})
