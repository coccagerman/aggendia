/**
 * E2E Fixtures - Auth
 *
 * Fixtures para autenticación y páginas autenticadas.
 * Cada test obtiene un usuario único para máximo aislamiento.
 */

import { test as base, expect, Page } from '@playwright/test'
import { signupUser } from '../helpers/auth.helper'
import { generateUniqueId } from '../helpers/unique-id.helper'

export type TestUserData = {
    email: string
    password: string
}

export type AuthenticatedPageFixtures = {
    /** Datos de usuario únicos para este test */
    testUser: TestUserData
    /** Página con usuario autenticado (ya logueado) */
    authenticatedPage: Page
}

/**
 * Fixture base que extiende Playwright con fixtures de autenticación.
 *
 * Uso:
 * ```typescript
 * import { test, expect } from '../fixtures'
 *
 * test('mi test', async ({ testUser, authenticatedPage }) => {
 *   // testUser tiene { email, password } únicos
 *   // authenticatedPage ya está logueada
 * })
 * ```
 */
export const test = base.extend<AuthenticatedPageFixtures>({
    /**
     * Genera datos de usuario únicos para cada test.
     * El email incluye UUID para evitar colisiones en ejecución paralela.
     */
    testUser: async ({}, applyFixture) => {
        const uniqueId = generateUniqueId()
        const email = `e2e-${uniqueId}@test.turnosapp.local`
        const password = 'TestPassword123!'

        await applyFixture({ email, password })

        // No cleanup - toleramos usuarios huérfanos en Supabase
        // Se limpian periódicamente con reset-test-db
    },

    /**
     * Proporciona una página ya autenticada con el testUser.
     * El signup se realiza automáticamente.
     */
    authenticatedPage: async ({ page, testUser }, applyFixture) => {
        await signupUser(page, testUser.email, testUser.password)
        await applyFixture(page)
    }
})

export { expect }
