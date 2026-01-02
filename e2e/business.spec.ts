/**
 * E2E Tests - Business Creation Flow
 *
 * Tests end-to-end del flujo completo de creación de negocio.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'

test.describe('Business Creation E2E', () => {
    test('complete business creation flow', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'

        // 1. Signup
        await signupUser(page, email, password)

        // 2. Should be on dashboard
        await expect(page).toHaveURL('/dashboard')

        // 3. Click "Crear negocio" button
        await page.getByRole('link', { name: /crear negocio/i }).click()

        // 4. Should navigate to business creation form
        await expect(page).toHaveURL('/dashboard/business/new')

        // 5. Fill the form
        const businessName = `Test Business ${Date.now()}`
        await page.getByLabel(/nombre/i).fill(businessName)

        // Select timezone
        await page.getByLabel(/zona horaria/i).click()
        await page
            .getByRole('option', { name: /buenos aires/i })
            .first()
            .click()

        // Optional fields
        await page.getByLabel(/dirección/i).fill('Calle Test 123')
        await page.getByLabel(/ciudad/i).fill('CABA')

        // 6. Submit form
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // 7. Should redirect back to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // 8. Business should appear in the list
        await expect(page.getByText(businessName)).toBeVisible({ timeout: 5000 })
    })

    test('shows validation errors for empty form', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'

        await signupUser(page, email, password)
        await page.getByRole('link', { name: /crear negocio/i }).click()

        // Try to submit empty form
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // Should show client-side validation error
        await expect(page.getByText('El nombre del negocio es requerido.')).toBeVisible()
    })
})
