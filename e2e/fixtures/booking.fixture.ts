/**
 * E2E Fixtures - Booking
 *
 * Fixtures para tests de flujos de reserva.
 * Crea un setup completo: negocio + recurso + servicio + disponibilidad.
 */

import { test as businessTest, expect } from './business.fixture'
import type { BusinessFixtures, TestBusinessData } from './business.fixture'
import { Page } from '@playwright/test'
import { generateUniqueId } from '../helpers/unique-id.helper'

export type BookableSetupData = TestBusinessData & {
    resourceName: string
    resourceId: string
    serviceName: string
    serviceId: string
}

export type BookingFixtures = BusinessFixtures & {
    /** Setup completo para flujos de booking */
    bookableSetup: BookableSetupData
}

/**
 * Helper para agregar disponibilidad a un día
 */
async function addRangeForDay(page: Page, dayLabel: string) {
    const dayCard = page
        .getByRole('heading', { name: new RegExp(`^${dayLabel}$`) })
        .locator('xpath=ancestor::div[contains(@class,"rounded-lg")]')
        .first()

    await dayCard
        .getByRole('button', { name: /^Agregar$/i })
        .first()
        .click()
}

/**
 * Fixture que crea un setup completo para booking:
 * - Negocio
 * - Recurso con disponibilidad (todos los días)
 * - Servicio asignado al recurso
 *
 * Uso:
 * ```typescript
 * import { test, expect } from '../fixtures/booking.fixture'
 *
 * test('flujo de reserva', async ({ authenticatedPage, bookableSetup }) => {
 *   const { slug, serviceName, resourceName } = bookableSetup
 *   await page.goto(`/b/${slug}`)
 *   // ...
 * })
 * ```
 */
export const test = businessTest.extend<{ bookableSetup: BookableSetupData }>({
    bookableSetup: async ({ authenticatedPage, testBusiness }, applyFixture) => {
        const page = authenticatedPage
        const uniqueId = generateUniqueId()
        const resourceName = `Recurso ${uniqueId.slice(0, 8)}`
        const serviceName = `Servicio ${uniqueId.slice(0, 8)}`

        // Crear recurso
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await page.waitForURL('/dashboard', { timeout: 10000 })

        // Obtener resourceId via API
        const resourcesResponse = await page.request.get(`/api/v1/businesses/${testBusiness.businessId}/resources`)
        const resourcesData = await resourcesResponse.json()
        const resource = resourcesData.data.find((r: { name: string }) => r.name === resourceName)
        const resourceId = resource?.id || ''

        // Crear servicio
        await page.goto(`/dashboard/business/${testBusiness.businessId}/services`)

        await page
            .getByRole('button', { name: /crear servicio/i })
            .first()
            .click()

        const dialog = page.getByRole('dialog', { name: /crear servicio/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })
        await dialog.getByLabel(/nombre/i).fill(serviceName)
        await dialog.getByRole('button', { name: /crear servicio/i }).click()
        await expect(dialog).not.toBeVisible({ timeout: 5000 })

        // Obtener serviceId via API
        const servicesResponse = await page.request.get(`/api/v1/businesses/${testBusiness.businessId}/services`)
        const servicesData = await servicesResponse.json()
        const service = servicesData.data.find((s: { name: string }) => s.name === serviceName)
        const serviceId = service?.id || ''

        // Asignar recurso al servicio
        await page.locator(`[data-testid="assign-resources-${serviceId}"]`).click()

        const assignDialog = page.getByRole('dialog', { name: /asignar recursos/i })
        await expect(assignDialog).toBeVisible({ timeout: 5000 })

        const checkbox = page.getByRole('checkbox', { name: resourceName })
        await checkbox.check({ force: true })
        await assignDialog.getByRole('button', { name: /guardar/i }).click()
        await expect(assignDialog).not.toBeVisible({ timeout: 10000 })

        // Configurar disponibilidad del recurso
        await page.goto('/dashboard')
        await page.waitForLoadState('domcontentloaded')

        await page.getByText(resourceName).first().click()
        await page.waitForLoadState('domcontentloaded')

        await page.getByRole('tab', { name: /disponibilidad/i }).click()
        await page.waitForLoadState('domcontentloaded')

        // Agregar disponibilidad para todos los días
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        for (const day of days) {
            await addRangeForDay(page, day)
        }

        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await expect(page.getByText(/guardad/i)).toBeVisible({ timeout: 10000 })

        await applyFixture({
            ...testBusiness,
            resourceName,
            resourceId,
            serviceName,
            serviceId
        })
    }
})

export { expect }
