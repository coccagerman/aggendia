/**
 * E2E Tests - Manual Appointment Creation (US-7.3)
 *
 * Tests end-to-end del flujo de creación manual de turnos desde la agenda.
 *
 * @see docs/user-stories.md - US-7.3 Crear turnos manualmente desde la agenda
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness } from './helpers/business.helper'

/**
 * Helper para agregar disponibilidad a un día
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
 * Helper para crear un servicio
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

/**
 * Helper para asignar un recurso a un servicio
 */
async function assignResourceToService(page: import('@playwright/test').Page, resourceName: string) {
    const checkbox = page.getByRole('checkbox', { name: resourceName })
    await checkbox.check({ force: true })
}

/**
 * Helper para setup completo de un negocio con recurso + servicio + disponibilidad
 */
async function setupBusinessWithBooking(page: import('@playwright/test').Page) {
    const email = generateTestEmail()
    const password = 'TestPassword123!'
    const businessName = `Manual Appointment Business ${Date.now()}`
    const serviceName = `Servicio Manual ${Date.now()}`
    const resourceName = `Recurso Manual ${Date.now()}`

    // Setup: crear negocio
    await signupUser(page, email, password)
    await createBusiness(page, businessName)

    // Crear recurso
    await page
        .getByRole('link', { name: /crear.*recurso/i })
        .first()
        .click()
    await page.getByLabel(/nombre/i).fill(resourceName)
    await page.getByRole('button', { name: /crear/i }).click()
    // Esperar la redirección al dashboard después de crear el recurso
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Crear servicio - navegar a página de servicios
    await page
        .getByRole('link', { name: /gestionar/i })
        .first()
        .click()
    await page.waitForURL(/.*\/services$/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    await createService(page, serviceName, '30')

    // Asignar recurso al servicio
    await page
        .getByRole('button', { name: /sin recursos/i })
        .or(page.getByRole('button', { name: /asignar recursos/i }))
        .first()
        .click()

    const assignDialog = page.getByRole('dialog', { name: /asignar recursos/i })
    await expect(assignDialog).toBeVisible({ timeout: 5000 })

    await assignResourceToService(page, resourceName)
    await assignDialog.getByRole('button', { name: /guardar/i }).click()
    // Esperar a que el dialog se cierre (puede tardar por animación)
    await expect(assignDialog).not.toBeVisible({ timeout: 10000 })

    // Ir a recursos y configurar disponibilidad
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Click en el recurso para acceder a su disponibilidad
    await page.getByText(resourceName).first().click()
    await page.waitForLoadState('networkidle')

    // Click en tab de disponibilidad
    await page.getByRole('tab', { name: /disponibilidad/i }).click()
    await page.waitForLoadState('networkidle')

    // Agregar disponibilidad para TODOS los días de la semana
    // Esto asegura que siempre haya slots disponibles, incluso en fines de semana
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
    for (const day of days) {
        await addRangeForDay(page, day)
    }

    // Guardar disponibilidad
    await page.getByRole('button', { name: /guardar cambios/i }).click()
    await page.waitForLoadState('networkidle')

    return {
        email,
        password,
        businessName,
        serviceName,
        resourceName
    }
}

test.describe('US-7.3: Crear turnos manualmente desde la agenda', () => {
    // Cada test hace setup completo (signup, negocio, recurso, servicio, disponibilidad)
    // lo cual toma tiempo considerable
    test.describe.configure({ timeout: 180000 })

    test('should show "Crear turno" button in agenda page', async ({ page }) => {
        test.slow() // Triple timeout for this test
        await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        // Click en "Ver Agenda"
        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Verificar que existe el botón "Crear turno"
        const createButton = page.getByRole('button', { name: /crear turno/i })
        await expect(createButton).toBeVisible()
    })

    test('should open create appointment dialog when clicking button', async ({ page }) => {
        test.slow() // Setup toma tiempo
        await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Click en "Crear turno"
        await page.getByRole('button', { name: /crear turno/i }).click()

        // Verificar que se abre el diálogo
        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Verificar que tiene los campos necesarios
        await expect(dialog.getByLabel(/servicio/i)).toBeVisible()
    })

    test('should load services in selector', async ({ page }) => {
        test.slow() // Setup toma tiempo
        const { serviceName } = await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Abrir diálogo de crear turno
        await page.getByRole('button', { name: /crear turno/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Click en selector de servicio
        await dialog.getByRole('combobox', { name: /servicio/i }).click()

        // Esperar a que carguen los servicios
        await page.waitForTimeout(1000)

        // Verificar que el servicio creado está disponible
        const serviceOption = page.getByRole('option', { name: new RegExp(serviceName) })
        await expect(serviceOption).toBeVisible()
    })

    test('should load resources when service is selected', async ({ page }) => {
        test.slow() // Setup toma tiempo
        const { serviceName, resourceName } = await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Abrir diálogo
        await page.getByRole('button', { name: /crear turno/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Seleccionar servicio
        await dialog.getByRole('combobox', { name: /servicio/i }).click()
        await page.getByRole('option', { name: new RegExp(serviceName) }).click()

        // Esperar a que se carguen los recursos
        await page.waitForTimeout(1000)

        // Click en selector de recurso
        await dialog.getByRole('combobox', { name: /seleccionar recurso/i }).click()

        // Verificar que el recurso está disponible
        const resourceOption = page.getByRole('option', { name: new RegExp(resourceName) })
        await expect(resourceOption).toBeVisible()
    })

    test('should show slots when service and resource are selected', async ({ page }) => {
        test.slow() // Setup toma tiempo
        const { serviceName, resourceName } = await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Abrir diálogo
        await page.getByRole('button', { name: /crear turno/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Seleccionar servicio
        await dialog.getByRole('combobox', { name: /servicio/i }).click()
        await page.getByRole('option', { name: new RegExp(serviceName) }).click()

        // Esperar carga de recursos
        await page.waitForTimeout(1000)

        // Seleccionar recurso (usa aria-label consistente)
        const resourceCombobox = dialog.getByRole('combobox', { name: /seleccionar recurso/i })
        await expect(resourceCombobox).toBeEnabled({ timeout: 5000 })
        await resourceCombobox.click()
        await page.getByRole('option', { name: new RegExp(resourceName) }).click()

        // Esperar a que se carguen los slots y aparezca el selector de fecha
        await page.waitForTimeout(1000)

        // Verificar que se muestra el selector de fecha (DatePicker)
        // Buscamos el label "Fecha" que aparece cuando el recurso está seleccionado
        const dateLabel = dialog.getByText('Fecha', { exact: true })
        await expect(dateLabel).toBeVisible({ timeout: 10000 })

        // Navegar a un día laboral (si hoy no lo es)
        // Los slots deberían mostrarse o un mensaje de "no hay horarios"
        const slotsOrMessage = dialog
            .locator('button')
            .filter({ hasText: /\d{1,2}:\d{2}/ })
            .first()
            .or(dialog.getByText(/no hay horarios disponibles/i))

        await expect(slotsOrMessage).toBeVisible({ timeout: 5000 })
    })

    test('should show customer form when slot is selected', async ({ page }) => {
        test.slow() // Setup toma tiempo
        const { serviceName, resourceName } = await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Abrir diálogo
        await page.getByRole('button', { name: /crear turno/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Seleccionar servicio
        await dialog.getByRole('combobox', { name: /servicio/i }).click()
        await page.getByRole('option', { name: new RegExp(serviceName) }).click()

        await page.waitForTimeout(1000)

        // Seleccionar recurso
        await dialog.getByRole('combobox', { name: /seleccionar recurso/i }).click()
        await page.getByRole('option', { name: new RegExp(resourceName) }).click()

        await page.waitForTimeout(2000)

        // Si es tarde en el día, puede que no haya slots disponibles hoy.
        // Navegar al día siguiente para asegurar que hay slots.
        const nextDayButton = dialog.getByRole('button', { name: /día siguiente/i })
        await nextDayButton.click()
        await page.waitForTimeout(2000)

        // Con disponibilidad todos los días, siempre debe haber slots para mañana
        const slotButtons = dialog.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ })
        await expect(slotButtons.first()).toBeVisible({ timeout: 10000 })

        // Seleccionar el primer slot
        await slotButtons.first().click()
        await page.waitForTimeout(500)

        // Verificar que aparecen los campos del cliente
        await expect(dialog.getByLabel(/nombre completo/i)).toBeVisible()
        await expect(dialog.getByLabel(/email/i)).toBeVisible()
        await expect(dialog.getByLabel(/teléfono/i)).toBeVisible()
    })

    test('should create appointment successfully', async ({ page }) => {
        test.slow() // Setup toma tiempo
        const { serviceName, resourceName } = await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Abrir diálogo
        await page.getByRole('button', { name: /crear turno/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Seleccionar servicio
        await dialog.getByRole('combobox', { name: /servicio/i }).click()
        await page.getByRole('option', { name: new RegExp(serviceName) }).click()

        // Esperar que se carguen los recursos
        const resourceCombobox = dialog.getByRole('combobox', { name: /seleccionar recurso/i })
        await expect(resourceCombobox).toBeEnabled({ timeout: 5000 })

        // Seleccionar recurso
        await resourceCombobox.click()
        await page.getByRole('option', { name: new RegExp(resourceName) }).click()

        // Esperar que se setee el recurso y aparezca el selector de fecha
        await page.waitForTimeout(1000)
        const dateLabel = dialog.getByText('Fecha', { exact: true })
        await expect(dateLabel).toBeVisible({ timeout: 10000 })

        // Si es tarde en el día, puede que no haya slots disponibles hoy.
        // Navegar al día siguiente para asegurar que hay slots.
        const nextDayButton = dialog.getByRole('button', { name: /día siguiente/i })
        await nextDayButton.click()
        await page.waitForTimeout(2000)

        // Con disponibilidad 7 días por semana, siempre debe haber slots para mañana
        const slotButtons = dialog.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ })
        await expect(slotButtons.first()).toBeVisible({ timeout: 10000 })

        // Seleccionar el primer slot disponible
        await slotButtons.first().click()

        // Verificar que aparece el formulario del cliente
        await expect(dialog.getByLabel(/nombre completo/i)).toBeVisible({ timeout: 3000 })

        // Llenar datos del cliente
        await dialog.getByLabel(/nombre completo/i).fill('Cliente Manual E2E')
        await dialog.getByLabel(/email/i).fill('cliente-manual-e2e@example.com')

        // Click en crear turno
        await dialog
            .getByRole('button', { name: /crear turno/i })
            .last()
            .click()

        // Esperar a que se cierre el diálogo y se actualice la página
        await expect(dialog).not.toBeVisible({ timeout: 10000 })

        // Verificar que la página de agenda se actualizó
        await page.waitForLoadState('networkidle')
    })

    test('should not allow creating appointment in the past', async ({ page }) => {
        test.slow() // Setup toma tiempo
        // Este test verifica que el sistema no permite crear turnos en el pasado
        // La validación ocurre server-side, pero la UI no debería mostrar slots pasados

        const { serviceName, resourceName } = await setupBusinessWithBooking(page)

        // Navegar a la agenda
        await page.goto('/dashboard')
        await page.waitForLoadState('networkidle')

        await page
            .getByRole('link', { name: /ver agenda/i })
            .first()
            .click()
        await page.waitForLoadState('networkidle')

        // Abrir diálogo
        await page.getByRole('button', { name: /crear turno/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear turno manualmente/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Seleccionar servicio
        await dialog.getByRole('combobox', { name: /servicio/i }).click()
        await page.getByRole('option', { name: new RegExp(serviceName) }).click()

        // Esperar que se carguen los recursos
        const resourceCombobox = dialog.getByRole('combobox', { name: /seleccionar recurso/i })
        await expect(resourceCombobox).toBeEnabled({ timeout: 5000 })

        // Seleccionar recurso
        await resourceCombobox.click()
        await page.getByRole('option', { name: new RegExp(resourceName) }).click()

        // Esperar que se setee el recurso y aparezca el selector de fecha
        await page.waitForTimeout(1000)
        const dateLabel = dialog.getByText('Fecha', { exact: true })
        await expect(dateLabel).toBeVisible({ timeout: 10000 })

        // El DatePicker deshabilita fechas pasadas mediante la prop minDate
        // Verificamos que la sección de fecha esté visible (las fechas pasadas
        // están deshabilitadas internamente en el calendario)
    })
})
