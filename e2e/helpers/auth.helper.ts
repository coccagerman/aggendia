/**
 * E2E Helper - Auth
 *
 * Helper functions para autenticación en tests E2E.
 */

import { Page } from '@playwright/test'
import { generateTestEmail as generateTestEmailFromHelper } from './unique-id.helper'

export async function signupUser(page: Page, email: string, password: string) {
    await page.goto('/signup')
    await page.getByLabel(/email/i).fill(email)
    await page
        .getByLabel(/contraseña/i)
        .first()
        .fill(password)
    await page.getByLabel(/confirmar contraseña/i).fill(password)

    // Click signup and wait specifically for the API response
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/v1/auth/signup'), {
        timeout: 20000
    })
    await page.getByRole('button', { name: /crear cuenta/i }).click()

    const response = await responsePromise
    const status = response.status()

    if (status === 202) {
        // Email confirmation required: fall back to manual login
        await page.goto('/login')
    } else if (status === 200) {
        // Wait for navigation to complete - use domcontentloaded as networkidle can be flaky
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 })
    } else {
        const body = await response.json().catch(() => ({}))
        throw new Error(`Signup failed (status ${status}): ${JSON.stringify(body)}`)
    }

    // If we already landed on dashboard, finish
    if (page.url().includes('/dashboard')) {
        return
    }

    // If we were redirected to login or stayed on signup, perform an explicit login
    if (page.url().includes('/login') || page.url().includes('/signup')) {
        await page.goto('/login')
        await page.getByLabel(/email/i).fill(email)
        await page.getByLabel(/contraseña/i).fill(password)
        await page.getByRole('button', { name: /iniciar sesión/i }).click()
    }

    // Wait for final redirect to dashboard (covers auto-redirect or manual login)
    await page.waitForURL('**/dashboard', { timeout: 20000 })
}

export async function loginUser(page: Page, email: string, password: string) {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/contraseña/i).fill(password)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 20000 })
}

export async function logout(page: Page) {
    // Assuming there's a logout button in the dashboard
    await page.goto('/dashboard')
    const logoutButton = page.getByRole('button', { name: /cerrar sesión/i })
    if (await logoutButton.isVisible()) {
        await logoutButton.click()
    }
}

/**
 * Genera un email único para tests E2E usando UUID.
 * Seguro para ejecución paralela con múltiples workers.
 *
 * @deprecated Usar generateTestEmail de './unique-id.helper' directamente
 * o usar la fixture testUser que ya incluye email único.
 */
export function generateTestEmail(): string {
    return generateTestEmailFromHelper()
}
