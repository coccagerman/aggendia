/**
 * E2E Tests - Resource Creation Flow
 *
 * Tests end-to-end del flujo completo de creación de recursos.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'

test.describe('Resource Creation E2E', () => {
    test('complete resource creation flow', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Resource ${Date.now()}`

        // 1. Signup
        await signupUser(page, email, password)

        // 2. Create a business first
        await page.getByRole('link', { name: /crear negocio/i }).click()
        await page.getByLabel(/nombre/i).fill(businessName)
        await page.getByLabel(/zona horaria/i).click()
        await page
            .getByRole('option', { name: /buenos aires/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // 3. Wait for redirect to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
        await expect(page.getByText(businessName)).toBeVisible()

        // 4. Click "Crear recurso" button for the business
        await Promise.all([
            page.waitForURL('**/dashboard/business/**/resources/new', { timeout: 10000 }),
            page
                .getByRole('link', { name: /crear.*recurso/i })
                .first()
                .click()
        ])

        // 6. Fill the form
        await page.getByLabel(/nombre/i).fill(resourceName)

        // 7. Submit form
        await page.getByRole('button', { name: /crear/i }).click()

        // 8. Should redirect back to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // 9. Resource should appear in the business card
        await expect(page.getByText(resourceName)).toBeVisible({ timeout: 5000 })
    })

    test('shows error when creating duplicate resource', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Duplicate Resource ${Date.now()}`

        // Setup: create business
        await signupUser(page, email, password)
        await page.getByRole('link', { name: /crear negocio/i }).click()
        await page.getByLabel(/nombre/i).fill(businessName)
        await page.getByLabel(/zona horaria/i).click()
        await page
            .getByRole('option', { name: /buenos aires/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear negocio/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Create first resource
        await Promise.all([
            page.waitForURL('**/dashboard/business/**/resources/new', { timeout: 10000 }),
            page
                .getByRole('link', { name: /crear.*recurso/i })
                .first()
                .click()
        ])
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Try to create duplicate
        await Promise.all([
            page.waitForURL('**/dashboard/business/**/resources/new', { timeout: 10000 }),
            page
                .getByRole('link', { name: /crear.*recurso/i })
                .first()
                .click()
        ])
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()

        // Should show error message about duplicate
        const nameError = page.locator('#name-error')
        const generalError = page.getByText(/ocurri[oó] un error|error/i)

        await expect(nameError.or(generalError)).toBeVisible({ timeout: 10000 })

        if (await nameError.isVisible().catch(() => false)) {
            await expect(nameError).toContainText(/ya existe|duplicado|conflict/i)
        } else {
            await expect(generalError).toBeVisible()
        }
    })
})
