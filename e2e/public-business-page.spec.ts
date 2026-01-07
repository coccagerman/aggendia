/**
 * E2E Tests - Public Business Page (US-1.4, US-5.1)
 *
 * Tests end-to-end de la página pública del negocio y link compartible.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness } from './helpers/business.helper'

test.describe('Public Business Page E2E', () => {
    test('muestra página pública cuando el slug existe', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Public Business ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await page.getByRole('link', { name: /crear negocio/i }).click()
        await page.getByLabel(/nombre/i).fill(businessName)
        await page.getByLabel(/zona horaria/i).click()
        await page
            .getByRole('option', { name: /buenos aires/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear negocio/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Obtener el slug real desde el dashboard (evita acoplar a la DB en el test)
        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar que la página se carga correctamente
        await expect(page).toHaveURL(`/b/${slug}`)
        // El título es un CardTitle (heading) con el texto "Bienvenido a {business.name}".
        // Usamos getByText para tolerar variaciones de nivel de heading y espacios.
        await expect(page.getByText(new RegExp(`Bienvenido a ${businessName}`, 'i'))).toBeVisible()
    })

    test('devuelve 404 cuando el slug no existe', async ({ page }) => {
        const response = await page.goto('/b/slug-inexistente-xyz-999')
        expect(response?.status()).toBe(404)
    })

    test('muestra mensaje de estado vacío sin servicios', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Empty Business ${Date.now()}`

        // Setup: crear negocio sin servicios
        await signupUser(page, email, password)
        await page.getByRole('link', { name: /crear negocio/i }).click()
        await page.getByLabel(/nombre/i).fill(businessName)
        await page.getByLabel(/zona horaria/i).click()
        await page
            .getByRole('option', { name: /buenos aires/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear negocio/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Obtener el slug desde el dashboard
        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar mensaje de estado vacío
        await expect(page.getByText(/estamos configurando los servicios/i)).toBeVisible()
        await expect(page.getByText(/volvé pronto/i)).toBeVisible()
    })

    test('dashboard muestra link público copiable', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Link Test Business ${Date.now()}`

        // Crear negocio
        await signupUser(page, email, password)
        await page.getByRole('link', { name: /crear negocio/i }).click()
        await page.getByLabel(/nombre/i).fill(businessName)
        await page.getByLabel(/zona horaria/i).click()
        await page
            .getByRole('option', { name: /buenos aires/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear negocio/i }).click()
        await expect(page).toHaveURL('/dashboard')

        // Verificar que aparece el link público
        await expect(page.getByText(/link público para compartir/i)).toBeVisible()
        await expect(page.getByText(/\/b\//)).toBeVisible()

        // Verificar botón de copiar
        const copyButton = page.getByRole('button', { name: /copiar/i })
        await expect(copyButton).toBeVisible()

        // Permiso de portapapeles para asegurar el estado "Copiado"
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
            origin: 'http://localhost:3000'
        })

        // Click en copiar
        await copyButton.click()

        // Verificar feedback de copiado (aparece por 2 segundos)
        await expect(page.getByRole('button', { name: /copiado/i })).toBeVisible({ timeout: 3000 })
    })

    // US-5.1: Ver servicios disponibles
    test('muestra servicios activos con nombre, duración y precio', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Service Display Business ${Date.now()}`
        const serviceName = `Corte de pelo ${Date.now()}`
        const resourceName = `Recurso Display ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Obtener el slug desde el dashboard
        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear un recurso primero
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Crear un servicio con precio
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByLabel(/precio/i).fill('2500') // $2500
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Asignar recurso al servicio via el badge "Sin recursos"
        await page.getByRole('button', { name: /sin recursos/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        await page.getByRole('checkbox').first().click()
        await page.getByRole('button', { name: /guardar/i }).click()
        await expect(page.getByText(/recursos actualizados/i)).toBeVisible({ timeout: 10000 })

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar que se muestra el servicio
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText('30 min')).toBeVisible() // duración default
        // Precio formateado (puede ser $2.500,00 ARS o similar según locale)
        await expect(page.getByText(/2.*500/)).toBeVisible()
        await expect(page.getByText('ARS')).toBeVisible()

        // Verificar botón Reservar está habilitado y es un link
        const reservarLink = page.getByRole('link', { name: /reservar/i })
        await expect(reservarLink).toBeVisible()
    })

    test('muestra "Precio a confirmar" cuando el servicio no tiene precio', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `No Price Business ${Date.now()}`
        const serviceName = `Consulta ${Date.now()}`
        const resourceName = `Recurso NP ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Obtener el slug desde el dashboard
        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear un recurso primero
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Crear un servicio SIN precio
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        // No llenar precio
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Asignar recurso al servicio via el badge "Sin recursos"
        await page.getByRole('button', { name: /sin recursos/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        await page.getByRole('checkbox').first().click()
        await page.getByRole('button', { name: /guardar/i }).click()
        await expect(page.getByText(/recursos actualizados/i)).toBeVisible({ timeout: 10000 })

        // Navegar a página pública
        await page.goto(`/b/${slug}`)

        // Verificar que se muestra el servicio
        await expect(page.getByText(serviceName)).toBeVisible()

        // Verificar "Precio a confirmar" en lugar de un precio
        await expect(page.getByText(/precio a confirmar/i)).toBeVisible()
    })

    // ==========================================
    // US-5.2: Elegir recurso (filtrar por servicio)
    // ==========================================

    test('servicio sin recursos muestra estado vacío al intentar reservar', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Empty Resources Business ${Date.now()}`
        const serviceName = `Servicio Sin Recursos ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear servicio sin asignar recursos
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // En página pública, el servicio NO debería aparecer (filtrado por recursos)
        await page.goto(`/b/${slug}`)

        // El servicio no tiene recursos, por lo que no debería mostrarse
        await expect(page.getByText(serviceName)).not.toBeVisible()
        // Debería mostrar el estado vacío general
        await expect(page.getByText(/estamos configurando los servicios/i)).toBeVisible()
    })

    test('servicio con 1 recurso hace auto-selección (redirect directo a slots)', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Auto Select Business ${Date.now()}`
        const serviceName = `Servicio Auto ${Date.now()}`
        const resourceName = `Recurso Único ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = await page.locator('p:has-text("Slug:")').first()
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

        // Crear servicio
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Asignar recurso al servicio via el badge "Sin recursos"
        await page.getByRole('button', { name: /sin recursos/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        await page.getByRole('checkbox').first().click()
        await page.getByRole('button', { name: /guardar/i }).click()
        await expect(page.getByText(/recursos actualizados/i)).toBeVisible({ timeout: 10000 })

        // Ir a página pública
        await page.goto(`/b/${slug}`)

        // Verificar servicio visible
        await expect(page.getByText(serviceName)).toBeVisible()

        // Click en Reservar
        await page.getByRole('link', { name: /reservar/i }).click()

        // Debería redirigir directamente a la página de slots (auto-selección)
        // La URL debería contener /resource/{resourceId}/slots
        await expect(page).toHaveURL(/.*\/service\/.*\/resource\/.*\/slots/, { timeout: 10000 })
    })

    test('servicio con >1 recursos muestra listado de recursos para elegir', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Multi Resource Business ${Date.now()}`
        const serviceName = `Servicio Multi ${Date.now()}`
        const resourceName1 = `Profesional A ${Date.now()}`
        const resourceName2 = `Profesional B ${Date.now()}`

        // Setup: crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear 2 recursos
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName1)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName2)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Crear servicio
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Asignar ambos recursos al servicio via el badge "Sin recursos"
        await page.getByRole('button', { name: /sin recursos/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        // Seleccionar todos los checkboxes en el dialog
        const checkboxes = page.getByRole('dialog').getByRole('checkbox')
        const count = await checkboxes.count()
        for (let i = 0; i < count; i++) {
            await checkboxes.nth(i).click()
        }
        await page.getByRole('button', { name: /guardar/i }).click()
        await expect(page.getByText(/recursos actualizados/i)).toBeVisible({ timeout: 10000 })

        // Ir a página pública
        await page.goto(`/b/${slug}`)

        // Click en Reservar
        await page.getByRole('link', { name: /reservar/i }).click()

        // Debería mostrar la página de selección de recurso
        await expect(page).toHaveURL(/.*\/service\/[^/]+$/, { timeout: 10000 })

        // Verificar que muestra el título con el resourceLabel correcto (default = "recurso")
        await expect(page.getByText(/elegí recurso/i)).toBeVisible()

        // Verificar que muestra ambos recursos
        await expect(page.getByText(resourceName1)).toBeVisible()
        await expect(page.getByText(resourceName2)).toBeVisible()

        // Click en un recurso para navegar
        await page.getByText(resourceName1).click()

        // Debería ir a la página de slots
        await expect(page).toHaveURL(/.*\/resource\/.*\/slots/, { timeout: 10000 })
    })

    test('página de recursos tiene link para volver a servicios', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Back Link Business ${Date.now()}`
        const serviceName = `Servicio Back ${Date.now()}`
        const resourceName1 = `Recurso 1 ${Date.now()}`
        const resourceName2 = `Recurso 2 ${Date.now()}`

        // Setup rápido
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        const slugElement = await page.locator('p:has-text("Slug:")').first()
        const slugText = await slugElement.textContent()
        const slug = slugText?.replace('Slug:', '').trim()
        expect(slug).toBeTruthy()

        // Crear 2 recursos
        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName1)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        await page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
        await page.getByLabel(/nombre/i).fill(resourceName2)
        await page.getByRole('button', { name: /crear/i }).click()
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Crear servicio
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Asignar ambos recursos al servicio via el badge "Sin recursos"
        await page.getByRole('button', { name: /sin recursos/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
        // Seleccionar todos los checkboxes en el dialog
        const checkboxes = page.getByRole('dialog').getByRole('checkbox')
        const count = await checkboxes.count()
        for (let i = 0; i < count; i++) {
            await checkboxes.nth(i).click()
        }
        await page.getByRole('button', { name: /guardar/i }).click()
        await expect(page.getByText(/recursos actualizados/i)).toBeVisible({ timeout: 10000 })

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
