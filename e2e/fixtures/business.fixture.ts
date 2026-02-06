/**
 * E2E Fixtures - Business
 *
 * Fixtures para tests que requieren un negocio creado.
 */

import { test as authTest, expect } from './auth.fixture'
import type { AuthenticatedPageFixtures } from './auth.fixture'
import { createBusiness } from '../helpers/business.helper'
import { generateUniqueId } from '../helpers/unique-id.helper'

export type TestBusinessData = {
    businessName: string
    businessId: string
    slug: string
}

export type BusinessFixtures = AuthenticatedPageFixtures & {
    /** Datos del negocio creado para este test */
    testBusiness: TestBusinessData
}

/**
 * Fixture que extiende auth con un negocio ya creado.
 *
 * Uso:
 * ```typescript
 * import { test, expect } from '../fixtures/business.fixture'
 *
 * test('mi test', async ({ authenticatedPage, testBusiness }) => {
 *   // testBusiness tiene { businessName, businessId, slug }
 * })
 * ```
 */
export const test = authTest.extend<{ testBusiness: TestBusinessData }>({
    testBusiness: async ({ authenticatedPage }, applyFixture) => {
        const page = authenticatedPage
        const uniqueId = generateUniqueId()
        const businessName = `Business ${uniqueId.slice(0, 8)}`

        // Crear negocio
        await createBusiness(page, businessName)

        // Esperar a que el dashboard cargue completamente
        await page.waitForLoadState('networkidle')

        // Obtener el negocio via API - más confiable que scraping del DOM
        const response = await page.request.get('/api/v1/businesses')
        const data = await response.json()
        const businesses = data.data || []
        const business = businesses.find((b: { name: string }) => b.name === businessName)

        if (!business) {
            throw new Error(
                `Could not find business via API: ${businessName}. Businesses: ${JSON.stringify(businesses.map((b: { name: string }) => b.name))}`
            )
        }

        const businessId = business.id
        const slug = business.slug

        await applyFixture({ businessName, businessId, slug })
    }
})

export { expect }
