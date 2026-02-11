/**
 * E2E Tests - WhatsApp Settings (US-10.1)
 *
 * Tests end-to-end del flujo de configuración de WhatsApp.
 * Usa fixtures para aislamiento completo entre tests paralelos.
 *
 * Layout: the settings page uses a unified two-column component
 * (`data-testid="notification-settings"`).  Customer WhatsApp lives
 * inside `data-testid="customer-notification-settings"` with its own
 * `data-testid="whatsapp-settings"` card.  A single "Guardar cambios"
 * button lives at the bottom of the component.
 */

import { test, expect } from './fixtures/business.fixture'

test.describe('WhatsApp Settings E2E (US-10.1)', () => {
    test('can navigate to settings page and see WhatsApp toggle', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navigate to settings page
        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Should see WhatsApp settings card inside the customer column
        const whatsappCard = page.getByTestId('whatsapp-settings')
        await expect(whatsappCard).toBeVisible()
        await expect(whatsappCard.getByText('Notificaciones por WhatsApp', { exact: true })).toBeVisible()
        await expect(
            whatsappCard.getByText('Enviá notificaciones y recordatorios a tus clientes por WhatsApp.')
        ).toBeVisible()
        await expect(whatsappCard.getByLabel(/activar notificaciones por whatsapp/i)).toBeVisible()
    })

    test('WhatsApp is disabled by default', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        await page.goto(`/dashboard/business/${businessId}/settings`)

        const whatsappCard = page.getByTestId('whatsapp-settings')
        const whatsappCheckbox = whatsappCard.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(whatsappCheckbox).not.toBeChecked()
    })

    test('can enable WhatsApp notifications', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Toggle customer WhatsApp on
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const whatsappCheckbox = whatsappCard.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(whatsappCheckbox).not.toBeChecked()
        await whatsappCheckbox.click()
        await expect(whatsappCheckbox).toBeChecked()

        // Use the shared save button (lives outside cards, at the bottom)
        const saveButton = page.getByTestId('notification-settings').getByRole('button', {
            name: /guardar cambios/i
        })
        await expect(saveButton).toBeEnabled()
        await saveButton.click()

        // Should show success message
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Reload page and verify it persisted
        await page.reload()
        const reloadedCheckbox = page.getByTestId('whatsapp-settings').getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(reloadedCheckbox).toBeChecked()
    })

    test('can disable WhatsApp notifications after enabling', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Enable first
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const whatsappCheckbox = whatsappCard.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await whatsappCheckbox.click()

        const saveButton = page.getByTestId('notification-settings').getByRole('button', {
            name: /guardar cambios/i
        })
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Now disable
        await whatsappCheckbox.click()
        await expect(whatsappCheckbox).not.toBeChecked()
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Reload and verify
        await page.reload()
        const reloadedCheckbox = page.getByTestId('whatsapp-settings').getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(reloadedCheckbox).not.toBeChecked()
    })

    test('WhatsApp settings do not affect email settings', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        await page.goto(`/dashboard/business/${businessId}/settings`)

        // Scope email checkbox to the customer column
        const customerSection = page.getByTestId('customer-notification-settings')
        const emailCheckbox = customerSection.getByRole('checkbox', {
            name: /activar notificaciones por mail/i
        })
        await expect(emailCheckbox).toBeChecked()

        // Enable customer WhatsApp
        const whatsappCard = page.getByTestId('whatsapp-settings')
        const whatsappCheckbox = whatsappCard.getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await whatsappCheckbox.click()

        // Save
        const saveButton = page.getByTestId('notification-settings').getByRole('button', {
            name: /guardar cambios/i
        })
        await saveButton.click()
        await expect(page.getByText(/configuración guardada/i)).toBeVisible({
            timeout: 10000
        })

        // Reload and verify both settings independent
        await page.reload()
        const reloadedEmailCheckbox = page.getByTestId('customer-notification-settings').getByRole('checkbox', {
            name: /activar notificaciones por mail/i
        })
        await expect(reloadedEmailCheckbox).toBeChecked()

        const reloadedWhatsappCheckbox = page.getByTestId('whatsapp-settings').getByRole('checkbox', {
            name: /activar notificaciones por whatsapp/i
        })
        await expect(reloadedWhatsappCheckbox).toBeChecked()
    })
})
