/**
 * E2E Tests - Service Creation and Management Flow
 *
 * Tests end-to-end del flujo completo de creación y gestión de servicios.
 * Cada test usa su propio usuario y negocio (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures/business.fixture'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Service Creation E2E', () => {
    test('complete service creation flow', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio')

        // Navegar a la página de servicios
        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        // Abrir dialog de creación
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Completar formulario
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        // Verificar toast de éxito y servicio en listado
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 5000 })
    })

    test('creates service with all fields', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio Completo')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page.getByRole('button', { name: /crear servicio/i }).click()

        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByLabel(/descripción/i).fill('Descripción completa del servicio de prueba')

        // Cambiar duración a 60 min
        await page
            .getByLabel(/duración/i)
            .first()
            .selectOption('60')

        // Agregar periodicidad
        await page.getByLabel(/periodicidad/i).fill('75')

        // Agregar precio
        await page.getByLabel(/precio/i).fill('1500')

        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText('60 min')).toBeVisible()
        await expect(page.getByText(/Cada 75 min/)).toBeVisible()
        await expect(page.getByText(/\$.*1.*500/)).toBeVisible()
    })

    test('shows error when creating duplicate service', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio Duplicado')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        // Crear primer servicio
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Intentar crear duplicado
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        await expect(
            page
                .getByText(/ya existe.*servicio.*ese nombre/i)
                .or(page.getByText('Ya existe un servicio con ese nombre en este negocio.'))
        ).toBeVisible({ timeout: 10000 })
    })

    test('validates duration is multiple of 5', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio Test')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page.getByRole('button', { name: /crear servicio/i }).click()

        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByText(/duración personalizada/i).click()
        await page
            .getByLabel(/duración/i)
            .first()
            .fill('17')

        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        await expect(page.getByText(/múltiplo de 5/i)).toBeVisible({ timeout: 5000 })
    })

    test('creates service with minimum booking notice', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio Con Anticipación')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page.getByRole('button', { name: /crear servicio/i }).click()

        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByLabel(/anticipación mínima/i).fill('180')

        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click({ force: true })

        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(serviceName)).toBeVisible()
    })

    test('shows empty state when no services', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await expect(page.getByText(/no hay servicios/i).first()).toBeVisible()
        await expect(page.getByText(/creá tu primer servicio/i).first()).toBeVisible()
    })

    test('canceling dialog does not create service', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio Cancelado')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByRole('button', { name: /cancelar/i }).click()

        await expect(page.getByRole('dialog')).not.toBeVisible()
        await expect(page.getByText(serviceName)).not.toBeVisible()
        await expect(page.getByText(/no hay servicios/i)).toBeVisible()
    })
})

test.describe('Service Edit E2E', () => {
    test('edit service name via dropdown menu', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const originalName = generateUniqueName('Original')
        const updatedName = generateUniqueName('Updated')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(originalName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(originalName)).toBeVisible()

        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()

        await expect(page.getByText(/afecta nuevas reservas/i)).toBeVisible()

        await page.getByLabel(/nombre del servicio/i).fill(updatedName)
        await page.getByRole('button', { name: /guardar cambios/i }).evaluate(el => (el as HTMLElement).click())

        await expect(page.getByText(/servicio actualizado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('dialog')).not.toBeVisible()
        await expect(page.getByText(updatedName)).toBeVisible()
        await expect(page.getByText(originalName)).not.toBeVisible()
    })

    test('edit service duration and price', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Service Edit')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByLabel(/duración/i)
            .first()
            .selectOption('30')
        await page.getByLabel(/precio/i).fill('100')
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        await expect(page.getByText(/^⏱️ 30 min$/)).toBeVisible()
        await expect(page.getByText(/\$.*100/)).toBeVisible()

        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()

        await page
            .getByLabel(/duración/i)
            .first()
            .selectOption('60')

        await page.getByLabel(/precio/i).clear()
        await page.getByLabel(/precio/i).fill('250')

        await page.getByRole('button', { name: /guardar cambios/i }).evaluate(el => (el as HTMLElement).click())
        await expect(page.getByText(/servicio actualizado/i)).toBeVisible({ timeout: 10000 })

        await expect(page.getByText('60 min')).toBeVisible()
        await expect(page.getByText(/\$.*250/)).toBeVisible()
    })

    test('edit service shows error for duplicate name', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const service1Name = generateUniqueName('Service One')
        const service2Name = generateUniqueName('Service Two')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        // Crear servicio 1
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(service1Name)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(service1Name)).toBeVisible()

        // Crear servicio 2
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(service2Name)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(service2Name)).toBeVisible()

        // Editar servicio 2 con nombre de servicio 1
        const service2Item = page.locator('div.rounded-lg.border').filter({ hasText: service2Name })
        await service2Item.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await page.getByLabel(/nombre del servicio/i).fill(service1Name)

        await page.getByRole('button', { name: /guardar cambios/i }).evaluate(el => (el as HTMLElement).click())

        await expect(page.getByText(/ya existe un servicio con ese nombre/i)).toBeVisible({ timeout: 10000 })
    })

    test('canceling edit does not save changes', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Service Cancel')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill('Nombre Modificado')

        await page.getByRole('button', { name: /cancelar/i }).evaluate(el => (el as HTMLElement).click())

        await expect(page.getByRole('dialog')).not.toBeVisible()
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText('Nombre Modificado')).not.toBeVisible()
    })
})

test.describe('Service Toggle Active E2E', () => {
    test('deactivate and reactivate service', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Toggle Service')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Desactivar
        await page.waitForLoadState('domcontentloaded')
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /desactivar/i }).click()

        await expect(page.getByText(/dejará de aparecer en tu página pública/i)).toBeVisible()
        await page.getByRole('button', { name: /^desactivar$/i }).click()

        await expect(page.getByText(/servicio desactivado/i)).toBeVisible({ timeout: 10000 })

        await page.reload()
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText('Inactivo', { exact: true })).toBeVisible()

        // Reactivar
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /activar/i }).click()

        await expect(page.getByText(/volverá a estar disponible/i)).toBeVisible()
        await page.getByRole('button', { name: /^activar$/i }).click()

        await expect(page.getByText(/servicio activado/i)).toBeVisible({ timeout: 10000 })

        await page.reload()
        await expect(page.getByText('Activo', { exact: true })).toBeVisible()
    })

    test('cancel toggle does not change service status', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Cancel Toggle')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /desactivar/i }).click()
        await expect(page.getByText(/dejará de aparecer/i)).toBeVisible()
        await page.getByRole('button', { name: /cancelar/i }).click()

        await expect(page.getByText('Activo', { exact: true })).toBeVisible()
        await expect(page.getByText('Inactivo', { exact: true })).not.toBeVisible()
    })
})

test.describe('Service Deletion E2E', () => {
    test('deletes service without future appointments', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Servicio a eliminar')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        await page.waitForLoadState('domcontentloaded')

        await expect(page.getByRole('heading', { name: serviceName })).toBeVisible({ timeout: 5000 })

        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /eliminar/i }).click()

        await expect(page.getByText(/¿estás seguro.*eliminar/i)).toBeVisible()
        await page.getByRole('button', { name: /^eliminar$/i }).click()

        await expect(page.getByText(/servicio eliminado/i)).toBeVisible({ timeout: 10000 })

        await expect(page.getByRole('heading', { name: serviceName })).not.toBeVisible({ timeout: 5000 })
    })

    test('cancel delete does not remove service', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const serviceName = generateUniqueName('Cancel Delete')

        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        await page.waitForLoadState('domcontentloaded')

        await expect(page.getByRole('heading', { name: serviceName })).toBeVisible({ timeout: 10000 })

        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /eliminar/i }).click()
        await expect(page.getByText(/¿estás seguro.*eliminar/i)).toBeVisible()
        await page.getByRole('button', { name: /cancelar/i }).click()

        await expect(page.getByRole('heading', { name: serviceName })).toBeVisible()
    })
})
