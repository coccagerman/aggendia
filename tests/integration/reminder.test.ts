/**
 * Integration tests for reminder functionality
 * Tests the full flow of finding eligible appointments and processing reminders
 *
 * @see docs/user-stories.md - US-8.2, US-8.3
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner, updateBusinessSettings } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { createAppointment, findEligibleAppointmentsForReminders } from '@/data/repositories/appointment.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { notificationExists } from '@/data/repositories/notification.repo'
import { addMinutes, addHours } from 'date-fns'
import { calculateQueryWindow } from '@/domain/notifications/reminder.service'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

// Mock email sending to avoid actual emails in tests
vi.mock('@/lib/resend/client', () => ({
    resend: {
        emails: {
            send: vi.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null, headers: null })
        }
    },
    defaultFromEmail: 'test@example.com',
    isEmailEnabled: vi.fn().mockReturnValue(true)
}))

describe('Reminder Integration Tests', () => {
    let businessId: string
    let resourceId: string
    let serviceId: string
    let customerId: string
    const userId = 'test-user-reminder-' + Date.now()

    beforeAll(async () => {
        // Create test business with reminders enabled
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Reminder Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `reminder-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Ensure reminders are enabled with both offsets
        await updateBusinessSettings(prisma, businessId, {
            remindersEnabled: true,
            reminderOffsetsMinutes: [1440, 120]
        })

        // Create resource with availability
        const resource = await createResource(prisma, businessId, {
            name: 'Test Professional Reminder',
            type: 'PERSON',
            status: 'ACTIVE'
        })
        resourceId = resource.id

        // Set 24/7 availability
        await setAvailability(prisma, resourceId, [
            { dayOfWeek: 0, startMinutes: 0, endMinutes: 1440 },
            { dayOfWeek: 1, startMinutes: 0, endMinutes: 1440 },
            { dayOfWeek: 2, startMinutes: 0, endMinutes: 1440 },
            { dayOfWeek: 3, startMinutes: 0, endMinutes: 1440 },
            { dayOfWeek: 4, startMinutes: 0, endMinutes: 1440 },
            { dayOfWeek: 5, startMinutes: 0, endMinutes: 1440 },
            { dayOfWeek: 6, startMinutes: 0, endMinutes: 1440 }
        ])

        // Create service
        const service = await createService(prisma, businessId, {
            name: 'Test Service Reminder',
            durationMinutes: 30,
            slotIntervalMinutes: 30
        })
        serviceId = service.id

        // Link service to resource
        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        // Create customer with email
        const customer = await upsertCustomer(prisma, businessId, {
            fullName: 'Test Customer Reminder',
            email: 'reminder-test@example.com',
            phone: null
        })
        customerId = customer.id
    })

    afterAll(async () => {
        // Cleanup
        await prisma.notification.deleteMany({ where: { businessId } })
        await prisma.appointment.deleteMany({ where: { businessId } })
        await prisma.customer.deleteMany({ where: { businessId } })
        await prisma.serviceResource.deleteMany({ where: { businessId } })
        await prisma.availabilityRule.deleteMany({ where: { resource: { businessId } } })
        await prisma.service.deleteMany({ where: { businessId } })
        await prisma.resource.deleteMany({ where: { businessId } })
        await prisma.businessMember.deleteMany({ where: { businessId } })
        await prisma.business.deleteMany({ where: { id: businessId } })
    })

    describe('findEligibleAppointmentsForReminders', () => {
        it('should find appointments within the 24h query window', async () => {
            // Create appointment exactly 24h + 3min from now (within window)
            const now = new Date()
            const appointmentStart = addMinutes(addHours(now, 24), 3)
            const appointmentEnd = addMinutes(appointmentStart, 30)
            const occupiedEnd = appointmentEnd

            const { windowStart, windowEnd } = calculateQueryWindow(now, 1440, TIMEZONE)

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: appointmentStart,
                endAt: appointmentEnd,
                occupiedEndAt: occupiedEnd,
                notes: 'Test appointment for 24h reminder'
            })

            // Query for 24h offset
            const eligible = await findEligibleAppointmentsForReminders(prisma, {
                offsetMinutes: 1440,
                windowStart,
                windowEnd,
                businessId
            })

            expect(eligible.length).toBeGreaterThanOrEqual(1)
            const found = eligible.find(a => a.id === appointment.id)
            expect(found).toBeDefined()
            expect(found?.business.remindersEnabled).toBe(true)
            expect(found?.customer.email).toBe('reminder-test@example.com')

            // Cleanup
            await prisma.appointment.delete({ where: { id: appointment.id } })
        })

        it('should not find appointments outside the query window', async () => {
            // Create appointment 25h from now (outside 24h window)
            const now = new Date()
            const appointmentStart = addHours(now, 25)
            const appointmentEnd = addMinutes(appointmentStart, 30)
            const occupiedEnd = appointmentEnd

            const { windowStart, windowEnd } = calculateQueryWindow(now, 1440, TIMEZONE)

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: appointmentStart,
                endAt: appointmentEnd,
                occupiedEndAt: occupiedEnd,
                notes: 'Test appointment outside window'
            })

            // Query for 24h offset
            const eligible = await findEligibleAppointmentsForReminders(prisma, {
                offsetMinutes: 1440,
                windowStart,
                windowEnd,
                businessId
            })

            const found = eligible.find(a => a.id === appointment.id)
            expect(found).toBeUndefined()

            // Cleanup
            await prisma.appointment.delete({ where: { id: appointment.id } })
        })

        it('should not find appointments when reminders are disabled for business', async () => {
            // Disable reminders temporarily
            await updateBusinessSettings(prisma, businessId, {
                remindersEnabled: false
            })

            // Create appointment within 24h window
            const now = new Date()
            const appointmentStart = addMinutes(addHours(now, 24), 2)
            const appointmentEnd = addMinutes(appointmentStart, 30)
            const occupiedEnd = appointmentEnd

            const { windowStart, windowEnd } = calculateQueryWindow(now, 1440, TIMEZONE)

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: appointmentStart,
                endAt: appointmentEnd,
                occupiedEndAt: occupiedEnd,
                notes: 'Test appointment with reminders disabled'
            })

            // Query for 24h offset
            const eligible = await findEligibleAppointmentsForReminders(prisma, {
                offsetMinutes: 1440,
                windowStart,
                windowEnd,
                businessId
            })

            const found = eligible.find(a => a.id === appointment.id)
            expect(found).toBeUndefined()

            // Re-enable reminders and cleanup
            await updateBusinessSettings(prisma, businessId, {
                remindersEnabled: true
            })
            await prisma.appointment.delete({ where: { id: appointment.id } })
        })

        it('should not find appointments if offset is not in business config', async () => {
            // Set only 24h offset (remove 2h)
            await updateBusinessSettings(prisma, businessId, {
                reminderOffsetsMinutes: [1440]
            })

            // Create appointment within 2h window
            const now = new Date()
            const appointmentStart = addMinutes(addHours(now, 2), 2)
            const appointmentEnd = addMinutes(appointmentStart, 30)
            const occupiedEnd = appointmentEnd

            const { windowStart, windowEnd } = calculateQueryWindow(now, 120, TIMEZONE)

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: appointmentStart,
                endAt: appointmentEnd,
                occupiedEndAt: occupiedEnd,
                notes: 'Test appointment without 2h offset config'
            })

            // Query for 2h offset (which is not configured)
            const eligible = await findEligibleAppointmentsForReminders(prisma, {
                offsetMinutes: 120,
                windowStart,
                windowEnd,
                businessId
            })

            const found = eligible.find(a => a.id === appointment.id)
            expect(found).toBeUndefined()

            // Restore both offsets and cleanup
            await updateBusinessSettings(prisma, businessId, {
                reminderOffsetsMinutes: [1440, 120]
            })
            await prisma.appointment.delete({ where: { id: appointment.id } })
        })

        it('should not find cancelled appointments', async () => {
            // Create appointment within 24h window
            const now = new Date()
            const appointmentStart = addMinutes(addHours(now, 24), 2)
            const appointmentEnd = addMinutes(appointmentStart, 30)
            const occupiedEnd = appointmentEnd

            const { windowStart, windowEnd } = calculateQueryWindow(now, 1440, TIMEZONE)

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: appointmentStart,
                endAt: appointmentEnd,
                occupiedEndAt: occupiedEnd,
                notes: 'Test appointment to be cancelled'
            })

            // Cancel the appointment
            await prisma.appointment.update({
                where: { id: appointment.id },
                data: { status: 'CANCELLED' }
            })

            // Query for 24h offset
            const eligible = await findEligibleAppointmentsForReminders(prisma, {
                offsetMinutes: 1440,
                windowStart,
                windowEnd,
                businessId
            })

            const found = eligible.find(a => a.id === appointment.id)
            expect(found).toBeUndefined()

            // Cleanup
            await prisma.appointment.delete({ where: { id: appointment.id } })
        })
    })

    describe('Idempotency (notificationExists)', () => {
        it('should correctly detect existing notifications', async () => {
            // Create an appointment
            const now = new Date()
            const appointmentStart = addMinutes(addHours(now, 24), 2)
            const appointmentEnd = addMinutes(appointmentStart, 30)
            const occupiedEnd = appointmentEnd

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: appointmentStart,
                endAt: appointmentEnd,
                occupiedEndAt: occupiedEnd,
                notes: 'Test idempotency'
            })

            // Calculate scheduledFor (24h before appointment)
            const scheduledFor = addMinutes(appointmentStart, -1440)

            // First check - should not exist
            const existsBefore = await notificationExists(prisma, appointment.id, 'REMINDER', scheduledFor)
            expect(existsBefore).toBe(false)

            // Create notification
            await prisma.notification.create({
                data: {
                    businessId,
                    appointmentId: appointment.id,
                    channel: 'EMAIL',
                    type: 'REMINDER',
                    to: 'test@example.com',
                    status: 'SENT',
                    scheduledFor
                }
            })

            // Second check - should exist
            const existsAfter = await notificationExists(prisma, appointment.id, 'REMINDER', scheduledFor)
            expect(existsAfter).toBe(true)

            // Cleanup
            await prisma.notification.deleteMany({ where: { appointmentId: appointment.id } })
            await prisma.appointment.delete({ where: { id: appointment.id } })
        })
    })
})
