/**
 * E2E Tests - Landing Page
 *
 * Tests de la página principal.
 * Estos tests no requieren autenticación ni datos.
 */

import { test, expect } from '@playwright/test'

test.describe('Landing Page E2E', () => {
    test('renders home page correctly', async ({ page }) => {
        await page.goto('/')

        // Check main heading
        await expect(page.getByRole('heading', { name: /gestioná tus turnos/i })).toBeVisible()

        // Check CTA buttons
        await expect(page.getByRole('link', { name: /crear cuenta gratis/i })).toBeVisible()
        await expect(page.getByRole('link', { name: /iniciar sesión/i })).toBeVisible()

        // Check value proposition
        await expect(page.getByText(/dejá atrás el caos/i)).toBeVisible()
    })

    test('navigates to signup page', async ({ page }) => {
        await page.goto('/')
        await page.getByRole('link', { name: /crear cuenta gratis/i }).click()

        await expect(page).toHaveURL('/signup')
    })

    test('navigates to login page', async ({ page }) => {
        await page.goto('/')
        await page.getByRole('link', { name: /iniciar sesión/i }).click()

        await expect(page).toHaveURL('/login')
    })
})
