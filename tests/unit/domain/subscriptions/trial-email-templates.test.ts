/**
 * Unit Tests - Trial Email Templates
 *
 * Tests for the trial-related email template rendering functions.
 */

import { describe, it, expect } from 'vitest'
import { renderTrialExpiringEmail } from '@/lib/resend/templates/trial-expiring.template'
import { renderTrialExpiredEmail } from '@/lib/resend/templates/trial-expired.template'

describe('Trial Expiring Email Template', () => {
    const baseData = {
        businessName: 'Mi Peluquería',
        daysRemaining: 3,
        trialEndsAt: '15 de febrero de 2025',
        subscribeUrl: 'https://app.turnosapp.com/dashboard/business/123/settings/subscription'
    }

    it('renders HTML with business name', () => {
        const html = renderTrialExpiringEmail(baseData)
        expect(html).toContain('Mi Peluquería')
    })

    it('renders HTML with trial end date', () => {
        const html = renderTrialExpiringEmail(baseData)
        expect(html).toContain('15 de febrero de 2025')
    })

    it('renders subscribe URL', () => {
        const html = renderTrialExpiringEmail(baseData)
        expect(html).toContain(baseData.subscribeUrl)
    })

    it('shows "termina en 3 días" for daysRemaining=3', () => {
        const html = renderTrialExpiringEmail({ ...baseData, daysRemaining: 3 })
        expect(html).toContain('Tu prueba termina en 3 días')
    })

    it('shows "termina mañana" for daysRemaining=1', () => {
        const html = renderTrialExpiringEmail({ ...baseData, daysRemaining: 1 })
        expect(html).toContain('Tu prueba termina mañana')
    })

    it('shows "termina hoy" for daysRemaining=0', () => {
        const html = renderTrialExpiringEmail({ ...baseData, daysRemaining: 0 })
        expect(html).toContain('Tu prueba termina hoy')
    })

    it('escapes HTML in business name', () => {
        const html = renderTrialExpiringEmail({ ...baseData, businessName: '<script>alert("xss")</script>' })
        expect(html).not.toContain('<script>')
        expect(html).toContain('&lt;script&gt;')
    })

    it('includes owner name greeting when provided', () => {
        const html = renderTrialExpiringEmail({ ...baseData, ownerName: 'María' })
        expect(html).toContain('Hola María')
    })
})

describe('Trial Expired Email Template', () => {
    const baseData = {
        businessName: 'Cancha FC',
        subscribeUrl: 'https://app.turnosapp.com/dashboard/business/456/settings/subscription'
    }

    it('renders HTML with business name', () => {
        const html = renderTrialExpiredEmail(baseData)
        expect(html).toContain('Cancha FC')
    })

    it('renders subscribe URL', () => {
        const html = renderTrialExpiredEmail(baseData)
        expect(html).toContain(baseData.subscribeUrl)
    })

    it('indicates data is safe', () => {
        const html = renderTrialExpiredEmail(baseData)
        expect(html).toContain('datos están seguros')
    })

    it('has the correct title', () => {
        const html = renderTrialExpiredEmail(baseData)
        expect(html).toContain('Tu período de prueba terminó')
    })
})
