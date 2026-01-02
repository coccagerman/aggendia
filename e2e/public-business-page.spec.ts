/**
 * E2E Tests - Public Business Page (US-1.4)
 *
 * Tests end-to-end de la página pública del negocio y link compartible.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'

test.describe('Public Business Page E2E', () => {
    test('muestra página pública cuando el slug existe', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Public Business ${Date.now()}`

        // Setup: crear negocio
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

        // Obtener el slug real desde el dashboard (evita acoplar a la DB en el test)
        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar que la página se carga correctamente
        await expect(page).toHaveURL(`/b/${slug}`)
        // El título es un CardTitle (heading) con el texto "Bienvenido a {business.name}".
        // Usamos getByText para tolerar variaciones de nivel de heading y espacios.
        await expect(page.getByText(new RegExp(`Bienvenido a ${businessName}`, 'i'))).toBeVisible()
    })

    test('devuelve 404 cuando el slug no existe', async ({ page }) => {
        const response = await page.goto('/b/slug-inexistente-xyz-999')
        expect(response?.status()).toBe(404)
    })

    test('muestra mensaje de estado vacío sin servicios', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Empty Business ${Date.now()}`

        // Setup: crear negocio sin servicios
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

        // Obtener el slug desde el dashboard
        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar mensaje de estado vacío
        await expect(page.getByText(/estamos configurando los servicios/i)).toBeVisible()
        await expect(page.getByText(/volvé pronto/i)).toBeVisible()
    })

    test('dashboard muestra link público copiable', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Link Test Business ${Date.now()}`

        // Crear negocio
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

        // Verificar que aparece el link público
        await expect(page.getByText(/link público para compartir/i)).toBeVisible()
        await expect(page.getByText(/\/b\//)).toBeVisible()

        // Verificar botón de copiar
        const copyButton = page.getByRole('button', { name: /copiar/i })
        await expect(copyButton).toBeVisible()

        // Permiso de portapapeles para asegurar el estado "Copiado"
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
            origin: 'http://localhost:3000'
        })

        // Click en copiar
        await copyButton.click()

        // Verificar feedback de copiado (aparece por 2 segundos)
        await expect(page.getByRole('button', { name: /copiado/i })).toBeVisible({ timeout: 3000 })
    })
})
