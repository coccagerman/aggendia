/**
 * E2E Tests - WhatsApp Settings
 *
 * Tests end-to-end del flujo de configuración de WhatsApp (US-10.1).
 * Verifica que el admin pueda habilitar/deshabilitar WhatsApp como canal de notificación.
 */

import { test, expect } from '@playwright/test'
import { generateTestEmail, signupUser } from './helpers/auth.helper'
import { createBusiness } from './helpers/business.helper'

test.describe('WhatsApp Settings E2E (US-10.1)', () => {
    test('can navigate to settings page and see WhatsApp toggle', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `WhatsApp Test ${Date.now()}`

        // Setup: signup and create business
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Get businessId from URL or page
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]
        expect(businessId).toBeDefined()

        // Navigate to settings page
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Should see WhatsApp settings card with title and description
        await expect(page.getByTestId('whatsapp-settings')).toBeVisible()
        await expect(page.getByText('Notificaciones por WhatsApp', { exact: true })).toBeVisible()
        await expect(page.getByText('Enviá confirmaciones y recordatorios a tus clientes por WhatsApp.')).toBeVisible()
        await expect(page.getByLabel(/activar notificaciones por whatsapp/i)).toBeVisible()
    })

    test('WhatsApp is disabled by default', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `WhatsApp Default ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Get businessId
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Verify WhatsApp checkbox is NOT checked by default
        const whatsappCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await expect(whatsappCheckbox).not.toBeChecked()
    })

    test('can enable WhatsApp notifications', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `WhatsApp Enable ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Get businessId
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Find and click the WhatsApp checkbox
        const whatsappCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await expect(whatsappCheckbox).not.toBeChecked()
        await whatsappCheckbox.click()
        await expect(whatsappCheckbox).toBeChecked()

        // Save button should now be enabled - use data-testid for the WhatsApp card
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const saveButton = whatsappCard.getByRole('button', { name: /guardar cambios/i })
        await expect(saveButton).toBeEnabled()

        // Click save
        await saveButton.click()

        // Should show success message
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({ timeout: 10000 })

        // Reload page and verify it persisted
        await page.reload()
        const reloadedCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await expect(reloadedCheckbox).toBeChecked()
    })

    test('can disable WhatsApp notifications after enabling', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `WhatsApp Disable ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Get businessId
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Enable WhatsApp first
        const whatsappCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await whatsappCheckbox.click()

        const whatsappCard = page.getByTestId('whatsapp-settings')
        const saveButton = whatsappCard.getByRole('button', { name: /guardar cambios/i })
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({ timeout: 10000 })

        // Now disable it
        await whatsappCheckbox.click()
        await expect(whatsappCheckbox).not.toBeChecked()
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({ timeout: 10000 })

        // Reload and verify
        await page.reload()
        const reloadedCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await expect(reloadedCheckbox).not.toBeChecked()
    })

    test('WhatsApp settings do not affect reminder settings', async ({ page }) => {
        const email = generateTestEmail()
        const password = 'TestPassword123!'
        const businessName = `WhatsApp Independent ${Date.now()}`

        // Setup
        await signupUser(page, email, password)
        await createBusiness(page, businessName)

        // Get businessId
        const createResourceLink = page.getByRole('link', { name: /crear.*recurso/i }).first()
        const href = await createResourceLink.getAttribute('href')
        const businessId = href?.match(/business\/([^/]+)/)?.[1]

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Check that reminder settings exist and are enabled by default
        const reminderCheckbox = page.getByRole('checkbox', { name: /activar recordatorios/i })
        await expect(reminderCheckbox).toBeChecked()

        // Enable WhatsApp
        const whatsappCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await whatsappCheckbox.click()

        // Find WhatsApp card's save button (not reminder's)
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const saveButton = whatsappCard.getByRole('button', { name: /guardar cambios/i })
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({ timeout: 10000 })

        // Reload and verify reminder settings unchanged
        await page.reload()
        const reloadedReminderCheckbox = page.getByRole('checkbox', { name: /activar recordatorios/i })
        await expect(reloadedReminderCheckbox).toBeChecked()

        const reloadedWhatsappCheckbox = page.getByRole('checkbox', { name: /activar notificaciones por whatsapp/i })
        await expect(reloadedWhatsappCheckbox).toBeChecked()
    })
})
