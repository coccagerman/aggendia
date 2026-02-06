/**
 * E2E Fixtures - Main Export
 *
 * Este archivo exporta todas las fixtures disponibles para tests E2E.
 * Las fixtures garantizan aislamiento total entre tests para ejecución paralela.
 *
 * @see docs/e2e-guide.md para documentación completa
 */

export { test, expect } from './auth.fixture'
export type { TestUserData, AuthenticatedPageFixtures } from './auth.fixture'
export type { TestBusinessData, BusinessFixtures } from './business.fixture'
export type { BookableSetupData, BookingFixtures } from './booking.fixture'
