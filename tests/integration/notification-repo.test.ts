/**
 * Integration tests for notification repository
 * Tests database operations for notifications
 *
 * @see docs/user-stories.md - US-8.1 Confirmación de reserva por email
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    createNotification,
    updateNotificationStatus,
    getNotificationById,
    getNotificationsByAppointmentId,
    notificationExists
} from '@/data/repositories/notification.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { createAppointment } from '@/data/repositories/appointment.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { addMinutes } from 'date-fns'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('Notification Repository - Integration Tests', () => {
    let businessId: string
    let appointmentId: string
    let customerId: string
    const userId = 'test-user-notification-repo-' + Date.now()

    beforeAll(async () => {
        // Create test business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Notification Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `notification-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create resource with availability
        const resource = await createResource(prisma, businessId, {
            name: 'Test Professional',
            type: 'PERSON',
            status: 'ACTIVE'
        })

        // Set 24/7 availability
        await setAvailability(prisma, resource.id, [
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
            name: 'Test Service',
            durationMinutes: 30,
            slotIntervalMinutes: 30
        })

        // Link service to resource
        await setServiceResources(prisma, businessId, service.id, [resource.id])

        // Create customer
        const customer = await upsertCustomer(prisma, businessId, {
            fullName: 'Test Customer',
            email: 'test@example.com',
            phone: null
        })
        customerId = customer.id

        // Create test appointment
        const startAt = addMinutes(new Date(), 60 * 24) // Tomorrow
        const appointment = await createAppointment(prisma, {
            businessId,
            resourceId: resource.id,
            serviceId: service.id,
            customerId: customer.id,
            startAt,
            endAt: addMinutes(startAt, 30),
            occupiedEndAt: addMinutes(startAt, 30)
        })
        appointmentId = appointment.id
    })

    afterAll(async () => {
        // Cleanup: delete test data
        await prisma.notification.deleteMany({ where: { businessId } })
        await prisma.appointment.deleteMany({ where: { businessId } })
        await prisma.customer.deleteMany({ where: { businessId } })
        await prisma.serviceResource.deleteMany({ where: { businessId } })
        await prisma.availabilityRule.deleteMany({
            where: { resource: { businessId } }
        })
        await prisma.service.deleteMany({ where: { businessId } })
        await prisma.resource.deleteMany({ where: { businessId } })
        await prisma.businessMember.deleteMany({ where: { businessId } })
        await prisma.business.deleteMany({ where: { id: businessId } })
    })

    describe('createNotification', () => {
        it('should create a notification with PENDING status', async () => {
            const scheduledFor = new Date()

            const notification = await createNotification(prisma, {
                businessId,
                appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: 'test@example.com',
                scheduledFor
            })

            expect(notification.id).toBeDefined()
            expect(notification.businessId).toBe(businessId)
            expect(notification.appointmentId).toBe(appointmentId)
            expect(notification.channel).toBe('EMAIL')
            expect(notification.type).toBe('CONFIRMATION')
            expect(notification.to).toBe('test@example.com')
            expect(notification.status).toBe('PENDING')
            expect(notification.sentAt).toBeNull()
            expect(notification.error).toBeNull()
        })

        it('should enforce unique constraint on (appointmentId, type, scheduledFor)', async () => {
            const scheduledFor = new Date('2026-06-15T10:00:00.000Z')

            // Create first notification
            await createNotification(prisma, {
                businessId,
                appointmentId,
                channel: 'EMAIL',
                type: 'REMINDER',
                to: 'test@example.com',
                scheduledFor
            })

            // Attempt to create duplicate
            await expect(
                createNotification(prisma, {
                    businessId,
                    appointmentId,
                    channel: 'EMAIL',
                    type: 'REMINDER',
                    to: 'test@example.com',
                    scheduledFor
                })
            ).rejects.toThrow()
        })
    })

    describe('updateNotificationStatus', () => {
        it('should update notification to SENT with sentAt timestamp', async () => {
            const notification = await createNotification(prisma, {
                businessId,
                appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: 'update-test@example.com',
                scheduledFor: new Date('2026-07-01T10:00:00.000Z')
            })

            const sentAt = new Date()
            const updated = await updateNotificationStatus(prisma, notification.id, 'SENT', sentAt)

            expect(updated.status).toBe('SENT')
            expect(updated.sentAt).toEqual(sentAt)
            expect(updated.error).toBeNull()
        })

        it('should update notification to FAILED with error message', async () => {
            const notification = await createNotification(prisma, {
                businessId,
                appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: 'failed-test@example.com',
                scheduledFor: new Date('2026-07-02T10:00:00.000Z')
            })

            const errorMessage = 'Invalid API key'
            const updated = await updateNotificationStatus(prisma, notification.id, 'FAILED', undefined, errorMessage)

            expect(updated.status).toBe('FAILED')
            expect(updated.sentAt).toBeNull()
            expect(updated.error).toBe(errorMessage)
        })
    })

    describe('getNotificationById', () => {
        it('should return notification by ID', async () => {
            const notification = await createNotification(prisma, {
                businessId,
                appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: 'get-by-id@example.com',
                scheduledFor: new Date('2026-07-03T10:00:00.000Z')
            })

            const found = await getNotificationById(prisma, notification.id)

            expect(found).not.toBeNull()
            expect(found!.id).toBe(notification.id)
            expect(found!.to).toBe('get-by-id@example.com')
        })

        it('should return null for non-existent ID', async () => {
            const found = await getNotificationById(prisma, 'non-existent-id')
            expect(found).toBeNull()
        })
    })

    describe('getNotificationsByAppointmentId', () => {
        it('should return all notifications for an appointment', async () => {
            // Create a new appointment for this test
            const startAt = addMinutes(new Date(), 60 * 48) // Day after tomorrow
            const newAppointment = await createAppointment(prisma, {
                businessId,
                resourceId: (await prisma.resource.findFirst({ where: { businessId } }))!.id,
                serviceId: (await prisma.service.findFirst({ where: { businessId } }))!.id,
                customerId,
                startAt,
                endAt: addMinutes(startAt, 30),
                occupiedEndAt: addMinutes(startAt, 30)
            })

            // Create multiple notifications
            await createNotification(prisma, {
                businessId,
                appointmentId: newAppointment.id,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: 'multi-test@example.com',
                scheduledFor: new Date('2026-07-04T10:00:00.000Z')
            })

            await createNotification(prisma, {
                businessId,
                appointmentId: newAppointment.id,
                channel: 'EMAIL',
                type: 'REMINDER',
                to: 'multi-test@example.com',
                scheduledFor: new Date('2026-07-04T08:00:00.000Z')
            })

            const notifications = await getNotificationsByAppointmentId(prisma, businessId, newAppointment.id)

            expect(notifications.length).toBe(2)
            expect(notifications.some(n => n.type === 'CONFIRMATION')).toBe(true)
            expect(notifications.some(n => n.type === 'REMINDER')).toBe(true)
        })
    })

    describe('notificationExists', () => {
        it('should return true if notification exists', async () => {
            const scheduledFor = new Date('2026-07-05T10:00:00.000Z')

            await createNotification(prisma, {
                businessId,
                appointmentId,
                channel: 'EMAIL',
                type: 'CANCELLATION',
                to: 'exists-test@example.com',
                scheduledFor
            })

            const exists = await notificationExists(prisma, appointmentId, 'CANCELLATION', scheduledFor)
            expect(exists).toBe(true)
        })

        it('should return false if notification does not exist', async () => {
            const exists = await notificationExists(
                prisma,
                appointmentId,
                'RESCHEDULED',
                new Date('2026-12-31T23:59:59.000Z')
            )
            expect(exists).toBe(false)
        })
    })
})
