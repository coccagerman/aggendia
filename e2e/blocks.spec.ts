/**
 * E2E Tests - Resource Blocks Management Flow
 *
 * Tests end-to-end del flujo de gestión de bloqueos puntuales.
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

async function getResourceIdFromAPI(
    page: import('@playwright/test').Page,
    businessId: string,
    resourceName: string
): Promise<string> {
    const response = await page.request.get(`/api/v1/businesses/${businessId}/resources`)
    const data = await response.json()
    const resource = data.data.find((r: { name: string }) => r.name === resourceName)
    expect(resource).toBeDefined()
    return resource.id
}

async function getBusinessIdFromPage(page: import('@playwright/test').Page): Promise<string> {
    const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
    const href = await createResourceLink.getAttribute('href')
    const businessId = href?.match(/business\/([^/]+)/)?.[1]
    expect(businessId).toBeDefined()
    return businessId!
}

test.describe('Resource Blocks E2E', () => {
    test('can create a block for a resource', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Block Business ${Date.now()}`
        const resourceName = `Block Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const businessId = await getBusinessIdFromPage(page)
        const resourceId = await getResourceIdFromAPI(page, businessId, resourceName)

        // Navigate to resource detail
        await navigateToResourceDetail(page, businessId, resourceId)

        // Click on Bloqueos tab
        await page.getByRole('tab', { name: /bloqueos/i }).click()

        // Check empty state
        await expect(page.getByText(/no hay bloqueos definidos/i)).toBeVisible()

        // Click add block button
        await page.getByRole('button', { name: /agregar bloqueo/i }).click()

        // Modal should open
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(page.getByText(/nuevo bloqueo/i)).toBeVisible()

        // Fill the form - use a future date
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateStr = tomorrow.toISOString().split('T')[0]

        await page.locator('input#startDate').fill(dateStr)
        await page.locator('input#startTime').fill('09:00')
        await page.locator('input#endDate').fill(dateStr)
        await page.locator('input#endTime').fill('12:00')
        await page.locator('textarea#reason').fill('Mantenimiento programado')

        // Submit
        await page.getByRole('button', { name: /crear bloqueo/i }).click()

        // Should show success toast
        await expect(page.getByText(/bloqueo creado/i)).toBeVisible({ timeout: 10000 })

        // Modal should close
        await expect(page.getByRole('dialog')).not.toBeVisible()

        // Block should appear in the list
        await expect(page.getByText(/mantenimiento programado/i)).toBeVisible()
        // Duration should show (could be "3 horas" or "3.0 horas")
        await expect(page.getByText(/3(\.0)? horas/i)).toBeVisible()
    })

    test('shows validation error when start >= end', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Block Val Business ${Date.now()}`
        const resourceName = `Block Val Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const businessId = await getBusinessIdFromPage(page)
        const resourceId = await getResourceIdFromAPI(page, businessId, resourceName)

        // Navigate to resource detail and Bloqueos tab
        await navigateToResourceDetail(page, businessId, resourceId)
        await page.getByRole('tab', { name: /bloqueos/i }).click()

        // Click add block button
        await page.getByRole('button', { name: /agregar bloqueo/i }).click()

        // Fill with invalid range (end before start)
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const dateStr = tomorrow.toISOString().split('T')[0]

        await page.locator('input#startDate').fill(dateStr)
        await page.locator('input#startTime').fill('14:00')
        await page.locator('input#endDate').fill(dateStr)
        await page.locator('input#endTime').fill('09:00')

        // Submit
        await page.getByRole('button', { name: /crear bloqueo/i }).click()

        // Should show validation error
        await expect(page.getByText(/inicio debe ser anterior/i)).toBeVisible()
    })

    test('can delete a block', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Block Del Business ${Date.now()}`
        const resourceName = `Block Del Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const businessId = await getBusinessIdFromPage(page)
        const resourceId = await getResourceIdFromAPI(page, businessId, resourceName)

        // Create a block via API
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        const startAt = new Date(nextWeek)
        startAt.setHours(9, 0, 0, 0)
        const endAt = new Date(nextWeek)
        endAt.setHours(12, 0, 0, 0)

        const createResponse = await page.request.post(
            `/api/v1/businesses/${businessId}/resources/${resourceId}/blocks`,
            {
                data: {
                    startAt: startAt.toISOString(),
                    endAt: endAt.toISOString(),
                    reason: 'Block to delete'
                }
            }
        )
        expect(createResponse.ok()).toBe(true)

        // Navigate to resource detail and Bloqueos tab
        await navigateToResourceDetail(page, businessId, resourceId)
        await page.getByRole('tab', { name: /bloqueos/i }).click()

        // Block should be visible
        await expect(page.getByText(/block to delete/i)).toBeVisible()

        // Find the delete button: it's the button with a Trash2 icon in the block item
        // The block item is a div that contains the paragraph with "Block to delete"
        // We need to find the sibling button (AlertDialogTrigger) in that row
        const blockReasonParagraph = page.getByText(/block to delete/i)
        // Go up to the block card (flex container) and find the delete button
        const blockRow = blockReasonParagraph.locator(
            'xpath=ancestor::div[contains(@class, "flex") and contains(@class, "items-center") and contains(@class, "justify-between")]'
        )
        const deleteButton = blockRow.locator('button').filter({ has: page.locator('svg') })
        await deleteButton.click()

        // Wait for AlertDialog to open (it contains the title "¿Eliminar bloqueo?")
        await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 })

        // Confirm deletion - click the red "Eliminar" button in the dialog
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: /^eliminar$/i })
            .click()

        // Should show success toast
        await expect(page.getByText(/bloqueo eliminado/i)).toBeVisible({ timeout: 10000 })

        // Block should no longer be visible
        await expect(page.getByText(/block to delete/i)).not.toBeVisible()
    })

    test('shows error when creating overlapping block', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Block Overlap Business ${Date.now()}`
        const resourceName = `Block Overlap Resource ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await createResource(page, resourceName)

        // Get IDs
        const businessId = await getBusinessIdFromPage(page)
        const resourceId = await getResourceIdFromAPI(page, businessId, resourceName)

        // Use a date two weeks from now
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 14)
        const dateStr = nextWeek.toISOString().split('T')[0]

        // Navigate to resource detail and Bloqueos tab
        await navigateToResourceDetail(page, businessId, resourceId)
        await page.getByRole('tab', { name: /bloqueos/i }).click()

        // Create first block via UI (this will use local time interpretation)
        await page.getByRole('button', { name: /agregar bloqueo/i }).click()
        await page.locator('input#startDate').fill(dateStr)
        await page.locator('input#startTime').fill('09:00')
        await page.locator('input#endDate').fill(dateStr)
        await page.locator('input#endTime').fill('12:00')
        await page.locator('textarea#reason').fill('First block')
        await page.getByRole('button', { name: /crear bloqueo/i }).click()
        await expect(page.getByText(/bloqueo creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('dialog')).not.toBeVisible()

        // Try to create overlapping block (10:00-14:00 overlaps with 09:00-12:00)
        await page.getByRole('button', { name: /agregar bloqueo/i }).click()
        await page.locator('input#startDate').fill(dateStr)
        await page.locator('input#startTime').fill('10:00')
        await page.locator('input#endDate').fill(dateStr)
        await page.locator('input#endTime').fill('14:00')

        // Submit
        await page.getByRole('button', { name: /crear bloqueo/i }).click()

        // Should show overlap error (message from API: "Ya existe un bloqueo en ese rango de tiempo.")
        await expect(page.getByText(/ya existe un bloqueo/i)).toBeVisible({ timeout: 5000 })
    })
})
