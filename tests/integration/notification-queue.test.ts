/**
 * Integration tests for notification queue repository
 * Ensures pending notifications are filtered by scheduledFor
 *
 * @see docs/user-stories.md - US-10.4
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { addMinutes, addHours } from 'date-fns'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { createAppointment } from '@/data/repositories/appointment.repo'
import { createNotification, getPendingNotifications } from '@/data/repositories/notification.repo'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('Notification Queue Repository', () => {
    let businessId: string
    let resourceId: string
    let serviceId: string
    let customerId: string
    let appointmentId: string
    const userId = `test-user-notif-queue-${Date.now()}`

    beforeAll(async () => {
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Notification Queue Test ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `notification-queue-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        const resource = await createResource(prisma, businessId, {
            name: 'Notification Queue Resource',
            type: 'PERSON',
            status: 'ACTIVE'
        })
        resourceId = resource.id

        const service = await createService(prisma, businessId, {
            name: 'Notification Queue Service',
            durationMinutes: 30,
            slotIntervalMinutes: 30
        })
        serviceId = service.id

        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        const customer = await upsertCustomer(prisma, businessId, {
            fullName: 'Notification Queue Customer',
            email: 'queue-test@example.com',
            phone: null
        })
        customerId = customer.id

        const startAt = addHours(new Date(), 2)
        const endAt = addMinutes(startAt, 30)

        const appointment = await createAppointment(prisma, {
            businessId,
            resourceId,
            serviceId,
            customerId,
            startAt,
            endAt,
            occupiedEndAt: endAt
        })
        appointmentId = appointment.id
    })

    afterAll(async () => {
        await prisma.notification.deleteMany({ where: { businessId } })
        await prisma.appointment.deleteMany({ where: { businessId } })
        await prisma.customer.deleteMany({ where: { businessId } })
        await prisma.serviceResource.deleteMany({ where: { businessId } })
        await prisma.service.deleteMany({ where: { businessId } })
        await prisma.resource.deleteMany({ where: { businessId } })
        await prisma.businessMember.deleteMany({ where: { businessId } })
        await prisma.business.deleteMany({ where: { id: businessId } })
    })

    it('should return only notifications scheduled up to now', async () => {
        const now = new Date()
        const scheduledPast = addMinutes(now, -10)
        const scheduledFuture = addMinutes(now, 10)

        const pastNotification = await createNotification(prisma, {
            businessId,
            appointmentId,
            channel: 'EMAIL',
            type: 'CONFIRMATION',
            to: 'queue-test@example.com',
            scheduledFor: scheduledPast,
            recipient: 'CUSTOMER'
        })

        const futureNotification = await createNotification(prisma, {
            businessId,
            appointmentId,
            channel: 'WHATSAPP',
            type: 'CONFIRMATION',
            to: '+5491112345678',
            scheduledFor: scheduledFuture,
            recipient: 'CUSTOMER'
        })

        const pending = await getPendingNotifications(prisma, 100, now)
        const pendingIds = pending.map(item => item.id)

        expect(pendingIds).toContain(pastNotification.id)
        expect(pendingIds).not.toContain(futureNotification.id)
    })
})
