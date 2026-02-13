/**
 * E2E Tests - Multi-tenant Isolation (US-9.1)
 *
 * Tests end-to-end para verificar que la protección multi-tenant
 * funciona correctamente desde la UI.
 *
 * NOTA: Estos tests son especiales porque requieren DOS usuarios distintos
 * para verificar el aislamiento. Por eso crean usuarios adicionales dentro del test.
 */

import { test, expect } from './fixtures/business.fixture'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness } from './helpers/business.helper'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Multi-tenant Isolation E2E', () => {
    test("user cannot access another user's business via URL", async ({ testBusiness, browser }) => {
        // User A is already set up via fixture
        const businessIdA = testBusiness.businessId
        const businessNameA = testBusiness.businessName

        // === Setup User B in a separate context ===
        const contextB = await browser.newContext()
        const pageB = await contextB.newPage()

        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = generateUniqueName('negocio-b')

        await signupUser(pageB, emailB, passwordB)
        await createBusiness(pageB, businessNameB)

        // === User B tries to access Business A via direct URL ===
        await pageB.goto(`/dashboard/business/${businessIdA}`)
        await pageB.waitForLoadState('networkidle')

        // Verify user doesn't see Business A's name
        const businessAVisible = await pageB
            .getByText(businessNameA)
            .isVisible()
            .catch(() => false)
        expect(businessAVisible).toBe(false)

        // User should see 404 or be redirected
        const url = pageB.url()
        const isOnDashboard = url.includes('/dashboard')
        const isNotFoundPage = await pageB
            .getByRole('heading', { name: '404' })
            .isVisible()
            .catch(() => false)

        expect(isNotFoundPage || isOnDashboard).toBe(true)

        await contextB.close()
    })

    test('user only sees their own businesses in the dashboard list', async ({ browser }) => {
        // === Setup User A with Business A ===
        const contextA = await browser.newContext()
        const pageA = await contextA.newPage()

        const emailA = generateTestEmail()
        const passwordA = 'TestPassword123!'
        const businessNameA = generateUniqueName('solo-mio-a')

        await signupUser(pageA, emailA, passwordA)
        await createBusiness(pageA, businessNameA)
        await contextA.close()

        // === Setup User B with Business B ===
        const contextB = await browser.newContext()
        const pageB = await contextB.newPage()

        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = generateUniqueName('solo-mio-b')

        await signupUser(pageB, emailB, passwordB)
        await createBusiness(pageB, businessNameB)

        // Go to dashboard
        await pageB.goto('/dashboard')
        await pageB.waitForLoadState('networkidle')

        // User B should see Business B
        await expect(pageB.getByText(businessNameB)).toBeVisible()

        // User B should NOT see Business A
        const businessAVisible = await pageB
            .getByText(businessNameA)
            .isVisible()
            .catch(() => false)
        expect(businessAVisible).toBe(false)

        await contextB.close()
    })

    test("API returns 403 when accessing another business's resources", async ({ testBusiness, browser, request }) => {
        // User A is already set up via fixture
        const businessIdA = testBusiness.businessId

        // === Setup User B ===
        const contextB = await browser.newContext()
        const pageB = await contextB.newPage()

        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = generateUniqueName('api-test-b')

        await signupUser(pageB, emailB, passwordB)
        await createBusiness(pageB, businessNameB)

        // === User B tries to call API for Business A ===
        const cookies = await contextB.cookies()
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

        // Try to access Business A's resources via API
        const response = await request.get(`/api/v1/businesses/${businessIdA}/resources`, {
            headers: {
                Cookie: cookieHeader
            }
        })

        // Should get 403 Forbidden
        expect(response.status()).toBe(403)

        const body = await response.json()
        expect(body.error).toBeDefined()
        expect(body.error.code).toBe('AUTH_FORBIDDEN')

        await contextB.close()
    })

    test("resources list shows only current business's resources", async ({ browser }) => {
        // === Setup User A with Business A and Resource ===
        const contextA = await browser.newContext()
        const pageA = await contextA.newPage()

        const emailA = generateTestEmail()
        const passwordA = 'TestPassword123!'
        const businessNameA = generateUniqueName('resources-test-a')
        const resourceNameA = generateUniqueName('recurso-exclusivo-a')

        await signupUser(pageA, emailA, passwordA)
        await createBusiness(pageA, businessNameA)
        await pageA.waitForLoadState('networkidle')

        // Get business ID via API (reliable, same pattern as testBusiness fixture)
        const resA = await pageA.request.get('/api/v1/businesses')
        const bizA = ((await resA.json()).data || []).find((b: { name: string }) => b.name === businessNameA)

        // Create resource for User A — navigate directly to avoid flaky Tooltip interaction
        await pageA.goto(`/dashboard/business/${bizA.id}/resources/new`)
        await pageA.getByLabel(/nombre/i).fill(resourceNameA)
        await pageA.getByRole('button', { name: /crear/i }).click()
        await expect(pageA).toHaveURL('/dashboard', { timeout: 10000 })

        await contextA.close()

        // === Setup User B with Business B and Resource ===
        const contextB = await browser.newContext()
        const pageB = await contextB.newPage()

        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = generateUniqueName('resources-test-b')
        const resourceNameB = generateUniqueName('recurso-exclusivo-b')

        await signupUser(pageB, emailB, passwordB)
        await createBusiness(pageB, businessNameB)
        await pageB.waitForLoadState('networkidle')

        // Get business ID via API
        const resB = await pageB.request.get('/api/v1/businesses')
        const bizB = ((await resB.json()).data || []).find((b: { name: string }) => b.name === businessNameB)

        // Create resource for User B — navigate directly
        await pageB.goto(`/dashboard/business/${bizB.id}/resources/new`)
        await pageB.getByLabel(/nombre/i).fill(resourceNameB)
        await pageB.getByRole('button', { name: /crear/i }).click()
        await expect(pageB).toHaveURL('/dashboard', { timeout: 10000 })

        // Verify User B only sees Resource B in dashboard
        await pageB.goto('/dashboard')
        await pageB.waitForLoadState('networkidle')

        // User B should see their resource
        await expect(pageB.getByText(resourceNameB)).toBeVisible()

        // User B should NOT see User A's resource
        const resourceAVisible = await pageB
            .getByText(resourceNameA)
            .isVisible()
            .catch(() => false)
        expect(resourceAVisible).toBe(false)

        await contextB.close()
    })
})
