/**
 * E2E Tests - Auth Flow
 *
 * Tests end-to-end del flujo de autenticación.
 * Cada test usa su propio usuario único (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures'
import { loginUser } from './helpers/auth.helper'

test.describe('Auth Flow E2E', () => {
    test('complete signup flow', async ({ authenticatedPage }) => {
        // authenticatedPage ya hizo signup automáticamente
        // Solo verificamos que llegó al dashboard
        await expect(authenticatedPage).toHaveURL('/dashboard')
        await expect(authenticatedPage.getByText(/mis negocios/i)).toBeVisible()
    })

    test('login with correct credentials', async ({ page, testUser }) => {
        const { email, password } = testUser
        // Nota: testUser genera datos pero NO hace signup automático
        // Para este test necesitamos hacer signup manual primero
        const { signupUser } = await import('./helpers/auth.helper')
        await signupUser(page, email, password)

        // Clear cookies to simulate logout
        await page.context().clearCookies()

        // Then login
        await loginUser(page, email, password)

        // Should be redirected to dashboard
        await expect(page).toHaveURL('/dashboard')
    })

    test('shows error with wrong password', async ({ page, testUser }) => {
        const { email, password } = testUser
        const { signupUser } = await import('./helpers/auth.helper')
        await signupUser(page, email, password)
        await page.context().clearCookies()

        // Try to login with wrong password
        await page.goto('/login')
        await page.getByLabel(/email/i).fill(email)
        await page.getByLabel(/contraseña/i).fill('WrongPassword!')
        await page.getByRole('button', { name: /iniciar sesión/i }).click()

        // Should show error message (within the error div)
        await expect(page.locator('div.bg-red-50').getByText(/credenciales|inválid|incorrecta/i)).toBeVisible({
            timeout: 5000
        })
    })

    test('blocks access to dashboard when not authenticated', async ({ page }) => {
        // Clear any existing session
        await page.context().clearCookies()

        // Try to access dashboard directly
        await page.goto('/dashboard')

        // Should be redirected to login
        await expect(page).toHaveURL('/login')
    })
})
