/**
 * E2E Tests - Business Creation Flow
 *
 * Tests end-to-end del flujo completo de creación de negocio.
 * Cada test usa su propio usuario único (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Business Creation E2E', () => {
    test('complete business creation flow', async ({ authenticatedPage }) => {
        const page = authenticatedPage
        const businessName = generateUniqueName('Test Business')

        // Should be on dashboard (fixture ya hizo signup)
        await expect(page).toHaveURL('/dashboard')

        // Click "Crear negocio" button
        await page.getByRole('link', { name: /crear negocio/i }).click()

        // Should navigate to business creation form
        await expect(page).toHaveURL('/dashboard/business/new')

        // Fill the form
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

        // Submit form
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // Should redirect back to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Business should appear in the list
        await expect(page.getByText(businessName)).toBeVisible({ timeout: 5000 })
    })

    test('shows validation errors for empty form', async ({ authenticatedPage }) => {
        const page = authenticatedPage

        await page.getByRole('link', { name: /crear negocio/i }).click()

        // Try to submit empty form
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // Should show client-side validation error
        await expect(page.getByText('El nombre del negocio es requerido.')).toBeVisible()
    })
})
