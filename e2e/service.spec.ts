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
