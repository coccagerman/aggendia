/**
 * E2E Tests - Resource Creation and Management Flow
 *
 * Tests end-to-end del flujo completo de creación y gestión de recursos.
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

        // Verificar recurso con badge Activo
        await expect(page.getByText(resourceName)).toBeVisible()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('Activo')).toBeVisible()
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

        // Verificar recurso con badge Activo
        await expect(page.getByText(resourceName)).toBeVisible()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('Activo')).toBeVisible()
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

        // Verificar recurso con badge Activo
        await expect(page.getByText(resourceName)).toBeVisible()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('Activo')).toBeVisible()
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

test.describe('Resource Edit E2E', () => {
    test('edit resource name via dropdown menu', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const originalName = `Recurso Original ${Date.now()}`
        const newName = `Recurso Editado ${Date.now()}`

        // Setup: crear negocio y recurso
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(originalName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')
        await expect(page.getByText(originalName)).toBeVisible()

        // Abrir menú de acciones del recurso
        const resourceItem = page.locator('li').filter({ hasText: originalName })
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()

        // Clic en Editar
        await page.getByRole('menuitem', { name: /editar/i }).click()

        // Modificar nombre en el modal
        await page.getByLabel(/nombre/i).fill(newName)
        await page.getByRole('button', { name: /guardar/i }).click()

        // Verificar que se actualizó
        await expect(page.getByText(newName)).toBeVisible({ timeout: 5000 })
        await expect(page.getByText(originalName)).not.toBeVisible()
    })

    test('deactivate resource shows confirmation dialog', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Recurso a Desactivar ${Date.now()}`

        // Setup: crear negocio y recurso
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Abrir menú de acciones
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()

        // Clic en Desactivar
        await page.getByRole('menuitem', { name: /desactivar/i }).click()

        // Debe mostrar diálogo de confirmación
        await expect(page.getByText(/¿desactivar/i)).toBeVisible()
        await expect(page.getByText(/no estará disponible/i)).toBeVisible()

        // Confirmar desactivación
        await page.getByRole('button', { name: /^desactivar$/i }).click()

        // Verificar badge cambia a Inactivo
        await expect(resourceItem.getByText('Inactivo')).toBeVisible({ timeout: 5000 })
    })

    test('reactivate inactive resource', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Recurso a Reactivar ${Date.now()}`

        // Setup: crear negocio y recurso
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Desactivar primero
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /desactivar/i }).click()
        await page.getByRole('button', { name: /^desactivar$/i }).click()
        await expect(resourceItem.getByText('Inactivo')).toBeVisible({ timeout: 5000 })

        // Reactivar
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /activar/i }).click()

        // Verificar badge cambia a Activo
        await expect(resourceItem.getByText('Activo')).toBeVisible({ timeout: 5000 })
    })

    test('edit resource shows error for duplicate name', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resource1Name = `Recurso Uno ${Date.now()}`
        const resource2Name = `Recurso Dos ${Date.now()}`

        // Setup: crear negocio y dos recursos
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear primer recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resource1Name)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Crear segundo recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resource2Name)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Intentar editar segundo recurso con nombre del primero
        const resourceItem = page.locator('li').filter({ hasText: resource2Name })
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()

        await page.getByLabel(/nombre/i).fill(resource1Name)
        await page.getByRole('button', { name: /guardar/i }).click()

        // Debe mostrar error de duplicado
        await expect(page.getByText(/ya existe/i)).toBeVisible({ timeout: 5000 })
    })
})

test.describe('Resource Delete E2E', () => {
    test('delete resource removes it from listing', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Recurso a Eliminar ${Date.now()}`

        // Setup: crear negocio y recurso
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Verificar recurso en listado
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem).toBeVisible()

        // Abrir menú de acciones
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()

        // Clic en Eliminar
        await page.getByRole('menuitem', { name: /eliminar/i }).click()

        // Debe mostrar diálogo de confirmación
        await expect(page.getByText(/¿eliminar/i)).toBeVisible()
        await expect(page.getByText(/no se puede deshacer/i)).toBeVisible()

        // Confirmar eliminación
        await page.getByRole('button', { name: /^eliminar$/i }).click()

        // Verificar que el recurso desaparece del listado (usar locator específico)
        await expect(resourceItem).not.toBeVisible({ timeout: 5000 })
    })

    test('cancel delete keeps resource in listing', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Recurso No Eliminar ${Date.now()}`

        // Setup: crear negocio y recurso
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Abrir menú y diálogo de eliminar
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /eliminar/i }).click()
        await expect(page.getByText(/¿eliminar/i)).toBeVisible()

        // Cancelar
        await page.getByRole('button', { name: /cancelar/i }).click()

        // Verificar que el recurso sigue visible en el listado
        await expect(resourceItem).toBeVisible()
    })

    test('delete inactive resource works', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const resourceName = `Recurso Inactivo Delete ${Date.now()}`

        // Setup: crear negocio y recurso
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Desactivar primero
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /desactivar/i }).click()
        await page.getByRole('button', { name: /^desactivar$/i }).click()
        await expect(resourceItem.getByText('Inactivo')).toBeVisible({ timeout: 5000 })

        // Ahora eliminar
        await resourceItem.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /eliminar/i }).click()
        await page.getByRole('button', { name: /^eliminar$/i }).click()

        // Verificar que el recurso desaparece del listado
        await expect(resourceItem).not.toBeVisible({ timeout: 5000 })
    })
})
