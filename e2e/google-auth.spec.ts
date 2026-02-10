/**
 * E2E Tests - Google Auth
 *
 * Smoke tests para la integración de login con Google.
 * No se puede testear el flujo completo de OAuth (requiere interacción real con Google),
 * pero sí se verifica que:
 * - El botón "Continuar con Google" está visible en login y signup
 * - El callback route maneja correctamente accesos sin code
 * - El callback route redirige a /login con error cuando recibe un error param
 */

import { test, expect } from './fixtures'

test.describe('Google Auth', () => {
    test('shows Google sign-in button on login page', async ({ page }) => {
        await page.goto('/login')

        const googleButton = page.getByRole('button', { name: /continuar con google/i })
        await expect(googleButton).toBeVisible()
    })

    test('shows Google sign-in button on signup page', async ({ page }) => {
        await page.goto('/signup')

        const googleButton = page.getByRole('button', { name: /continuar con google/i })
        await expect(googleButton).toBeVisible()
    })

    test('callback without code redirects to login with error', async ({ page }) => {
        await page.goto('/auth/callback')

        // Debe redirigir a /login con un param de error
        await page.waitForURL('**/login?error=*', { timeout: 10000 })
        await expect(page).toHaveURL(/\/login\?error=/)
    })

    test('callback with error param redirects to login with message', async ({ page }) => {
        await page.goto('/auth/callback?error=access_denied&error_description=User+cancelled')

        await page.waitForURL('**/login?error=*', { timeout: 10000 })
        // El error del callback se muestra en la página de login
        await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 5000 })
    })

    test('login page shows OAuth error from query params', async ({ page }) => {
        await page.goto('/login?error=Test+OAuth+error+message')

        await expect(page.locator('[class*="bg-red"]')).toBeVisible({ timeout: 5000 })
        await expect(page.locator('[class*="bg-red"]')).toContainText('Test OAuth error message')
    })

    test('separator "o" is visible between Google button and email form', async ({ page }) => {
        await page.goto('/login')

        await expect(page.getByText('o', { exact: true })).toBeVisible()
    })
})
