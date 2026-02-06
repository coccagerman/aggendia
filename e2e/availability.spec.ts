/**
 * E2E Tests - Availability Management Flow
 *
 * Tests end-to-end del flujo de gestión de disponibilidad semanal.
 * Cada test usa su propio usuario y negocio (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures/business.fixture'
import { navigateToCreateResource } from './helpers/business.helper'
import { generateUniqueName } from './helpers/unique-id.helper'

async function createResource(page: import('@playwright/test').Page, resourceName: string) {
    await navigateToCreateResource(page)
    await page.getByLabel(/nombre/i).fill(resourceName)
    await page.getByRole('button', { name: /crear/i }).click()
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
}

async function navigateToResourceDetail(page: import('@playwright/test').Page, businessId: string, resourceId: string) {
    await page.goto(`/dashboard/business/${businessId}/resources/${resourceId}`)
}

test.describe('Resource Availability E2E', () => {
    test('can add availability range to a day', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Avail Resource')

        await createResource(page, resourceName)

        // Get resourceId via API
        const response = await page.request.get(`/api/v1/businesses/${testBusiness.businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)
        expect(resource).toBeDefined()

        // Navigate to resource detail
        await navigateToResourceDetail(page, testBusiness.businessId, resource.id)

        // Click on Disponibilidad tab
        await page.getByRole('tab', { name: /disponibilidad/i }).click()

        // Check that we see the days
        await expect(page.getByText('Lunes')).toBeVisible()
        await expect(page.getByText('Sin horarios definidos').first()).toBeVisible()

        // Add a range to Monday
        const lunesSection = page.locator('div').filter({ hasText: /^LunesAgregarSin horarios definidos$/ })
        await lunesSection.getByRole('button', { name: /agregar/i }).click()

        // Should show time inputs
        await expect(page.locator('input[type="time"]').first()).toBeVisible()

        // Save changes
        await page.getByRole('button', { name: /guardar cambios/i }).click()

        // Should show success toast
        await expect(page.getByText(/disponibilidad guardada/i)).toBeVisible({ timeout: 10000 })
    })

    test('shows validation error for invalid range', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Invalid Range Resource')

        await createResource(page, resourceName)

        // Get resourceId
        const response = await page.request.get(`/api/v1/businesses/${testBusiness.businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)

        await navigateToResourceDetail(page, testBusiness.businessId, resource.id)
        await page.getByRole('tab', { name: /disponibilidad/i }).click()

        // Add a range to Monday
        const lunesSection = page.locator('div').filter({ hasText: /^LunesAgregarSin horarios definidos$/ })
        await lunesSection.getByRole('button', { name: /agregar/i }).click()

        // Set end time before start time (invalid)
        const timeInputs = page.locator('input[type="time"]')
        await timeInputs.first().fill('18:00')
        await timeInputs.nth(1).fill('09:00')

        // Try to save
        await page.getByRole('button', { name: /guardar cambios/i }).click()

        // Should show validation error
        await expect(page.getByText(/corregí los errores/i)).toBeVisible()
        await expect(page.getByText(/inicio debe ser menor/i)).toBeVisible()
    })

    test('can remove availability range', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Remove Range Resource')

        await createResource(page, resourceName)

        // Get resourceId
        const response = await page.request.get(`/api/v1/businesses/${testBusiness.businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)

        await navigateToResourceDetail(page, testBusiness.businessId, resource.id)
        await page.getByRole('tab', { name: /disponibilidad/i }).click()

        // Add a range
        const lunesSection = page.locator('div').filter({ hasText: /^LunesAgregarSin horarios definidos$/ })
        await lunesSection.getByRole('button', { name: /agregar/i }).click()

        // Save
        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await expect(page.getByText(/disponibilidad guardada/i)).toBeVisible({ timeout: 10000 })

        // Reload to verify persistence
        await page.reload()
        await page.getByRole('tab', { name: /disponibilidad/i }).click()

        // Should see the saved range (time inputs visible)
        await expect(page.locator('input[type="time"]').first()).toBeVisible()

        // Remove the range
        await page
            .getByRole('button')
            .filter({ has: page.locator('svg.lucide-trash-2') })
            .click()

        // Save
        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await expect(page.getByText(/disponibilidad guardada/i)).toBeVisible({ timeout: 10000 })

        // Reload and verify removed
        await page.reload()
        await page.getByRole('tab', { name: /disponibilidad/i }).click()
        await expect(page.getByText('Sin horarios definidos').first()).toBeVisible()
    })

    test('discard changes resets to initial state', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Discard Resource')

        await createResource(page, resourceName)

        // Get resourceId
        const response = await page.request.get(`/api/v1/businesses/${testBusiness.businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)

        await navigateToResourceDetail(page, testBusiness.businessId, resource.id)
        await page.getByRole('tab', { name: /disponibilidad/i }).click()

        // Add a range
        const lunesSection = page.locator('div').filter({ hasText: /^LunesAgregarSin horarios definidos$/ })
        await lunesSection.getByRole('button', { name: /agregar/i }).click()

        // Time inputs should be visible
        await expect(page.locator('input[type="time"]').first()).toBeVisible()

        // Discard changes
        await page.getByRole('button', { name: /descartar cambios/i }).click()

        // Should be back to initial state
        await expect(page.getByText('Sin horarios definidos').first()).toBeVisible()
    })
})

test.describe('Availability API Security E2E', () => {
    test('cannot access availability of another business resource', async ({ page, testUser }) => {
        const { signupUser } = await import('./helpers/auth.helper')
        const { createBusiness } = await import('./helpers/business.helper')
        const { generateTestEmail } = await import('./helpers/unique-id.helper')

        // User 1 creates business + resource
        const email1 = testUser.email
        const password = testUser.password
        const businessName1 = generateUniqueName('Business1')
        const resourceName1 = generateUniqueName('Resource1')

        await signupUser(page, email1, password)
        await createBusiness(page, businessName1)

        // Create resource
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName1)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Get businessId and resourceId for user 1
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId1 = href?.match(/business\/([^/]+)/)?.[1]

        const response1 = await page.request.get(`/api/v1/businesses/${businessId1}/resources`)
        const data1 = await response1.json()
        const resource1 = data1.data.find((r: { name: string }) => r.name === resourceName1)

        // Logout
        await page.context().clearCookies()

        // User 2 creates their own business
        const email2 = generateTestEmail()
        const businessName2 = generateUniqueName('Business2')

        await signupUser(page, email2, password)
        await createBusiness(page, businessName2)

        // Try to access user 1's resource availability - should fail
        const response = await page.request.get(
            `/api/v1/businesses/${businessId1}/resources/${resource1.id}/availability`
        )

        // Should return 403 or 404
        expect([403, 404]).toContain(response.status())
    })
})
