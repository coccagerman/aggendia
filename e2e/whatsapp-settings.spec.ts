/**
 * E2E Tests - WhatsApp Settings (US-10.1)
 *
 * Tests end-to-end del flujo de configuración de WhatsApp.
 * Usa fixtures para aislamiento completo entre tests paralelos.
 */

import { test, expect } from './fixtures/business.fixture'

test.describe('WhatsApp Settings E2E (US-10.1)', () => {
    test('can navigate to settings page and see WhatsApp toggle', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navigate to settings page
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Should see WhatsApp settings card
        await expect(page.getByTestId('whatsapp-settings')).toBeVisible()
        await expect(page.getByText('Notificaciones por WhatsApp', { exact: true })).toBeVisible()
        await expect(page.getByText('Enviá notificaciones y recordatorios a tus clientes por WhatsApp.')).toBeVisible()
        await expect(page.getByLabel(/activar notificaciones por whatsapp/i)).toBeVisible()
    })

    test('WhatsApp is disabled by default', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Verify WhatsApp checkbox is NOT checked by default
        const whatsappCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(whatsappCheckbox).not.toBeChecked()
    })

    test('can enable WhatsApp notifications', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Find and click the WhatsApp checkbox
        const whatsappCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(whatsappCheckbox).not.toBeChecked()
        await whatsappCheckbox.click()
        await expect(whatsappCheckbox).toBeChecked()

        // Save button should now be enabled
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const saveButton = whatsappCard.getByRole('button', {
            name: /guardar cambios/i
        })
        await expect(saveButton).toBeEnabled()

        // Click save
        await saveButton.click()

        // Should show success message
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Reload page and verify it persisted
        await page.reload()
        const reloadedCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(reloadedCheckbox).toBeChecked()
    })

    test('can disable WhatsApp notifications after enabling', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Enable WhatsApp first
        const whatsappCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await whatsappCheckbox.click()

        const whatsappCard = page.getByTestId('whatsapp-settings')
        const saveButton = whatsappCard.getByRole('button', {
            name: /guardar cambios/i
        })
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Now disable it
        await whatsappCheckbox.click()
        await expect(whatsappCheckbox).not.toBeChecked()
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Reload and verify
        await page.reload()
        const reloadedCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(reloadedCheckbox).not.toBeChecked()
    })

    test('WhatsApp settings do not affect reminder settings', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navigate to settings
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Check that reminder settings exist and are enabled by default
        const reminderCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por mail/i
        })
        await expect(reminderCheckbox).toBeChecked()

        // Enable WhatsApp
        const whatsappCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await whatsappCheckbox.click()

        // Find WhatsApp card's save button
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const saveButton = whatsappCard.getByRole('button', {
            name: /guardar cambios/i
        })
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Reload and verify reminder settings unchanged
        await page.reload()
        const reloadedReminderCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por mail/i
        })
        await expect(reloadedReminderCheckbox).toBeChecked()

        const reloadedWhatsappCheckbox = page.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(reloadedWhatsappCheckbox).toBeChecked()
    })
})
