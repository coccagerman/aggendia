/**
 * E2E Tests - Auth Flow
 *
 * Tests end-to-end del flujo de autenticación.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser, loginUser } from './helpers/auth.helper'

test.describe('Auth Flow E2E', () => {
    test('complete signup flow', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'

        await signupUser(page, email, password)

        // Should be redirected to dashboard
        await expect(page).toHaveURL('/dashboard')
        await expect(page.getByText(/mis negocios/i)).toBeVisible()
    })

    test('login with correct credentials', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'

        // First signup
        await signupUser(page, email, password)

        // Clear cookies to simulate logout
        await page.context().clearCookies()

        // Then login
        await loginUser(page, email, password)

        // Should be redirected to dashboard
        await expect(page).toHaveURL('/dashboard')
    })

    test('shows error with wrong password', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'

        // First signup
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
