/**
 * E2E Tests - Booking Flow: Select Service → Resource → View Slots (US-5.1, US-5.2, US-5.3)
 *
 * Tests end-to-end del flujo completo de reserva hasta la visualización de slots.
 * Usa fixtures para aislamiento completo entre tests paralelos.
 */

import { test, expect } from './fixtures/booking.fixture'
import { test as businessTest } from './fixtures/business.fixture'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Booking Flow - Service → Resource → Slots E2E', () => {
    test('flujo completo: selecciona servicio → recurso → ve slots disponibles', async ({
        authenticatedPage,
        bookableSetup
    }) => {
        const page = authenticatedPage
        const { slug, serviceName, resourceName } = bookableSetup

        // Navegar a página pública del negocio
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        // Verificar que el servicio aparece (solo aparece si tiene recursos asignados)
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })

        // Click en el botón Reservar del servicio y esperar redirect a slots
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        // Verificar que la página de slots se carga correctamente
        await expect(page.getByText(/elegí tu horario/i)).toBeVisible()
        const summary = page.getByText(new RegExp(`${serviceName}\\s*\\u2022\\s*${resourceName}`))
        await expect(summary).toBeVisible()
    })

    test('click en slot navega a página de confirmación con parámetros correctos', async ({
        authenticatedPage,
        bookableSetup
    }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        // Navegar a página pública → servicio → slots
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        // Esperar a que carguen los slots
        await page.waitForLoadState('networkidle')

        // Click en primer slot disponible (formato HH:MM)
        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })

        await firstSlotButton.click()

        // Verificar navegación a /b/{slug}/book con query params
        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Verificar que los parámetros están presentes
        const url = page.url()
        expect(url).toContain('serviceId=')
        expect(url).toContain('resourceId=')
        expect(url).toContain('startAt=')
    })
})

// Tests que requieren setup específico (múltiples recursos, sin disponibilidad)
// Usan businessTest para tener control total sobre la configuración
businessTest.describe('Booking Flow - Edge Cases', () => {
    businessTest(
        'muestra múltiples recursos cuando hay >1 disponible para el servicio',
        async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage
            const { slug, businessId } = testBusiness
            const serviceName = generateUniqueName('service')
            const resource1Name = generateUniqueName('resource-a')
            const resource2Name = generateUniqueName('resource-b')

            // Crear 2 recursos
            await page.goto(`/dashboard/business/${businessId}/resources/new`)
            await page.getByLabel(/nombre/i).fill(resource1Name)
            await page.getByRole('button', { name: /crear/i }).click()
            await page.waitForURL('/dashboard', { timeout: 10000 })

            await page.goto(`/dashboard/business/${businessId}/resources/new`)
            await page.getByLabel(/nombre/i).fill(resource2Name)
            await page.getByRole('button', { name: /crear/i }).click()
            await page.waitForURL('/dashboard', { timeout: 10000 })

            // Crear servicio
            await page.goto(`/dashboard/business/${businessId}/services`)
            await page
                .getByRole('button', { name: /crear servicio/i })
                .first()
                .click()

            const dialog = page.getByRole('dialog', { name: /crear servicio/i })
            await expect(dialog).toBeVisible({ timeout: 5000 })
            await dialog.getByLabel(/nombre/i).fill(serviceName)
            await dialog.getByRole('button', { name: /crear servicio/i }).click()
            await expect(dialog).not.toBeVisible({ timeout: 5000 })

            // Asignar ambos recursos al servicio
            await page
                .getByRole('button', { name: /sin recursos/i })
                .first()
                .click()
            await expect(page.getByRole('dialog')).toBeVisible()

            const checkbox1 = page.getByRole('checkbox', { name: resource1Name })
            const checkbox2 = page.getByRole('checkbox', { name: resource2Name })
            await checkbox1.check({ force: true })
            await checkbox2.check({ force: true })

            await page.getByRole('button', { name: /guardar$/i }).click()
            await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

            // Navegar a página pública
            await page.goto(`/b/${slug}`)
            await page.waitForLoadState('networkidle')

            // Verificar que el servicio aparece
            await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })

            // Click en servicio (botón Reservar) y esperar URL de selección de recurso
            await Promise.all([
                page.waitForURL(new RegExp(`/b/${slug}/service/[^/]+$`), {
                    timeout: 10000
                }),
                page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
            ])

            // Verificar que muestra página de selección de recurso
            await expect(page.getByText(/elegí.*recurso/i)).toBeVisible()

            // Verificar que ambos recursos aparecen
            await expect(page.getByText(resource1Name)).toBeVisible()
            await expect(page.getByText(resource2Name)).toBeVisible()
        }
    )

    businessTest(
        'muestra estado vacío cuando no hay slots disponibles',
        async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage
            const { businessId, slug } = testBusiness
            const serviceName = generateUniqueName('service')
            const resourceName = generateUniqueName('resource')

            // Crear recurso (sin configurar disponibilidad)
            await page.goto(`/dashboard/business/${businessId}/resources/new`)
            await page.getByLabel(/nombre/i).fill(resourceName)
            await page.getByRole('button', { name: /crear/i }).click()
            await page.waitForURL('/dashboard', { timeout: 10000 })

            // Crear servicio
            await page.goto(`/dashboard/business/${businessId}/services`)
            await page
                .getByRole('button', { name: /crear servicio/i })
                .first()
                .click()

            const dialog = page.getByRole('dialog', { name: /crear servicio/i })
            await expect(dialog).toBeVisible({ timeout: 5000 })
            await dialog.getByLabel(/nombre/i).fill(serviceName)
            await dialog.getByRole('button', { name: /crear servicio/i }).click()
            await expect(dialog).not.toBeVisible({ timeout: 5000 })

            // Asignar recurso al servicio
            await page
                .getByRole('button', { name: /sin recursos/i })
                .first()
                .click()
            await expect(page.getByRole('dialog')).toBeVisible()

            const checkbox = page.getByRole('checkbox', { name: resourceName })
            await checkbox.check({ force: true })

            await page.getByRole('button', { name: /guardar$/i }).click()
            await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

            // Navegar a página pública → servicio (auto-redirige a slots porque solo 1 recurso)
            await page.goto(`/b/${slug}`)
            await page.waitForLoadState('networkidle')

            await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
            await Promise.all([
                page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                    timeout: 10000
                }),
                page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
            ])

            // Verificar mensaje de estado vacío (no hay disponibilidad configurada)
            await expect(page.getByText(/no hay horarios disponibles/i)).toBeVisible()
        }
    )
})
