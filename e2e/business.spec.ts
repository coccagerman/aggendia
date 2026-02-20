/**
 * E2E Tests - Business Creation Flow
 *
 * Tests end-to-end del flujo completo de creación de negocio.
 * Cada test usa su propio usuario único (UUID) para aislamiento paralelo.
 */

import { test, expect } from './fixtures'
import { test as businessTest } from './fixtures/business.fixture'
import { generateUniqueName } from './helpers/unique-id.helper'

test.describe('Business Creation E2E', () => {
    test('complete business creation flow', async ({ authenticatedPage }) => {
        const page = authenticatedPage
        const businessName = generateUniqueName('Test Business')

        // Should be on dashboard (fixture ya hizo signup)
        await expect(page).toHaveURL('/dashboard')

        // Click "Crear negocio" button
        await page.getByRole('link', { name: /crear negocio/i }).click()

        // Should navigate to business creation form
        await expect(page).toHaveURL('/dashboard/business/new')

        // Fill the form
        await page.getByLabel(/nombre/i).fill(businessName)

        // Optional fields
        await page.getByLabel(/dirección/i).fill('Calle Test 123')
        await page.getByLabel(/ciudad/i).fill('CABA')

        // Submit form
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // Should redirect back to dashboard
        await expect(page).toHaveURL('/dashboard', { timeout: 10000 })

        // Business should appear in the list
        await expect(page.getByText(businessName)).toBeVisible({ timeout: 5000 })
    })

    test('shows validation errors for empty form', async ({ authenticatedPage }) => {
        const page = authenticatedPage

        await page.getByRole('link', { name: /crear negocio/i }).click()

        // Try to submit empty form
        await page.getByRole('button', { name: /crear negocio/i }).click()

        // Should show client-side validation error
        await expect(page.getByText('El nombre del negocio / sede es requerido.')).toBeVisible()
    })
})

businessTest.describe('Business Edit E2E', () => {
    businessTest('edit business name via dropdown menu', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const newName = generateUniqueName('Negocio Editado')

        // Esperar que el negocio sea visible
        await expect(page.getByText(testBusiness.businessName)).toBeVisible()

        // Localizar la card del negocio
        const businessCard = page.locator('div.rounded-lg.border').filter({ hasText: testBusiness.businessName })

        // Abrir menú de acciones del negocio (⋯ button)
        await businessCard
            .getByRole('button', { name: /abrir menú/i })
            .first()
            .click()

        // Clic en Editar
        await page.getByRole('menuitem', { name: /editar/i }).click()

        // Modificar nombre en el modal
        const nameInput = page.getByLabel(/nombre/i)
        await nameInput.clear()
        await nameInput.fill(newName)
        await page.getByRole('button', { name: /guardar/i }).click()

        // Verificar que se actualizó
        await expect(page.getByText(newName)).toBeVisible({ timeout: 5000 })
    })

    businessTest(
        'deactivate business shows confirmation dialog and warning',
        async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage

            const businessCard = page.locator('div.rounded-lg.border').filter({ hasText: testBusiness.businessName })
            await businessCard
                .getByRole('button', { name: /abrir menú/i })
                .first()
                .click()

            // Clic en Desactivar
            await page.getByRole('menuitem', { name: /desactivar/i }).click()

            // Debe mostrar diálogo de confirmación con warning
            await expect(page.getByText(/¿desactivar negocio/i)).toBeVisible()
            await expect(page.getByText(/turnos existentes se mantendrán activos/i)).toBeVisible()

            // Confirmar desactivación
            await page.getByRole('button', { name: /^desactivar$/i }).click()

            // Verificar badge cambia a Inactivo
            await expect(businessCard.getByText('Inactivo')).toBeVisible({ timeout: 5000 })
        }
    )

    businessTest('reactivate inactive business', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage

        // Primero desactivar
        const businessCard = page.locator('div.rounded-lg.border').filter({ hasText: testBusiness.businessName })
        await businessCard
            .getByRole('button', { name: /abrir menú/i })
            .first()
            .click()
        await page.getByRole('menuitem', { name: /desactivar/i }).click()
        await page.getByRole('button', { name: /^desactivar$/i }).click()
        await expect(businessCard.getByText('Inactivo')).toBeVisible({ timeout: 5000 })

        // Reactivar
        await businessCard
            .getByRole('button', { name: /abrir menú/i })
            .first()
            .click()
        await page.getByRole('menuitem', { name: /activar/i }).click()

        // Verificar badge cambia a Activo
        await expect(businessCard.getByText('Activo')).toBeVisible({ timeout: 5000 })
    })

    businessTest('deactivated business not visible on public page', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage

        // Desactivar negocio
        const businessCard = page.locator('div.rounded-lg.border').filter({ hasText: testBusiness.businessName })
        await businessCard
            .getByRole('button', { name: /abrir menú/i })
            .first()
            .click()
        await page.getByRole('menuitem', { name: /desactivar/i }).click()
        await page.getByRole('button', { name: /^desactivar$/i }).click()
        await expect(businessCard.getByText('Inactivo')).toBeVisible({ timeout: 5000 })

        // Navegar a página pública
        await page.goto(`/b/${testBusiness.slug}`)

        // Debe mostrar 404
        await expect(page.getByText(/not found|no encontrado|404/i)).toBeVisible({ timeout: 5000 })
    })

    businessTest(
        'delete business without appointments removes it from list',
        async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage

            const businessCard = page.locator('div.rounded-lg.border').filter({ hasText: testBusiness.businessName })
            await businessCard
                .getByRole('button', { name: /abrir menú/i })
                .first()
                .click()

            // Clic en Eliminar
            await page.getByRole('menuitem', { name: /eliminar/i }).click()

            // Debe mostrar diálogo de eliminación
            await expect(page.getByText(/¿eliminar negocio/i)).toBeVisible()

            // Esperar que termine la verificación de turnos (el botón se habilita)
            await expect(page.getByText(/esta acción eliminará el negocio de forma permanente/i)).toBeVisible({
                timeout: 5000
            })

            // Confirmar eliminación
            await page.getByRole('button', { name: /^eliminar$/i }).click()

            // Esperar que el dialog se cierre
            await expect(page.getByText(/¿eliminar negocio/i)).not.toBeVisible({ timeout: 5000 })

            // El negocio debe desaparecer del listado
            await expect(
                page.locator('div.rounded-lg.border').filter({ hasText: testBusiness.businessName })
            ).not.toBeVisible({ timeout: 5000 })
        }
    )
})
