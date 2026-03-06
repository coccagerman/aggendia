/**
 * E2E Tests - App Disabled Mode
 *
 * Estos tests validan el modo de aplicación deshabilitada.
 * Se ejecutan únicamente cuando:
 * - APP_ENV=prod
 * - DISABLE_ENV=true
 */

import { test, expect } from '@playwright/test'

const isDisabledMode = process.env.APP_ENV === 'prod' && process.env.DISABLE_ENV === 'true'

test.describe('App Disabled Mode E2E', () => {
    test.skip(!isDisabledMode, 'Este spec solo aplica cuando APP_ENV=prod y DISABLE_ENV=true')

    test('allows only whitelisted public pages', async ({ page }) => {
        await page.goto('/')
        await expect(page).toHaveURL('/')

        await page.goto('/privacy')
        await expect(page).toHaveURL('/privacy')

        await page.goto('/terms')
        await expect(page).toHaveURL('/terms')

        await page.goto('/maintenance')
        await expect(page).toHaveURL('/maintenance')
        await expect(page.getByRole('heading', { name: /próximamente/i })).toBeVisible()
        await expect(page.getByText(/estamos trabajando en nuevas funcionalidades\. próximamente\./i)).toBeVisible()
    })

    test('redirects blocked app routes to /maintenance', async ({ page }) => {
        await page.goto('/login')
        await expect(page).toHaveURL('/maintenance')

        await page.goto('/signup')
        await expect(page).toHaveURL('/maintenance')

        await page.goto('/dashboard')
        await expect(page).toHaveURL('/maintenance')

        await page.goto('/b/slug-cualquiera')
        await expect(page).toHaveURL('/maintenance')
    })

    test('returns 503 APP_DISABLED on blocked APIs', async ({ request }) => {
        const authResponse = await request.post('/api/v1/auth/login', {
            data: { email: 'test@example.com', password: 'password123' }
        })

        expect(authResponse.status()).toBe(503)
        await expect(authResponse.json()).resolves.toMatchObject({
            error: {
                code: 'APP_DISABLED'
            }
        })

        const cronResponse = await request.get('/api/cron/reminders')
        expect(cronResponse.status()).toBe(503)
        await expect(cronResponse.json()).resolves.toMatchObject({
            error: {
                code: 'APP_DISABLED'
            }
        })
    })

    test('shows disabled auth CTAs on landing', async ({ page }) => {
        await page.goto('/')

        const loginButton = page.getByRole('button', { name: /^iniciar sesión$/i }).first()
        const signupButton = page.getByRole('button', { name: /^prueba gratis$/i }).first()

        await expect(loginButton).toBeVisible()
        await expect(signupButton).toBeVisible()
        await expect(loginButton).toBeDisabled()
        await expect(signupButton).toBeDisabled()

        await expect(page.getByRole('link', { name: /^iniciar sesión$/i })).toHaveCount(0)
        await expect(page.getByRole('link', { name: /^prueba gratis$/i })).toHaveCount(0)
    })
})
