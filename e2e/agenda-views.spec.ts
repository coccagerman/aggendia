/**
 * E2E Tests - Agenda Views (US-7.4, US-7.5)
 *
 * Tests end-to-end para las distintas granularidades de agenda (día, semana, mes).
 * Usa fixtures para aislamiento completo entre tests paralelos.
 *
 * @see docs/user-stories.md - US-7.4 Ver agenda con distintas granularidades
 * @see docs/user-stories.md - US-7.5 Navegar la agenda en el tiempo
 */

import { test, expect } from './fixtures/business.fixture'

/**
 * Helper para obtener el nombre del mes actual en español
 */
function getCurrentMonthNameES(): string {
    const months = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre'
    ]
    return months[new Date().getMonth()]
}

/**
 * Helper para obtener el nombre del mes siguiente en español
 */
function getNextMonthNameES(): string {
    const months = [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre'
    ]
    return months[(new Date().getMonth() + 1) % 12]
}

test.describe('US-7.4: Ver agenda con distintas granularidades', () => {
    test('should show view selector with day/week/month options', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navegar a la agenda
        await page.goto(`/dashboard/business/${businessId}/agenda`)
        await page.waitForLoadState('networkidle')

        // Verificar que existe el selector de vista (muestra "Día" por defecto)
        const viewSelector = page.locator('[role="combobox"]').filter({ hasText: /día/i }).first()
        await expect(viewSelector).toBeVisible()

        // Abrir el selector
        await viewSelector.click()

        // Verificar las 3 opciones en el listbox
        const listbox = page.locator('[role="listbox"]')
        await expect(listbox.getByText('Día')).toBeVisible()
        await expect(listbox.getByText('Semana')).toBeVisible()
        await expect(listbox.getByText('Mes')).toBeVisible()
    })

    test('should switch between day, week and month views', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navegar a la agenda
        await page.goto(`/dashboard/business/${businessId}/agenda`)
        await page.waitForLoadState('networkidle')

        // Verificar que la vista por defecto es día
        await expect(page.url()).not.toContain('view=week')
        await expect(page.url()).not.toContain('view=month')

        // Cambiar a vista semana
        const viewSelector = page.locator('[role="combobox"]').filter({ hasText: /día/i }).first()
        await viewSelector.click()
        await page.locator('[role="listbox"]').getByText('Semana').click()

        // Verificar URL contiene view=week
        await expect(page).toHaveURL(/view=week/, { timeout: 5000 })

        // Verificar que muestra contenido de semana
        const currentMonth = getCurrentMonthNameES()
        const nextMonth = getNextMonthNameES()
        const weekContentRegex = new RegExp(
            `${currentMonth}.*-.*${nextMonth}|${currentMonth}|no hay turnos.*semana`,
            'i'
        )
        await expect(page.getByText(weekContentRegex).first()).toBeVisible({
            timeout: 5000
        })

        // Cambiar a vista mes
        const viewSelectorWeek = page
            .locator('[role="combobox"]')
            .filter({ hasText: /semana/i })
            .first()
        await viewSelectorWeek.click()
        await page.locator('[role="listbox"]').getByText('Mes').click()

        // Verificar URL contiene view=month
        await expect(page).toHaveURL(/view=month/, { timeout: 5000 })

        // Verificar que muestra contenido de mes
        const monthContentRegex = new RegExp(`${currentMonth}|no hay turnos.*mes`, 'i')
        await expect(page.getByText(monthContentRegex).first()).toBeVisible({
            timeout: 5000
        })

        // Volver a vista día
        const viewSelectorMonth = page.locator('[role="combobox"]').filter({ hasText: /mes/i }).first()
        await viewSelectorMonth.click()
        await page.locator('[role="listbox"]').getByText('Día').click()
        await page.waitForLoadState('networkidle')

        // Verificar URL no contiene view param (default)
        await expect(page).not.toHaveURL(/view=/)
    })
})

test.describe('US-7.5: Navegar la agenda en el tiempo', () => {
    test('should navigate with prev/next buttons in day view', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navegar a la agenda
        await page.goto(`/dashboard/business/${businessId}/agenda`)
        await page.waitForLoadState('networkidle')

        // Obtener la fecha inicial de hoy (formato YYYY-MM-DD)
        const today = new Date()
        const initialDate = today.toISOString().split('T')[0]

        // Click en siguiente - esperar que la URL cambie a tener date param
        await page.getByRole('button', { name: /siguiente/i }).click()
        await page.waitForURL(/date=/, { timeout: 5000 })
        await page.waitForLoadState('networkidle')

        // La fecha debería haber cambiado (extraer de URL)
        const afterNextMatch = page.url().match(/date=(\d{4}-\d{2}-\d{2})/)
        const afterNextDate = afterNextMatch ? afterNextMatch[1] : ''
        expect(afterNextDate).not.toBe(initialDate)

        // Click en anterior - esperar que la fecha vuelva
        await page.getByRole('button', { name: /anterior/i }).click()
        // Esperar que la URL cambie al date inicial
        await page.waitForURL(new RegExp(`date=${initialDate}`), { timeout: 5000 })

        // Debería volver a la fecha original
        const afterPrevMatch = page.url().match(/date=(\d{4}-\d{2}-\d{2})/)
        const afterPrevDate = afterPrevMatch ? afterPrevMatch[1] : ''
        expect(afterPrevDate).toBe(initialDate)
    })

    test('should navigate week view by 7 days', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navegar a la agenda
        await page.goto(`/dashboard/business/${businessId}/agenda`)
        await page.waitForLoadState('networkidle')

        // Cambiar a vista semana
        const viewSelector = page.locator('[role="combobox"]').filter({ hasText: /día/i }).first()
        await viewSelector.click()
        await page.locator('[role="listbox"]').getByText('Semana').click()
        await page.waitForLoadState('networkidle')

        // Obtener la fecha actual de la URL
        const initialDateMatch = page.url().match(/date=(\d{4}-\d{2}-\d{2})/)
        const initialDate = initialDateMatch ? initialDateMatch[1] : ''

        // Click en siguiente
        await page.getByRole('button', { name: /siguiente/i }).click()
        await page.waitForLoadState('networkidle')

        // La fecha debería avanzar 7 días
        const afterNextMatch = page.url().match(/date=(\d{4}-\d{2}-\d{2})/)
        const afterNextDate = afterNextMatch ? afterNextMatch[1] : ''

        // Calcular diferencia en días
        if (initialDate && afterNextDate) {
            const diffDays =
                (new Date(afterNextDate).getTime() - new Date(initialDate).getTime()) / (1000 * 60 * 60 * 24)
            expect(diffDays).toBe(7)
        }
    })

    test('should navigate month view by 1 month', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navegar a la agenda
        await page.goto(`/dashboard/business/${businessId}/agenda`)
        await page.waitForLoadState('networkidle')

        // Cambiar a vista mes
        const viewSelector = page.locator('[role="combobox"]').filter({ hasText: /día/i }).first()
        await viewSelector.click()
        await page.locator('[role="listbox"]').getByText('Mes').click()
        await expect(page).toHaveURL(/view=month/, { timeout: 5000 })
        await page.waitForLoadState('networkidle')

        // Obtener el mes inicial de hoy (formato YYYY-MM)
        const today = new Date()
        const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

        // Click en siguiente - esperar que el mes cambie en la URL
        await page.getByRole('button', { name: /siguiente/i }).click()
        // Esperar que el mes cambie
        const nextMonthNum = ((today.getMonth() + 1) % 12) + 1
        const nextMonthStr = nextMonthNum.toString().padStart(2, '0')
        await page.waitForURL(new RegExp(`date=\\d{4}-${nextMonthStr}`), {
            timeout: 5000
        })

        // Extraer el mes de la URL después de navegar
        const afterMatch = page.url().match(/date=(\d{4}-\d{2})/)
        const afterMonth = afterMatch ? afterMatch[1] : ''
        expect(afterMonth).not.toBe(initialMonth)
    })
})

test.describe('Agenda views empty states', () => {
    test('should show empty state message appropriate to each view', async ({ authenticatedPage, testBusiness }) => {
        const page = authenticatedPage
        const { businessId } = testBusiness

        // Navegar a la agenda
        await page.goto(`/dashboard/business/${businessId}/agenda`)
        await page.waitForLoadState('networkidle')

        // Vista día - mensaje apropiado
        await expect(page.getByText(/no hay turnos.*día|no hay turnos agendados/i).first()).toBeVisible({
            timeout: 5000
        })

        // Cambiar a vista semana
        const viewSelector = page.locator('[role="combobox"]').filter({ hasText: /día/i }).first()
        await viewSelector.click()
        await page.locator('[role="listbox"]').getByText('Semana').click()
        await expect(page).toHaveURL(/view=week/, { timeout: 5000 })

        // Vista semana - mensaje apropiado
        await expect(page.getByText(/no hay turnos.*semana/i).first()).toBeVisible({
            timeout: 5000
        })

        // Cambiar a vista mes
        const viewSelectorMonth = page
            .locator('[role="combobox"]')
            .filter({ hasText: /semana/i })
            .first()
        await viewSelectorMonth.click()
        await page.locator('[role="listbox"]').getByText('Mes').click()
        await expect(page).toHaveURL(/view=month/, { timeout: 5000 })

        // Vista mes - mensaje apropiado
        await expect(page.getByText(/no hay turnos.*mes/i).first()).toBeVisible({
            timeout: 5000
        })
    })
})
