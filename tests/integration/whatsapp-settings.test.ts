/**
 * Integration tests for WhatsApp notification channel settings
 * Tests the US-10.1 feature: Enable/disable WhatsApp per business
 *
 * @see docs/user-stories.md - US-10.1
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner, getBusinessById, updateBusinessSettings } from '@/data/repositories/business.repo'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('WhatsApp Settings - Integration Tests (US-10.1)', () => {
    let businessId: string
    const userId = 'test-user-whatsapp-settings-' + Date.now()

    beforeAll(async () => {
        // Create test business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `WhatsApp Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `whatsapp-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id
    })

    afterAll(async () => {
        // Cleanup: delete business member first, then business
        await prisma.businessMember.deleteMany({ where: { businessId } })
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('Default values', () => {
        it('should have whatsappNotificationsEnabled=false by default', async () => {
            const business = await getBusinessById(prisma, businessId)
            expect(business).not.toBeNull()
            expect(business!.whatsappNotificationsEnabled).toBe(false)
        })

        it('should have emailNotificationsEnabled=true by default', async () => {
            const business = await getBusinessById(prisma, businessId)
            expect(business).not.toBeNull()
            expect(business!.emailNotificationsEnabled).toBe(true)
        })
    })

    describe('Enable WhatsApp', () => {
        it('should enable WhatsApp notifications', async () => {
            const updated = await updateBusinessSettings(prisma, businessId, {
                whatsappNotificationsEnabled: true
            })

            expect(updated.whatsappNotificationsEnabled).toBe(true)
            // Verify email wasn't affected
            expect(updated.emailNotificationsEnabled).toBe(true)
        })

        it('should persist the change', async () => {
            const business = await getBusinessById(prisma, businessId)
            expect(business!.whatsappNotificationsEnabled).toBe(true)
        })
    })

    describe('Disable WhatsApp', () => {
        it('should disable WhatsApp notifications', async () => {
            const updated = await updateBusinessSettings(prisma, businessId, {
                whatsappNotificationsEnabled: false
            })

            expect(updated.whatsappNotificationsEnabled).toBe(false)
        })
    })

    describe('Independence of channels', () => {
        it('should allow enabling WhatsApp without affecting email', async () => {
            // Ensure email is enabled
            await updateBusinessSettings(prisma, businessId, {
                emailNotificationsEnabled: true
            })

            // Enable WhatsApp
            const updated = await updateBusinessSettings(prisma, businessId, {
                whatsappNotificationsEnabled: true
            })

            expect(updated.whatsappNotificationsEnabled).toBe(true)
            expect(updated.emailNotificationsEnabled).toBe(true)
        })

        it('should allow disabling email without affecting WhatsApp', async () => {
            // Both channels enabled
            await updateBusinessSettings(prisma, businessId, {
                emailNotificationsEnabled: true,
                whatsappNotificationsEnabled: true
            })

            // Disable only email
            const updated = await updateBusinessSettings(prisma, businessId, {
                emailNotificationsEnabled: false
            })

            expect(updated.emailNotificationsEnabled).toBe(false)
            expect(updated.whatsappNotificationsEnabled).toBe(true)

            // Re-enable email for other tests
            await updateBusinessSettings(prisma, businessId, {
                emailNotificationsEnabled: true
            })
        })

        it('should allow updating both channels at once', async () => {
            const updated = await updateBusinessSettings(prisma, businessId, {
                emailNotificationsEnabled: false,
                whatsappNotificationsEnabled: false
            })

            expect(updated.emailNotificationsEnabled).toBe(false)
            expect(updated.whatsappNotificationsEnabled).toBe(false)

            // Re-enable for other tests
            await updateBusinessSettings(prisma, businessId, {
                emailNotificationsEnabled: true
            })
        })
    })

    describe('Other settings not affected', () => {
        it('should not affect reminder settings when updating channels', async () => {
            // Set specific reminder settings
            await updateBusinessSettings(prisma, businessId, {
                remindersEnabled: true,
                reminderOffsetsMinutes: [1440, 120]
            })

            // Update channel settings
            const updated = await updateBusinessSettings(prisma, businessId, {
                whatsappNotificationsEnabled: true
            })

            // Verify reminder settings unchanged
            expect(updated.remindersEnabled).toBe(true)
            expect(updated.reminderOffsetsMinutes).toEqual([1440, 120])
        })
    })
})
