/**
 * E2E Tests - Service Creation and Management Flow
 *
 * Tests end-to-end del flujo completo de creación y gestión de servicios.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness } from './helpers/business.helper'

test.describe('Service Creation E2E', () => {
    test('complete service creation flow', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Servicio ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)
        await expect(page.getByText(businessName)).toBeVisible()

        // Navegar a la página de servicios usando el link "Gestionar"
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/, { timeout: 10000 })

        // Abrir dialog de creación
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Completar formulario
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        // La duración por defecto es 30, mantenerla
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        // Verificar toast de éxito y servicio en listado
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 5000 })
    })

    test('creates service with all fields', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Servicio Completo ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Navegar a servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await expect(page).toHaveURL(/.*\/services$/)

        // Abrir dialog y completar todos los campos
        await page.getByRole('button', { name: /crear servicio/i }).click()

        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByLabel(/descripción/i).fill('Descripción completa del servicio de prueba')

        // Cambiar duración a 60 min
        await page
            .getByLabel(/duración/i)
            .first()
            .selectOption('60')

        // Agregar buffer
        await page.getByLabel(/tiempo entre turnos/i).fill('15')

        // Agregar precio
        await page.getByLabel(/precio/i).fill('1500')

        // Crear
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        // Verificar éxito
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Verificar datos en listado
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText('60 min')).toBeVisible()
        await expect(page.getByText('15 min buffer')).toBeVisible()
        await expect(page.getByText(/\$.*1.*500/)).toBeVisible() // $1.500,00 o similar
    })

    test('shows error when creating duplicate service', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Servicio Duplicado ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Navegar a servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()

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

        // Debe mostrar error de nombre duplicado
        await expect(page.getByText(/ya existe.*servicio.*ese nombre/i)).toBeVisible({ timeout: 10000 })
    })

    test('validates duration is multiple of 5', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Servicio Test ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Navegar a servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()

        // Abrir dialog
        await page.getByRole('button', { name: /crear servicio/i }).click()

        // Usar duración personalizada con valor inválido
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByText(/duración personalizada/i).click()
        await page
            .getByLabel(/duración/i)
            .first()
            .fill('17') // No múltiplo de 5

        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()

        // Debe mostrar error
        await expect(page.getByText(/múltiplo de 5/i)).toBeVisible({ timeout: 5000 })
    })

    test('service appears in public business page', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Servicio Público ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Obtener el slug del negocio desde el link público en dashboard (está en un <code>)
        const publicLinkCode = page.locator('code').filter({ hasText: '/b/' }).first()
        await expect(publicLinkCode).toBeVisible({ timeout: 5000 })
        const publicLinkText = await publicLinkCode.textContent()
        const slugMatch = publicLinkText?.match(/\/b\/([a-z0-9-]+)/)
        const slug = slugMatch ? slugMatch[1] : null
        expect(slug).toBeTruthy()

        // Navegar a servicios y crear servicio
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

        // Ir a la página pública
        await page.goto(`/b/${slug}`)

        // Verificar que el servicio aparece
        await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText('30 min')).toBeVisible() // Duración por defecto
    })

    test('shows empty state when no services', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`

        // Setup: signup + crear negocio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Navegar a servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()

        // Verificar empty state (usar .first() para evitar strict mode con múltiples matches)
        await expect(page.getByText(/no hay servicios/i).first()).toBeVisible()
        await expect(page.getByText(/creá tu primer servicio/i).first()).toBeVisible()
    })

    test('canceling dialog does not create service', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Servicio Cancelado ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Navegar a servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()

        // Abrir dialog y completar pero cancelar
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page.getByRole('button', { name: /cancelar/i }).click()

        // Verificar que el dialog se cerró y el servicio NO existe
        await expect(page.getByRole('dialog')).not.toBeVisible()
        await expect(page.getByText(serviceName)).not.toBeVisible()
        await expect(page.getByText(/no hay servicios/i)).toBeVisible()
    })
})

test.describe('Service Edit E2E', () => {
    test('edit service name via dropdown menu', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const originalName = `Original ${Date.now()}`
        const updatedName = `Updated ${Date.now()}`

        // Setup: signup + crear negocio + crear servicio
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Navegar a servicios y crear uno
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(originalName)
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByText(originalName)).toBeVisible()

        // Abrir dropdown de acciones y editar
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()

        // Verificar warning informativo
        await expect(page.getByText(/afecta nuevas reservas/i)).toBeVisible()

        // Cambiar nombre
        await page.getByLabel(/nombre del servicio/i).fill(updatedName)
        await page.getByRole('button', { name: /guardar cambios/i }).click()

        // Verificar éxito
        await expect(page.getByText(/servicio actualizado/i)).toBeVisible({ timeout: 10000 })
        await expect(page.getByRole('dialog')).not.toBeVisible()
        await expect(page.getByText(updatedName)).toBeVisible()
        await expect(page.getByText(originalName)).not.toBeVisible()
    })

    test('edit service duration and price', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Service Edit ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear servicio con valores iniciales
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(serviceName)
        await page
            .getByLabel(/duración/i)
            .first()
            .selectOption('30') // 30 min
        await page.getByLabel(/precio/i).fill('100')
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Verificar valores iniciales
        await expect(page.getByText('30 min')).toBeVisible()
        await expect(page.getByText(/\$.*100/)).toBeVisible()

        // Editar duración y precio
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()

        // Cambiar duración a 60
        await page
            .getByLabel(/duración/i)
            .first()
            .selectOption('60')

        // Cambiar precio a 250
        await page.getByLabel(/precio/i).clear()
        await page.getByLabel(/precio/i).fill('250')

        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await expect(page.getByText(/servicio actualizado/i)).toBeVisible({ timeout: 10000 })

        // Verificar valores actualizados
        await expect(page.getByText('60 min')).toBeVisible()
        await expect(page.getByText(/\$.*250/)).toBeVisible()
    })

    test('edit service shows error for duplicate name', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const service1Name = `Service One ${Date.now()}`
        const service2Name = `Service Two ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear dos servicios
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()

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

        // Editar servicio 2 (el más reciente) e intentar cambiarle el nombre al de servicio 1
        // Localizar el item del servicio 2 y buscar el botón de menú dentro
        const service2Item = page.locator('div.rounded-lg.border').filter({ hasText: service2Name })
        await service2Item.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await page.getByLabel(/nombre del servicio/i).fill(service1Name)
        await page.getByRole('button', { name: /guardar cambios/i }).click()

        // Verificar error de conflicto
        await expect(page.getByText(/ya existe un servicio con ese nombre/i)).toBeVisible({ timeout: 10000 })
    })

    test('canceling edit does not save changes', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const serviceName = `Service Cancel ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

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

        // Abrir edición, modificar y cancelar
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill('Nombre Modificado')
        await page.getByRole('button', { name: /cancelar/i }).click()

        // Verificar que el nombre original persiste
        await expect(page.getByRole('dialog')).not.toBeVisible()
        await expect(page.getByText(serviceName)).toBeVisible()
        await expect(page.getByText('Nombre Modificado')).not.toBeVisible()
    })

    test('edited service reflects changes in public page', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `Business ${Date.now()}`
        const originalName = `Public Service ${Date.now()}`
        const updatedName = `Updated Public ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Crear servicio
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /crear servicio/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(originalName)
        await page.getByLabel(/precio/i).fill('100')
        await page
            .getByRole('button', { name: /crear servicio/i })
            .last()
            .click()
        await expect(page.getByText(/servicio creado/i)).toBeVisible({ timeout: 10000 })

        // Esperar a que el servicio aparezca en el listado del dashboard
        await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 })

        // Obtener slug del negocio desde el link público
        await page.goto('/dashboard')
        const publicLink = page.locator('code').filter({ hasText: '/b/' })
        await expect(publicLink).toBeVisible()
        const publicLinkText = (await publicLink.textContent())?.trim() ?? ''
        const publicUrl = publicLinkText.startsWith('http')
            ? publicLinkText
            : new URL(publicLinkText, page.url()).toString()
        const slug = new URL(publicUrl).pathname.replace(/^\/b\//, '')

        // Verificar valor original en página pública
        await page.goto(`/b/${slug}`)
        await expect(page.getByText(originalName)).toBeVisible()
        await expect(page.getByText(/\$.*100/)).toBeVisible()

        // Volver y editar servicio
        await page.goto('/dashboard')
        await page
            .getByRole('link', { name: /gestionar/i })
            .first()
            .click()
        await page.getByRole('button', { name: /abrir menú/i }).click()
        await page.getByRole('menuitem', { name: /editar/i }).click()
        await page.getByLabel(/nombre del servicio/i).fill(updatedName)
        await page.getByLabel(/precio/i).clear()
        await page.getByLabel(/precio/i).fill('200')
        await page.getByRole('button', { name: /guardar cambios/i }).click()
        await expect(page.getByText(/servicio actualizado/i)).toBeVisible({ timeout: 10000 })

        // Verificar valores actualizados en página pública
        await page.goto(`/b/${slug}`)
        await expect(page.getByText(updatedName)).toBeVisible()
        await expect(page.getByText(/\$.*200/)).toBeVisible()
        await expect(page.getByText(originalName)).not.toBeVisible()
    })
})
