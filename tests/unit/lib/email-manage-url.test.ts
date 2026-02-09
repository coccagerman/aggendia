/**
 * Unit tests for email template manage URL integration
 *
 * Tests that confirmation and reminder templates correctly render
 * the self-service manage URL (button in HTML, link in text).
 *
 * @see docs/user-stories.md - Épica 11
 */

import { describe, it, expect } from 'vitest'
import {
    renderConfirmationEmail,
    renderConfirmationEmailText,
    ConfirmationEmailData
} from '@/lib/resend/templates/confirmation.template'
import {
    renderReminderEmail,
    renderReminderEmailText,
    ReminderEmailData
} from '@/lib/resend/templates/reminder.template'

const baseConfirmationData: ConfirmationEmailData = {
    customerName: 'María López',
    businessName: 'Test Salon',
    serviceName: 'Corte de pelo',
    resourceName: 'Juan García',
    resourceLabel: 'Profesional',
    formattedDateTime: 'Lunes 15 de enero, 14:00',
    timezone: 'Argentina',
    address: 'Av. Test 123'
}

const baseReminderData: ReminderEmailData = {
    customerName: 'María López',
    businessName: 'Test Salon',
    serviceName: 'Corte de pelo',
    resourceName: 'Juan García',
    resourceLabel: 'Profesional',
    formattedDateTime: 'Lunes 15 de enero, 14:00',
    timezone: 'Argentina',
    address: 'Av. Test 123',
    reminderType: '24h' as const
}

describe('Confirmation email - manageUrl', () => {
    it('renders CTA button when manageUrl is provided (HTML)', () => {
        const html = renderConfirmationEmail({
            ...baseConfirmationData,
            manageUrl: 'https://app.test/b/salon/appointment/apt-1?token=tok-1'
        })

        expect(html).toContain('Cancelar o reprogramar turno')
        expect(html).toContain('https://app.test/b/salon/appointment/apt-1?token=tok-1')
        expect(html).not.toContain('contactá al negocio')
    })

    it('renders fallback text when manageUrl is not provided (HTML)', () => {
        const html = renderConfirmationEmail(baseConfirmationData)

        expect(html).toContain('contactá al negocio')
        expect(html).not.toContain('Cancelar o reprogramar turno')
    })

    it('renders fallback text when manageUrl is null (HTML)', () => {
        const html = renderConfirmationEmail({ ...baseConfirmationData, manageUrl: null })

        expect(html).toContain('contactá al negocio')
    })

    it('renders manage URL link in plain text when provided', () => {
        const text = renderConfirmationEmailText({
            ...baseConfirmationData,
            manageUrl: 'https://app.test/b/salon/appointment/apt-1?token=tok-1'
        })

        expect(text).toContain('https://app.test/b/salon/appointment/apt-1?token=tok-1')
        expect(text).toContain('Ingresá aquí')
        expect(text).not.toContain('contactá al negocio')
    })

    it('renders fallback text in plain text when manageUrl is not provided', () => {
        const text = renderConfirmationEmailText(baseConfirmationData)

        expect(text).toContain('contactá al negocio')
    })
})

describe('Reminder email - manageUrl', () => {
    it('renders CTA button when manageUrl is provided (HTML)', () => {
        const html = renderReminderEmail({
            ...baseReminderData,
            manageUrl: 'https://app.test/b/salon/appointment/apt-2?token=tok-2'
        })

        expect(html).toContain('Cancelar o reprogramar turno')
        expect(html).toContain('https://app.test/b/salon/appointment/apt-2?token=tok-2')
        expect(html).not.toContain('contactá al negocio')
    })

    it('renders fallback text when manageUrl is not provided (HTML)', () => {
        const html = renderReminderEmail(baseReminderData)

        expect(html).toContain('contactá al negocio')
    })

    it('renders manage URL link in plain text when provided', () => {
        const text = renderReminderEmailText({
            ...baseReminderData,
            manageUrl: 'https://app.test/b/salon/appointment/apt-2?token=tok-2'
        })

        expect(text).toContain('https://app.test/b/salon/appointment/apt-2?token=tok-2')
        expect(text).not.toContain('contactá al negocio')
    })

    it('renders fallback text in plain text when manageUrl is not provided', () => {
        const text = renderReminderEmailText(baseReminderData)

        expect(text).toContain('contactá al negocio')
    })
})
