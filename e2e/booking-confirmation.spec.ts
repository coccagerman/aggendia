/**
 * E2E Tests - Booking Confirmation (US-5.4)
 *
 * Tests end-to-end del flujo de confirmación de reserva.
 * Usa fixtures para aislamiento completo entre tests paralelos.
 *
 * @see docs/user-stories.md - US-5.4
 */

import { test, expect } from './fixtures/booking.fixture'

test.describe('Booking Confirmation E2E (US-5.4)', () => {
    test('flujo completo: selecciona slot → completa formulario → ve confirmación', async ({
        authenticatedPage,
        bookableSetup
    }) => {
        const page = authenticatedPage
        const { slug, serviceName, resourceName } = bookableSetup

        // Navegar a página pública
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        // Click en servicio → auto-redirige a slots (solo 1 recurso)
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        // Esperar slots
        await page.waitForLoadState('networkidle')

        // Click en primer slot
        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })
        await firstSlotButton.click()

        // Verificar navegación a /book
        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Verificar resumen de reserva
        await expect(page.getByText('Resumen de la reserva')).toBeVisible()
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText(resourceName)).toBeVisible()

        // Completar formulario
        await page.getByLabel(/nombre completo/i).fill('Juan Pérez Test')
        await page.getByLabel(/email/i).fill('juan.test@example.com')
        await page.getByLabel(/teléfono/i).fill('+5491112345678')

        // Submit
        await page.getByRole('button', { name: /confirmar reserva/i }).click()

        // Verificar pantalla de éxito
        await expect(page.getByText(/reserva confirmada/i)).toBeVisible({
            timeout: 10000
        })
        await expect(page.getByText('Juan Pérez Test')).toBeVisible()
        await expect(page.getByText(/te enviamos una confirmación/i)).toBeVisible()
    })

    test('muestra error cuando no completa nombre', async ({ authenticatedPage, bookableSetup }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        // Navegar hasta la página de booking
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })
        await firstSlotButton.click()

        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Intentar submit sin nombre
        await page.getByLabel(/email/i).fill('test@example.com')
        await page.getByRole('button', { name: /confirmar reserva/i }).click()

        // Verificar error de validación
        await expect(page.getByText(/nombre es requerido/i)).toBeVisible()
    })

    test('muestra error cuando no proporciona email ni teléfono', async ({ authenticatedPage, bookableSetup }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })
        await firstSlotButton.click()

        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Completar solo nombre
        await page.getByLabel(/nombre completo/i).fill('Juan Sin Contacto')
        await page.getByRole('button', { name: /confirmar reserva/i }).click()

        // Verificar error
        await expect(page.getByText(/proporcionar email o teléfono/i)).toBeVisible()
    })

    test('muestra "ya no disponible" cuando se intenta reservar slot ocupado', async ({
        authenticatedPage,
        bookableSetup,
        browser
    }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        // Navegar y seleccionar slot en primera pestaña
        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        await page.waitForLoadState('networkidle')

        // Obtener el slot seleccionable y su texto
        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })
        await firstSlotButton.click()

        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Guardar la URL para usarla en la segunda pestaña
        const bookingUrl = page.url()

        // Completar y confirmar primera reserva
        await page.getByLabel(/nombre completo/i).fill('Cliente 1')
        await page.getByLabel(/email/i).fill('cliente1@example.com')
        await page.getByRole('button', { name: /confirmar reserva/i }).click()

        await expect(page.getByText(/reserva confirmada/i)).toBeVisible({
            timeout: 10000
        })

        // Abrir segunda pestaña e intentar reservar el mismo slot
        const context2 = await browser.newContext()
        const page2 = await context2.newPage()

        // Ir directamente a la URL de booking con los mismos parámetros
        await page2.goto(bookingUrl)
        await page2.waitForLoadState('networkidle')

        // Intentar reservar
        await page2.getByLabel(/nombre completo/i).fill('Cliente 2')
        await page2.getByLabel(/email/i).fill('cliente2@example.com')
        await page2.getByRole('button', { name: /confirmar reserva/i }).click()

        // Verificar mensaje de error
        await expect(page2.getByText(/ya no está disponible/i)).toBeVisible({
            timeout: 10000
        })

        // Verificar botón para elegir otro horario
        await expect(page2.getByRole('button', { name: /elegir otro horario/i })).toBeVisible()

        await context2.close()
    })

    test('puede volver a elegir otro horario desde la página de booking', async ({
        authenticatedPage,
        bookableSetup
    }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })
        await firstSlotButton.click()

        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Click en "Elegir otro horario"
        await page.getByRole('link', { name: /elegir otro horario/i }).click()

        // Verificar que volvió a la página de slots
        await expect(page).toHaveURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), { timeout: 5000 })
    })

    test('puede volver al inicio desde pantalla de éxito', async ({ authenticatedPage, bookableSetup }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        await page.goto(`/b/${slug}`)
        await page.waitForLoadState('networkidle')

        await Promise.all([
            page.waitForURL(new RegExp(`/b/${slug}/service/.*/resource/.*/slots`), {
                timeout: 10000
            }),
            page.getByRole('link', { name: new RegExp(`Reservar ${serviceName}`, 'i') }).click()
        ])

        const firstSlotButton = page
            .getByRole('button')
            .filter({ hasText: /^\d{2}:\d{2}$/ })
            .first()
        await expect(firstSlotButton).toBeVisible({ timeout: 10000 })
        await firstSlotButton.click()

        await expect(page).toHaveURL(new RegExp(`/b/${slug}/book\\?`), {
            timeout: 5000
        })

        // Completar y confirmar
        await page.getByLabel(/nombre completo/i).fill('Cliente Final')
        await page.getByLabel(/email/i).fill('final@example.com')
        await page.getByRole('button', { name: /confirmar reserva/i }).click()

        await expect(page.getByText(/reserva confirmada/i)).toBeVisible({
            timeout: 10000
        })

        // Click en "Volver al inicio"
        await page.getByRole('button', { name: /volver al inicio/i }).click()

        // Verificar que volvió a la página del negocio
        await expect(page).toHaveURL(new RegExp(`/b/${slug}$`), { timeout: 5000 })
    })
})
