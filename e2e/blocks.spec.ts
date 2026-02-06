/**
 * E2E Tests - Resource Blocks (Bloqueos)
 *
 * Tests del flujo de gestión de bloqueos de recursos.
 * Los bloqueos se gestionan desde la pestaña "Bloqueos" en la página de detalle del recurso.
 */

import { test, expect } from './fixtures/business.fixture'
import { generateUniqueName } from './helpers/unique-id.helper'

/**
 * Helper para crear un recurso via API y obtener su ID.
 */
async function createResourceViaApi(
    page: import('@playwright/test').Page,
    businessId: string,
    resourceName: string
): Promise<string> {
    const response = await page.request.post(`/api/v1/businesses/${businessId}/resources`, {
        data: { name: resourceName }
    })
    if (!response.ok()) {
        const text = await response.text()
        throw new Error(`Failed to create resource: ${text}`)
    }
    const data = await response.json()
    return data.data.id
}

/**
 * Helper para navegar a la pestaña de bloqueos de un recurso.
 */
async function navigateToBlocksTab(page: import('@playwright/test').Page, businessId: string, resourceId: string) {
    await page.goto(`/dashboard/business/${businessId}/resources/${resourceId}`)
    await page.getByRole('tab', { name: /bloqueos/i }).click()
    await expect(page.getByRole('button', { name: /agregar bloqueo/i })).toBeVisible()
}

/**
 * Helper para abrir el diálogo de crear bloqueo.
 */
async function openCreateBlockDialog(page: import('@playwright/test').Page) {
    // El botón dice "Agregar bloqueo"
    await page.getByRole('button', { name: /agregar bloqueo/i }).click()
    // Esperar a que el dialog se abra
    await expect(page.getByRole('dialog')).toBeVisible()
}

/**
 * Helper para llenar el formulario de bloqueo.
 * Los labels son: "Fecha inicio", "Hora inicio", "Fecha fin", "Hora fin", "Motivo (opcional)"
 */
async function fillBlockForm(
    page: import('@playwright/test').Page,
    {
        startDate,
        startTime,
        endDate,
        endTime,
        reason
    }: {
        startDate: string
        startTime: string
        endDate: string
        endTime: string
        reason?: string
    }
) {
    await page.getByLabel('Fecha inicio').fill(startDate)
    await page.getByLabel('Hora inicio').fill(startTime)
    await page.getByLabel('Fecha fin').fill(endDate)
    await page.getByLabel('Hora fin').fill(endTime)

    if (reason) {
        await page.getByLabel(/motivo/i).fill(reason)
    }
}

test.describe('Resource Blocks (Bloqueos)', () => {
    test.describe('Creating blocks', () => {
        test('should create a block for a resource', async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage
            const resourceName = generateUniqueName('resource')

            // Crear recurso via API
            const resourceId = await createResourceViaApi(page, testBusiness.businessId, resourceName)

            // Navegar a la pestaña de bloqueos
            await navigateToBlocksTab(page, testBusiness.businessId, resourceId)

            // Abrir diálogo de crear bloqueo
            await openCreateBlockDialog(page)

            // Llenar formulario
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const formattedDate = tomorrow.toISOString().split('T')[0]

            await fillBlockForm(page, {
                startDate: formattedDate,
                startTime: '10:00',
                endDate: formattedDate,
                endTime: '12:00',
                reason: 'Mantenimiento programado'
            })

            // Guardar - el botón dice "Crear bloqueo"
            await page.getByRole('button', { name: /crear bloqueo/i }).click()

            // El dialog debe cerrarse
            await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 })

            // Verificar que el bloqueo fue creado (debe aparecer en la lista)
            await expect(page.getByText('Mantenimiento programado')).toBeVisible({ timeout: 5000 })
        })

        test('should show validation error for invalid time range', async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage
            const resourceName = generateUniqueName('resource')

            // Crear recurso via API
            const resourceId = await createResourceViaApi(page, testBusiness.businessId, resourceName)

            // Navegar a la pestaña de bloqueos
            await navigateToBlocksTab(page, testBusiness.businessId, resourceId)

            // Abrir diálogo de crear bloqueo
            await openCreateBlockDialog(page)

            // Llenar con rango inválido (fin antes de inicio)
            const tomorrow = new Date()
            tomorrow.setDate(tomorrow.getDate() + 1)
            const formattedDate = tomorrow.toISOString().split('T')[0]

            await fillBlockForm(page, {
                startDate: formattedDate,
                startTime: '14:00',
                endDate: formattedDate,
                endTime: '10:00', // Antes de inicio
                reason: 'Test inválido'
            })

            // Intentar guardar
            await page.getByRole('button', { name: /crear bloqueo/i }).click()

            // Debe mostrar error de validación - el mensaje exacto es:
            // "La fecha/hora de inicio debe ser anterior a la de fin."
            await expect(page.getByText('La fecha/hora de inicio debe ser anterior a la de fin.')).toBeVisible({
                timeout: 5000
            })
        })
    })

    test.describe('Deleting blocks', () => {
        test('should delete a block', async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage
            const resourceName = generateUniqueName('resource')
            const blockReason = 'Bloqueo a eliminar'

            // Crear recurso via API
            const resourceId = await createResourceViaApi(page, testBusiness.businessId, resourceName)

            // Crear bloqueo via API (en el futuro para que aparezca en "Próximos bloqueos")
            const futureDate = new Date()
            futureDate.setDate(futureDate.getDate() + 3)
            const startAt = new Date(futureDate)
            startAt.setHours(15, 0, 0, 0)
            const endAt = new Date(futureDate)
            endAt.setHours(17, 0, 0, 0)

            const createResponse = await page.request.post(
                `/api/v1/businesses/${testBusiness.businessId}/resources/${resourceId}/blocks`,
                {
                    data: {
                        startAt: startAt.toISOString(),
                        endAt: endAt.toISOString(),
                        reason: blockReason
                    }
                }
            )
            expect(createResponse.ok()).toBeTruthy()

            // Navegar a la pestaña de bloqueos
            await navigateToBlocksTab(page, testBusiness.businessId, resourceId)

            // Verificar que el bloqueo está visible
            await expect(page.getByText(blockReason)).toBeVisible()

            // Encontrar el bloqueo y clickear el botón de eliminar (icono Trash)
            // La estructura es: div.contenedor > [div con info, button con trash]
            // Buscamos el contenedor que tiene el texto y también tiene un botón
            const blockContainer = page.getByText(blockReason).locator('..').locator('..')
            await blockContainer.getByRole('button').click()

            // Se abre un AlertDialog con título "¿Eliminar bloqueo?"
            await expect(page.getByRole('alertdialog')).toBeVisible()
            await expect(page.getByText('¿Eliminar bloqueo?')).toBeVisible()

            // Confirmar eliminación
            await page.getByRole('button', { name: 'Eliminar' }).click()

            // Esperar a que el AlertDialog se cierre
            await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 5000 })

            // Verificar que el bloqueo fue eliminado
            await expect(page.getByText(blockReason)).not.toBeVisible({ timeout: 5000 })
        })
    })

    test.describe('Block overlap prevention', () => {
        test('should prevent creating overlapping blocks', async ({ authenticatedPage, testBusiness }) => {
            const page = authenticatedPage
            const resourceName = generateUniqueName('resource')

            // Crear recurso via API
            const resourceId = await createResourceViaApi(page, testBusiness.businessId, resourceName)

            // Crear primer bloqueo via API
            const futureDate = new Date()
            futureDate.setDate(futureDate.getDate() + 7)
            const startAt = new Date(futureDate)
            startAt.setHours(10, 0, 0, 0)
            const endAt = new Date(futureDate)
            endAt.setHours(14, 0, 0, 0)

            const createResponse = await page.request.post(
                `/api/v1/businesses/${testBusiness.businessId}/resources/${resourceId}/blocks`,
                {
                    data: {
                        startAt: startAt.toISOString(),
                        endAt: endAt.toISOString(),
                        reason: 'Primer bloqueo'
                    }
                }
            )
            expect(createResponse.ok()).toBeTruthy()

            // Navegar a la pestaña de bloqueos
            await navigateToBlocksTab(page, testBusiness.businessId, resourceId)

            // Verificar que el primer bloqueo está visible
            await expect(page.getByText('Primer bloqueo')).toBeVisible()

            // Abrir diálogo para crear segundo bloqueo (solapado)
            await openCreateBlockDialog(page)

            // Llenar con rango que solapa
            const formattedDate = futureDate.toISOString().split('T')[0]
            await fillBlockForm(page, {
                startDate: formattedDate,
                startTime: '12:00', // Solapa con 10:00-14:00
                endDate: formattedDate,
                endTime: '16:00',
                reason: 'Segundo bloqueo'
            })

            // Intentar guardar
            await page.getByRole('button', { name: /crear bloqueo/i }).click()

            // Debe mostrar error de solapamiento
            // El mensaje puede ser del backend sobre overlapping
            await expect(page.getByText(/ya existe.*bloqueo|solapamiento|overlap|conflicto|superpone/i)).toBeVisible({
                timeout: 5000
            })
        })
    })
})
