/**
 * E2E Tests - Resource Creation and Management Flow
 *
 * Tests end-to-end del flujo completo de creación y gestión de recursos.
 * Cada test usa su propio usuario y negocio (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures/business.fixture'
import { navigateToCreateResource } from './helpers/business.helper'
import { generateUniqueName } from './helpers/unique-id.helper'

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

    test('deactivate resource shows confirmation dialog', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso a Desactivar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
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

    test('reactivate inactive resource', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso a Reactivar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
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
    test('delete resource removes it from listing', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const resourceName = generateUniqueName('Recurso a Eliminar')
        void testBusiness // ensure business fixture runs

        // Crear recurso
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
