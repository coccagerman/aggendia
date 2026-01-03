/**
 * E2E Tests - Resource Creation Flow
 *
 * Tests end-to-end del flujo completo de creación de recursos.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness, navigateToCreateResource } from './helpers/business.helper'

test.describe('Resource Creation E2E', () => {
    test('complete resource creation flow', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Resource ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await expect(page.getByText(businessName)).toBeVisible()

        // Navegar a crear recurso
        await navigateToCreateResource(page)

        // Completar formulario
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()

        // Verificar redirect y recurso visible
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
        await expect(page.getByText(resourceName)).toBeVisible({ timeout: 5000 })
    })

    test('shows error when creating duplicate resource', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Duplicate Resource ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear primer recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Intentar crear duplicado
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()

        // Debe mostrar error
        const nameError = page.locator('#name-error')
        const generalError = page.getByText(/ocurri[oó] un error|error/i)

        await expect(nameError.or(generalError)).toBeVisible({ timeout: 10000 })

        if (await nameError.isVisible().catch(() => false)) {
            await expect(nameError).toContainText(/ya existe|duplicado|conflict/i)
        } else {
            await expect(generalError).toBeVisible()
        }
    })

    test('create resource with type PERSON shows correct badge', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Profesional ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear recurso con type PERSON
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByLabel(/tipo/i).selectOption('PERSON')
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Verificar recurso con badge ACTIVE
        await expect(page.getByText(resourceName)).toBeVisible()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('ACTIVE')).toBeVisible()
    })

    test('create resource with type ASSET shows correct display', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Cancha ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear recurso con type ASSET
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByLabel(/tipo/i).selectOption('ASSET')
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Verificar recurso con badge ACTIVE
        await expect(page.getByText(resourceName)).toBeVisible()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('ACTIVE')).toBeVisible()
    })

    test('create resource without type (null) succeeds', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Recurso Sin Tipo ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear recurso sin tipo (default = null)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Verificar recurso con badge ACTIVE
        await expect(page.getByText(resourceName)).toBeVisible()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('ACTIVE')).toBeVisible()
    })

    test('create multiple resources in same business shows both', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resource1Name = `Resource 1 ${Date.now()}`
        const resource2Name = `Resource 2 ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear primer recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resource1Name)
        await page.getByLabel(/tipo/i).selectOption('PERSON')
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')
        await expect(page.getByText(resource1Name)).toBeVisible()

        // Crear segundo recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resource2Name)
        await page.getByLabel(/tipo/i).selectOption('ASSET')
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Verificar ambos recursos visibles
        await expect(page.getByText(resource1Name)).toBeVisible()
        await expect(page.getByText(resource2Name)).toBeVisible()
    })
})
