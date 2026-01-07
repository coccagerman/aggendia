/**
 * E2E Tests - Booking Flow: Select Service → Resource → View Slots (US-5.1, US-5.2, US-5.3)
 *
 * Tests end-to-end del flujo completo de reserva hasta la visualización de slots.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness } from './helpers/business.helper'

/**
 * Helper para asignar un recurso a un servicio en el dialog de asignación
 * El checkbox tiene aria-label con el nombre del recurso
 */
async function assignResourceToService(page: import('@playwright/test').Page, resourceName: string) {
    // El label del checkbox contiene el nombre del recurso
    const checkbox = page.getByRole('checkbox', { name: resourceName })
    await checkbox.check({ force: true })
}

/**
 * Helper para agregar un rango de disponibilidad a un día, scoping por la tarjeta del día
 */
async function addRangeForDay(page: import('@playwright/test').Page, dayLabel: string) {
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
 * Helper para crear un servicio desde la página de servicios
 */
async function createService(
    page: import('@playwright/test').Page,
    serviceName: string,
    durationMinutes: string = '30'
) {
    await page
        .getByRole('button', { name: /crear servicio/i })
        .first()
        .click()

    const dialog = page.getByRole('dialog', { name: /crear servicio/i })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByLabel(/nombre/i).fill(serviceName)
    await dialog.getByLabel(/duración/i).selectOption(durationMinutes)

    await dialog.getByRole('button', { name: /crear servicio/i }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
}

test.describe('Booking Flow - Service → Resource → Slots E2E', () => {
    test('flujo completo: selecciona servicio → recurso → ve slots disponibles', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Booking Flow Business ${Date.now()}`
        const serviceName = `Servicio Slots ${Date.now()}`
        const resourceName = `Recurso Slots ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Obtener el slug desde el dashboard
        const slugElement = page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear recurso
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Ir a página de servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        // Crear servicio
        await createService(page, serviceName, '60')

        // Abrir dialog de asignación de recursos
        // El botón muestra "Sin recursos" cuando no hay ninguno asignado
        await page
            .getByRole('button', { name: /sin recursos/i })
            .first()
            .click()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Asignar el recurso
        await assignResourceToService(page, resourceName)

        // Guardar y esperar que cierre el dialog
        await page.getByRole('button', { name: /guardar$/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

        // Configurar disponibilidad del recurso
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        // Click en el nombre del recurso para ir a la página de detalle
        await page.getByRole('link', { name: resourceName }).click()
        await expect(page).toHaveURL(/.*\/resources\/.*/, { timeout: 10000 })

        // Ir a la tab de Disponibilidad
        await page.getByRole('tab', { name: /disponibilidad/i }).click()
        await page.waitForLoadState('networkidle')

        // Agregar disponibilidad para Lunes 09:00-18:00
        await addRangeForDay(page, 'Lunes')

        // Guardar cambios de disponibilidad
        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await page.waitForLoadState('networkidle')
        await expect(page.getByText(/guardad/i)).toBeVisible({ timeout: 5000 })

        // Navegar a página pública del negocio
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        // Verificar que el servicio aparece (solo aparece si tiene recursos asignados)
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })

        // Click en el botón Reservar del servicio y esperar redirect a slots
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), { timeout: 10000 }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        // Verificar que la página de slots se carga correctamente
        await expect(page.getByText(/elegí tu horario/i)).toBeVisible()
        const summary = page.getByText(new RegExp(`${serviceName}\\s*\\u2022\\s*${resourceName}`))
        await expect(summary).toBeVisible()
    })

    test('muestra múltiples recursos cuando hay >1 disponible para el servicio', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Multi Resource Business ${Date.now()}`
        const serviceName = `Servicio Multi ${Date.now()}`
        const resource1Name = `Recurso A ${Date.now()}`
        const resource2Name = `Recurso B ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear 2 recursos
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resource1Name)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resource2Name)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Ir a página de servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        // Crear servicio
        await createService(page, serviceName, '30')

        // Abrir dialog de asignación
        await page
            .getByRole('button', { name: /sin recursos/i })
            .first()
            .click()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Asignar ambos recursos
        await assignResourceToService(page, resource1Name)
        await assignResourceToService(page, resource2Name)

        // Guardar
        await page.getByRole('button', { name: /guardar$/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

        // Navegar a página pública
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        // Verificar que el servicio aparece
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })

        // Click en servicio (botón Reservar) y esperar URL de selección de recurso
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/[^/]+$`), { timeout: 10000 }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        // Verificar que muestra página de selección de recurso
        await expect(page.getByText(/elegí.*recurso/i)).toBeVisible()

        // Verificar que ambos recursos aparecen
        await expect(page.getByText(resource1Name)).toBeVisible()
        await expect(page.getByText(resource2Name)).toBeVisible()
    })

    test('muestra estado vacío cuando no hay slots disponibles', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `No Slots Business ${Date.now()}`
        const serviceName = `Servicio Sin Slots ${Date.now()}`
        const resourceName = `Recurso Sin Disponibilidad ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear recurso (sin configurar disponibilidad)
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Ir a página de servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        // Crear servicio
        await createService(page, serviceName, '45')

        // Asignar recurso al servicio
        await page
            .getByRole('button', { name: /sin recursos/i })
            .first()
            .click()
        await expect(page.getByRole('dialog')).toBeVisible()

        await assignResourceToService(page, resourceName)

        await page.getByRole('button', { name: /guardar$/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

        // Navegar a página pública → servicio (auto-redirige a slots porque solo 1 recurso)
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), { timeout: 10000 }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        // Verificar mensaje de estado vacío (no hay disponibilidad configurada)
        await expect(page.getByText(/no hay horarios disponibles/i)).toBeVisible()
    })

    test('click en slot navega a página de confirmación con parámetros correctos', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Slot Click Business ${Date.now()}`
        const serviceName = `Servicio Click ${Date.now()}`
        const resourceName = `Recurso Click ${Date.now()}`

        // Setup completo: negocio, recurso con disponibilidad, servicio asignado
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear recurso
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Ir a página de servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        // Crear servicio
        await createService(page, serviceName, '30')

        // Asignar recurso
        await page
            .getByRole('button', { name: /sin recursos/i })
            .first()
            .click()
        await expect(page.getByRole('dialog')).toBeVisible()

        await assignResourceToService(page, resourceName)

        await page.getByRole('button', { name: /guardar$/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

        // Configurar disponibilidad para todos los días
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')
        await page.getByRole('link', { name: resourceName }).click()
        await expect(page).toHaveURL(/.*\/resources\/.*/, { timeout: 10000 })

        await page.getByRole('tab', { name: /disponibilidad/i }).click()
        await page.waitForLoadState('networkidle')

        // Agregar disponibilidad para todos los días de la semana
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        for (const day of days) {
            await addRangeForDay(page, day)
        }

        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await page.waitForLoadState('networkidle')
        await expect(page.getByText(/guardad/i)).toBeVisible({ timeout: 5000 })

        // Navegar a página pública → servicio → slots
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), { timeout: 10000 }),
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
        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), { timeout: 5000 })

        // Verificar que los parámetros están presentes
        const url = page.url()
        expect(url).toContain('serviceId=')
        expect(url).toContain('resourceId=')
        expect(url).toContain('startAt=')
    })
})
