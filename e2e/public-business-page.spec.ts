/**
 * E2E Tests - Public Business Page (US-1.4, US-5.1, US-5.2)
 *
 * Tests end-to-end de la página pública del negocio y link compartible.
 * Usa fixtures para aislamiento completo entre tests paralelos.
 */

import { test, expect } from './fixtures/business.fixture'
import { test as bookingTest } from './fixtures/booking.fixture'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Public Business Page E2E', () => {
    test('muestra página pública cuando el slug existe', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { slug, businessName } = testBusiness

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar que la página se carga correctamente
        await expect(page).toHaveURL(`/b/${slug}`)
        await expect(page.getByText(new RegExp(`Bienvenido a ${businessName}`, 'i'))).toBeVisible()
    })

    test('devuelve 404 cuando el slug no existe', async ({ authenticatedPage }) => {
        const page = authenticatedPage
        const response = await page.goto('/b/slug-inexistente-xyz-999')
        expect(response?.status()).toBe(404)
    })

    test('muestra mensaje de estado vacío sin servicios', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { slug } = testBusiness

        // Negocio recién creado sin servicios
        await page.goto(`/b/${slug}`)

        // Verificar mensaje de estado vacío
        await expect(page.getByText(/estamos configurando los servicios/i)).toBeVisible()
        await expect(page.getByText(/volvé pronto/i)).toBeVisible()
    })

    test('dashboard muestra link público copiable', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        void testBusiness // ensure business fixture runs

        // Verificar que aparece el link público
        await expect(page.getByText(/link público para compartir/i)).toBeVisible()
        await expect(page.getByText(/\/b\//)).toBeVisible()

        // Verificar botón de copiar
        const copyButton = page.getByRole('button', { name: /copiar/i })
        await expect(copyButton).toBeVisible()

        // Permiso de portapapeles
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
            origin: 'http://localhost:3000'
        })

        // Click en copiar
        await copyButton.click()

        // Verificar feedback de copiado
        await expect(page.getByRole('button', { name: /copiado/i })).toBeVisible({ timeout: 3000 })
    })
})

// Tests que verifican servicios activos
bookingTest.describe('Public Business Page - Services Display', () => {
    bookingTest('muestra servicios activos con nombre y duración', async ({ authenticatedPage, bookableSetup }) => {
        const page = authenticatedPage
        const { slug, serviceName } = bookableSetup

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar que se muestra el servicio
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText('30 min')).toBeVisible() // duración default

        // Verificar botón Reservar
        const reservarLink = page.getByRole('link', { name: /reservar/i })
        await expect(reservarLink).toBeVisible()
    })

    bookingTest(
        'servicio con 1 recurso hace auto-selección (redirect directo a slots)',
        async ({ authenticatedPage, bookableSetup }) => {
            const page = authenticatedPage
            const { slug, serviceName } = bookableSetup

            // Ir a página pública
            await page.goto(`/b/${slug}`)

            // Verificar servicio visible
            await expect(page.getByText(serviceName)).toBeVisible()

            // Click en Reservar
            await page.getByRole('link', { name: /reservar/i }).click()

            // Debería redirigir directamente a la página de slots (auto-selección)
            await expect(page).toHaveURL(/.*\/service\/.*\/resource\/.*\/slots/, {
                timeout: 10000
            })
        }
    )
})

// Tests de selección de recursos (múltiples recursos)
test.describe('Public Business Page - Resource Selection', () => {
    test('servicio sin recursos no aparece en página pública', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId, slug } = testBusiness
        const serviceName = generateUniqueName('service')

        // Crear servicio sin asignar recursos
        await page.goto(`/dashboard/business/${businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()

        const dialog = page.getByRole('dialog', { name: /crear servicio/i })
        await expect(dialog).toBeVisible({ timeout: 5000 })
        await dialog.getByLabel(/nombre/i).fill(serviceName)
        await dialog.getByRole('button', { name: /crear servicio/i }).click()
        await expect(dialog).not.toBeVisible({ timeout: 5000 })

        // En página pública, el servicio NO debería aparecer
        await page.goto(`/b/${slug}`)

        // El servicio no tiene recursos, por lo que no debería mostrarse
        await expect(page.getByText(serviceName)).not.toBeVisible()
        // Debería mostrar el estado vacío general
        await expect(page.getByText(/estamos configurando los servicios/i)).toBeVisible()
    })

    test('servicio con >1 recursos muestra listado de recursos para elegir', async ({
        authenticatedPage,
        testBusiness
    }) => {
        const page = authenticatedPage
        const { businessId, slug } = testBusiness
        const serviceName = generateUniqueName('service')
        const resourceName1 = generateUniqueName('recurso-a')
        const resourceName2 = generateUniqueName('recurso-b')

        // Crear 2 recursos
        await page.goto(`/dashboard/business/${businessId}/resources/new`)
        await page.getByLabel(/nombre/i).fill(resourceName1)
        await page.getByRole('button', { name: /crear/i }).click()
        await page.waitForURL('/dashboard', { timeout: 10000 })

        await page.goto(`/dashboard/business/${businessId}/resources/new`)
        await page.getByLabel(/nombre/i).fill(resourceName2)
        await page.getByRole('button', { name: /crear/i }).click()
        await page.waitForURL('/dashboard', { timeout: 10000 })

        // Crear servicio
        await page.goto(`/dashboard/business/${businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()

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

        const checkbox1 = page.getByRole('checkbox', { name: resourceName1 })
        const checkbox2 = page.getByRole('checkbox', { name: resourceName2 })
        await checkbox1.check({ force: true })
        await checkbox2.check({ force: true })

        await page.getByRole('button', { name: /guardar$/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

        // Ir a página pública
        await page.goto(`/b/${slug}`)

        // Click en Reservar
        await page.getByRole('link', { name: /reservar/i }).click()

        // Debería mostrar la página de selección de recurso
        await expect(page).toHaveURL(/.*\/service\/[^/]+$/, { timeout: 10000 })

        // Verificar que muestra el título con el resourceLabel
        await expect(page.getByText(/elegí recurso/i)).toBeVisible()

        // Verificar que muestra ambos recursos
        await expect(page.getByText(resourceName1)).toBeVisible()
        await expect(page.getByText(resourceName2)).toBeVisible()

        // Click en un recurso para navegar
        await page.getByText(resourceName1).click()

        // Debería ir a la página de slots
        await expect(page).toHaveURL(/.*\/resource\/.*\/slots/, { timeout: 10000 })
    })

    test('página de recursos tiene link para volver a servicios', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId, slug } = testBusiness
        const serviceName = generateUniqueName('service')
        const resourceName1 = generateUniqueName('recurso-1')
        const resourceName2 = generateUniqueName('recurso-2')

        // Crear 2 recursos
        await page.goto(`/dashboard/business/${businessId}/resources/new`)
        await page.getByLabel(/nombre/i).fill(resourceName1)
        await page.getByRole('button', { name: /crear/i }).click()
        await page.waitForURL('/dashboard', { timeout: 10000 })

        await page.goto(`/dashboard/business/${businessId}/resources/new`)
        await page.getByLabel(/nombre/i).fill(resourceName2)
        await page.getByRole('button', { name: /crear/i }).click()
        await page.waitForURL('/dashboard', { timeout: 10000 })

        // Crear servicio
        await page.goto(`/dashboard/business/${businessId}/services`)
        await page.getByRole('button', { name: /crear servicio/i }).click()

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

        const checkbox1 = page.getByRole('checkbox', { name: resourceName1 })
        const checkbox2 = page.getByRole('checkbox', { name: resourceName2 })
        await checkbox1.check({ force: true })
        await checkbox2.check({ force: true })

        await page.getByRole('button', { name: /guardar$/i }).click()
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

        // Ir a página pública y hacer click en Reservar
        await page.goto(`/b/${slug}`)
        await page.getByRole('link', { name: /reservar/i }).click()
        await expect(page).toHaveURL(/.*\/service\/[^/]+$/, { timeout: 10000 })

        // Verificar link "Volver a servicios"
        const backLink = page.getByRole('link', { name: /volver a servicios/i })
        await expect(backLink).toBeVisible()

        // Click y verificar que vuelve a la página principal
        await backLink.click()
        await expect(page).toHaveURL(`/b/${slug}`)
    })
})
