/**
 * E2E Tests - Multi-tenant Isolation
 *
 * Tests end-to-end para verificar que la protección multi-tenant
 * funciona correctamente desde la UI:
 * - Un usuario no puede acceder a páginas de negocios a los que no pertenece
 * - Las listas muestran solo datos del negocio actual
 *
 * @see docs/user-stories.md - US-9.1
 */

import { test, expect, Page } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness, navigateToCreateResource } from './helpers/business.helper'

test.describe('Multi-tenant Isolation E2E', () => {
    /**
     * Helper to get the businessId from the URL when in a business-specific page
     */
    async function getCurrentBusinessId(page: Page): Promise<string | null> {
        const url = page.url()
        const match = url.match(/\/dashboard\/business\/([^/]+)/)
        return match ? match[1] : null
    }

    /**
     * Helper to navigate to a business's agenda and return the businessId
     */
    async function navigateToBusinessAgenda(page: Page): Promise<string> {
        // Click "Ver Agenda" link to navigate to business dashboard
        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForURL('**/dashboard/business/**/agenda')

        const businessId = await getCurrentBusinessId(page)
        if (!businessId) throw new Error('Could not get businessId from URL')
        return businessId
    }

    /**
     * Helper to create a resource for a business
     */
    async function createResource(page: Page, resourceName: string) {
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
    }

    test("user cannot access another user's business via URL", async ({ page }) => {
        // === Setup User A with Business A ===
        const emailA = generateTestEmail()
        const passwordA = 'TestPassword123!'
        const businessNameA = `Negocio A ${Date.now()}`

        await signupUser(page, emailA, passwordA)
        await createBusiness(page, businessNameA)

        // Navigate to business agenda to get the businessId
        const businessIdA = await navigateToBusinessAgenda(page)
        expect(businessIdA).toBeTruthy()

        // Logout User A
        await page.context().clearCookies()

        // === Setup User B with Business B ===
        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = `Negocio B ${Date.now()}`

        await signupUser(page, emailB, passwordB)
        await createBusiness(page, businessNameB)

        // Get Business B's ID before attempting cross-access
        const businessIdB = await navigateToBusinessAgenda(page)
        expect(businessIdB).toBeTruthy()
        expect(businessIdB).not.toBe(businessIdA)

        // === User B tries to access Business A via direct URL ===
        await page.goto(`/dashboard/business/${businessIdA}`)

        // Should be denied - either redirected to dashboard or shown error
        // The implementation may vary, but user should NOT see Business A content
        await page.waitForLoadState('networkidle')

        // Verify user doesn't see Business A's name anywhere on the page
        const businessAVisible = await page
            .getByText(businessNameA)
            .isVisible()
            .catch(() => false)
        expect(businessAVisible).toBe(false)

        // User should either:
        // 1. Be redirected to dashboard
        // 2. See an access denied message
        // 3. See their own business (Business B)
        const url = page.url()
        const isOnDashboard = url.includes('/dashboard')
        const isNotFoundPage = await page
            .getByRole('heading', { name: '404' })
            .isVisible()
            .catch(() => false)

        // The important thing is they're not viewing Business A's content
        if (isNotFoundPage) {
            // 404 page shown - this is valid multi-tenant protection
            expect(isNotFoundPage).toBe(true)
        } else {
            // User was redirected - verify they're NOT on Business A
            // and ideally on their own Business B or dashboard root
            expect(url).not.toContain(businessIdA)

            // Positive validation: if redirected to a business page, it should be Business B
            const currentBusinessId = await getCurrentBusinessId(page)
            if (currentBusinessId) {
                expect(currentBusinessId).toBe(businessIdB)
            }
        }
        expect(isNotFoundPage || isOnDashboard).toBe(true)
    })

    test('user only sees their own businesses in the dashboard list', async ({ page }) => {
        // === Setup User A with Business A ===
        const emailA = generateTestEmail()
        const passwordA = 'TestPassword123!'
        const businessNameA = `Solo Mio A ${Date.now()}`

        await signupUser(page, emailA, passwordA)
        await createBusiness(page, businessNameA)

        // Logout
        await page.context().clearCookies()

        // === Setup User B with Business B ===
        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = `Solo Mio B ${Date.now()}`

        await signupUser(page, emailB, passwordB)
        await createBusiness(page, businessNameB)

        // Go to dashboard
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        // User B should see Business B
        await expect(page.getByText(businessNameB)).toBeVisible()

        // User B should NOT see Business A
        const businessAVisible = await page
            .getByText(businessNameA)
            .isVisible()
            .catch(() => false)
        expect(businessAVisible).toBe(false)
    })

    test("API returns 403 when accessing another business's resources", async ({ page, request }) => {
        // === Setup User A with Business A ===
        const emailA = generateTestEmail()
        const passwordA = 'TestPassword123!'
        const businessNameA = `API Test A ${Date.now()}`

        await signupUser(page, emailA, passwordA)
        await createBusiness(page, businessNameA)

        // Navigate to get the businessId
        const businessIdA = await navigateToBusinessAgenda(page)

        // Logout User A
        await page.context().clearCookies()

        // === Setup User B ===
        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = `API Test B ${Date.now()}`

        await signupUser(page, emailB, passwordB)
        await createBusiness(page, businessNameB)

        // === User B tries to call API for Business A ===
        // Get the session cookies from the browser context
        const cookies = await page.context().cookies()
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
    })

    test("resources list shows only current business's resources", async ({ page }) => {
        // === Setup User A with Business A and Resource ===
        const emailA = generateTestEmail()
        const passwordA = 'TestPassword123!'
        const businessNameA = `Resources Test A ${Date.now()}`
        const resourceNameA = `Recurso Exclusivo A ${Date.now()}`

        await signupUser(page, emailA, passwordA)
        await createBusiness(page, businessNameA)
        await createResource(page, resourceNameA)

        // Logout
        await page.context().clearCookies()

        // === Setup User B with Business B and Resource ===
        const emailB = generateTestEmail()
        const passwordB = 'TestPassword123!'
        const businessNameB = `Resources Test B ${Date.now()}`
        const resourceNameB = `Recurso Exclusivo B ${Date.now()}`

        await signupUser(page, emailB, passwordB)
        await createBusiness(page, businessNameB)
        await createResource(page, resourceNameB)

        // Verify User B only sees Resource B in dashboard
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        // User B should see their resource
        await expect(page.getByText(resourceNameB)).toBeVisible()

        // User B should NOT see User A's resource
        const resourceAVisible = await page
            .getByText(resourceNameA)
            .isVisible()
            .catch(() => false)
        expect(resourceAVisible).toBe(false)
    })
})
