import { defineConfig, devices } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

const PLAYWRIGHT_ARTIFACTS_DIR = path.join(os.tmpdir(), 'turnosapp-playwright-artifacts')
const PLAYWRIGHT_REPORT_DIR = path.join(os.tmpdir(), 'turnosapp-playwright-report')

/**
 * Playwright Configuration for E2E Tests
 *
 * Configurado para ejecución paralela con aislamiento total entre tests.
 * Cada test crea sus propios datos (usuario, negocio, etc.) usando UUIDs.
 *
 * @see docs/e2e-guide.md para convenciones de tests
 */
export default defineConfig({
    testDir: './e2e',

    // Importante: guardar artifacts fuera del workspace para evitar que Next dev
    // entre en recompilación continua al detectar cambios en test-results/.
    outputDir: PLAYWRIGHT_ARTIFACTS_DIR,

    // Paralelismo: cada test corre independiente
    fullyParallel: true,

    // Workers: 4 en CI (más recursos), 2 en local (evita saturar)
    workers: process.env.CI ? 4 : process.env.PLAYWRIGHT_WORKERS ? parseInt(process.env.PLAYWRIGHT_WORKERS) : 2,

    forbidOnly: !!process.env.CI,

    // Retries para mayor estabilidad (especialmente en CI)
    retries: process.env.CI ? 2 : 1,

    // Reporters: HTML para debugging + list para output en consola
    reporter: [['html', { open: 'never', outputFolder: PLAYWRIGHT_REPORT_DIR }], ['list']],

    // Timeout por test: 60s máximo (antes era hasta 180s)
    timeout: 60000,

    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',

        // Timeouts más estrictos para detectar flakiness
        actionTimeout: 10000,
        navigationTimeout: 15000
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }
    ],
    webServer: {
        command: 'yarn dev:test',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000
    }
})
