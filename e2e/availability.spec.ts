/**
 * E2E Tests - Availability Management Flow
 *
 * Tests end-to-end del flujo de gestión de disponibilidad semanal.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness, navigateToCreateResource } from './helpers/business.helper'

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
    test('can add availability range to a day', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Avail Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs from URL / page content
        // Navigate to resource list via dashboard link
        const resourceLink = page.getByText(resourceName)
        await expect(resourceLink).toBeVisible()

        // Get businessId from page (we need to navigate to resource detail)
        // First, find the "Crear Recurso" link to get the businessId
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]
        expect(businessId).toBeDefined()

        // Get resourceId - we need to query the API or navigate to find it
        // For now, navigate via clicking on the resource actions then getting URL
        // Alternative: make the resource name a link

        // Simplify: Use API to get resourceId
        const response = await page.request.get(`/api/v1/businesses/${businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)
        expect(resource).toBeDefined()

        // Navigate to resource detail
        await navigateToResourceDetail(page, businessId!, resource.id)

        // Click on Disponibilidad tab
        await page.getByRole('tab', { name: /disponibilidad/i }).click()

        // Check that we see the days
        await expect(page.getByText('Lunes')).toBeVisible()
        await expect(page.getByText('Sin horarios definidos').first()).toBeVisible()

        // Add a range to Monday (Lunes is index 1)
        const lunesSection = page.locator('div').filter({ hasText: /^LunesAgregarSin horarios definidos$/ })
        await lunesSection.getByRole('button', { name: /agregar/i }).click()

        // Should show time inputs
        await expect(page.locator('input[type="time"]').first()).toBeVisible()

        // Save changes
        await page.getByRole('button', { name: /guardar cambios/i }).click()

        // Should show success toast
        await expect(page.getByText(/disponibilidad guardada/i)).toBeVisible({ timeout: 10000 })
    })

    test('shows validation error for invalid range', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Invalid Range Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        const response = await page.request.get(`/api/v1/businesses/${businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)

        await navigateToResourceDetail(page, businessId!, resource.id)
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

    test('can remove availability range', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Remove Range Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        const response = await page.request.get(`/api/v1/businesses/${businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)

        await navigateToResourceDetail(page, businessId!, resource.id)
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

    test('discard changes resets to initial state', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Discard Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        const response = await page.request.get(`/api/v1/businesses/${businessId}/resources`)
        const data = await response.json()
        const resource = data.data.find((r: { name: string }) => r.name === resourceName)

        await navigateToResourceDetail(page, businessId!, resource.id)
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
    test('cannot access availability of another business resource', async ({ page }) => {
        // User 1 creates business + resource
        const email1 = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName1 = `Business1 ${Date.now()}`
        const resourceName1 = `Resource1 ${Date.now()}`

        await signupUser(page, email1, password)
        await createBusiness(page, businessName1)
        await createResource(page, resourceName1)

        // Get businessId and resourceId for user 1
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId1 = href?.match(/business\/([^/]+)/)?.[1]

        const response1 = await page.request.get(`/api/v1/businesses/${businessId1}/resources`)
        const data1 = await response1.json()
        const resource1 = data1.data.find((r: { name: string }) => r.name === resourceName1)

        // Logout
        await page.getByRole('button', { name: /cerrar sesión/i }).click()
        await expect(page).toHaveURL('/login')

        // User 2 creates their own business
        const email2 = generateTestEmail()
        const businessName2 = `Business2 ${Date.now()}`

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
