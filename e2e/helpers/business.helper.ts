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
    await page.getByRole('link', { name: /crear negocio/i }).click()
    await page.getByLabel(/nombre/i).fill(businessName)
    await page.getByLabel(/zona horaria/i).click()
    await page
        .getByRole('option', { name: /buenos aires/i })
        .first()
        .click()
    await page.getByRole('button', { name: /crear negocio/i }).click()
    await expect(page).toHaveURL('/dashboard')
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
