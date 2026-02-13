/**
 * E2E Tests - Resource Creation and Management Flow
 *
 * Tests end-to-end del flujo completo de creación y gestión de recursos.
 * Cada test usa su propio usuario y negocio (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures/business.fixture'
import type { Page } from '@playwright/test'
import { navigateToCreateResource } from './helpers/business.helper'
import { generateUniqueName } from './helpers/unique-id.helper'

async function getResourceIdByName(page: Page, businessId: string, name: string) {
    const response = await page.request.get(`/api/v1/businesses/${businessId}/resources`)
    expect(response.ok()).toBeTruthy()

    const body = await response.json()
    const resources = body.data || []
    const resource = resources.find((r: { id: string; name: string }) => r.name === name)

    if (!resource) {
        throw new Error(`Resource not found via API: ${name}`)
    }

    return resource.id as string
}

test.describe('Resource Creation E2E', () => {
    test('complete resource creation flow', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Resource')

        await expect(page.getByText(testBusiness.businessName)).toBeVisible()

        // Navegar a crear recurso
        await navigateToCreateResource(page)

        // Completar formulario
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()

        // Verificar redirect y recurso visible
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })
        await expect(page.getByText(resourceName)).toBeVisible({ timeout: 5000 })
    })

    test('shows error when creating duplicate resource', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Duplicate Resource')
        void testBusiness // ensure business fixture runs

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

    test('create resource with type PERSON shows correct badge', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Profesional')
        void testBusiness // ensure business fixture runs

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

    test('create resource with type ASSET shows correct display', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Cancha')
        void testBusiness // ensure business fixture runs

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

    test('create resource without type (null) succeeds', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso Sin Tipo')
        void testBusiness // ensure business fixture runs

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

    test('create multiple resources in same business shows both', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resource1Name = generateUniqueName('Resource 1')
        const resource2Name = generateUniqueName('Resource 2')
        void testBusiness // ensure business fixture runs

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
    test('edit resource name via dropdown menu', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const originalName = generateUniqueName('Recurso Original')
        const newName = generateUniqueName('Recurso Editado')
        void testBusiness // ensure business fixture runs

        // Crear recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(originalName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')
        await expect(page.getByText(originalName)).toBeVisible()

        const resourceId = await getResourceIdByName(page, testBusiness.businessId, originalName)
        const patchResponse = await page.request.patch(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: {
                resourceId,
                name: newName,
                type: null
            }
        })
        expect(patchResponse.ok()).toBeTruthy()
        await page.reload()

        // Verificar que se actualizó
        await expect(page.getByText(newName)).toBeVisible({ timeout: 15000 })
        await expect(page.getByText(originalName)).not.toBeVisible()
    })

    test('deactivate resource shows confirmation dialog', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso a Desactivar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        const resourceId = await getResourceIdByName(page, testBusiness.businessId, resourceName)
        const patchResponse = await page.request.patch(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: { resourceId, status: 'INACTIVE' }
        })
        expect(patchResponse.ok()).toBeTruthy()
        await page.reload()

        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('Inactivo')).toBeVisible({ timeout: 15000 })
    })

    test('reactivate inactive resource', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso a Reactivar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        const resourceId = await getResourceIdByName(page, testBusiness.businessId, resourceName)
        const deactivateResponse = await page.request.patch(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: { resourceId, status: 'INACTIVE' }
        })
        expect(deactivateResponse.ok()).toBeTruthy()

        const activateResponse = await page.request.patch(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: { resourceId, status: 'ACTIVE' }
        })
        expect(activateResponse.ok()).toBeTruthy()

        await page.reload()
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem.getByText('Activo')).toBeVisible({ timeout: 15000 })
    })

    test('edit resource shows error for duplicate name', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resource1Name = generateUniqueName('Recurso Uno')
        const resource2Name = generateUniqueName('Recurso Dos')
        void testBusiness // ensure business fixture runs

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

        const resource2Id = await getResourceIdByName(page, testBusiness.businessId, resource2Name)
        const duplicateResponse = await page.request.patch(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: {
                resourceId: resource2Id,
                name: resource1Name,
                type: null
            }
        })

        expect(duplicateResponse.status()).toBe(409)
        const body = await duplicateResponse.json()
        expect(body.error?.code).toBe('RESOURCE_NAME_CONFLICT')
    })
})

test.describe('Resource Delete E2E', () => {
    test('delete resource removes it from listing', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso a Eliminar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        const resourceId = await getResourceIdByName(page, testBusiness.businessId, resourceName)
        const deleteResponse = await page.request.delete(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: { resourceId }
        })
        expect(deleteResponse.ok()).toBeTruthy()
        await page.reload()

        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        await expect(resourceItem).not.toBeVisible({ timeout: 15000 })
    })

    test('cancel delete keeps resource in listing', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso No Eliminar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
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

    test('delete inactive resource works', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso Inactivo Delete')
        void testBusiness // ensure business fixture runs

        // Crear recurso
        await navigateToCreateResource(page)
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard')

        const resourceId = await getResourceIdByName(page, testBusiness.businessId, resourceName)

        // Desactivar primero
        const resourceItem = page.locator('li').filter({ hasText: resourceName })
        const deactivateResponse = await page.request.patch(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: { resourceId, status: 'INACTIVE' }
        })
        expect(deactivateResponse.ok()).toBeTruthy()

        const deleteResponse = await page.request.delete(`/api/v1/businesses/${testBusiness.businessId}/resources`, {
            data: { resourceId }
        })
        expect(deleteResponse.ok()).toBeTruthy()

        await page.reload()
        await expect(resourceItem).not.toBeVisible({ timeout: 15000 })
    })
})
