/**
 * E2E Helper - Business
 *
 * Helper functions para operaciones de negocio en tests E2E.
 */

import { Page, expect } from '@playwright/test'

/**
 * Crea un negocio desde el dashboard.
 * Asume que el usuario ya está autenticado y en /dashboard.
 */
export async function createBusiness(page: Page, businessName: string) {
    if (!page.url().includes('/dashboard/business/new')) {
        await page.getByRole('link', { name: /crear negocio/i }).click()
        await page.waitForURL('**/dashboard/business/new', { timeout: 10000 })
    }

    await page.getByLabel(/nombre/i).fill(businessName)

    const createResponsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/v1/businesses') && resp.request().method() === 'POST',
        { timeout: 15000 }
    )

    await page.getByRole('button', { name: /crear negocio/i }).click()
    const response = await createResponsePromise

    if (!response.ok()) {
        const body = await response.text()
        throw new Error(`Create business failed (${response.status()}): ${body}`)
    }

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 })
}

/**
 * Navega al formulario de creación de recurso.
 * Asume que el usuario está en /dashboard y tiene al menos un negocio.
 */
export async function navigateToCreateResource(page: Page) {
    await Promise.all([
        page.waitForURL('**/dashboard/business/**/resources/new', { timeout: 10000 }),
        page
            .getByRole('link', { name: /crear.*recurso/i })
            .first()
            .click()
    ])
}

/**
 * Setup completo: signup + crear negocio.
 * Retorna el nombre del negocio creado.
 */
export async function setupBusinessWithUser(
    page: Page,
    signupUser: (page: Page, email: string, password: string) => Promise<void>,
    email: string,
    password: string,
    businessName: string
) {
    await signupUser(page, email, password)
    await createBusiness(page, businessName)
    return businessName
}
