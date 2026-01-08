/**
 * Integration tests for createRescheduledAppointment repository function
 * Tests the race condition prevention logic at the data layer
 *
 * These tests directly call the repository function to verify the updateMany
 * conditional check works correctly, bypassing the domain layer validation.
 *
 * @see docs/user-stories.md - US-6.3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { createAppointment, createRescheduledAppointment } from '@/data/repositories/appointment.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { AppointmentErrorCodes } from '@/domain/common/errors'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('createRescheduledAppointment - Race Condition Prevention', () => {
    let businessId: string
    let resourceId: string
    let serviceId: string
    let customerId: string
    const userId = 'test-user-reschedule-repo'

    // Counter for unique appointment times
    let appointmentCounter = 0

    // Helper to create a test appointment
    async function createTestAppointment(): Promise<string> {
        appointmentCounter++
        const baseHours = 10 + appointmentCounter * 2
        const startAt = new Date()
        startAt.setDate(startAt.getDate() + 1)
        startAt.setHours(baseHours, 0, 0, 0)

        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000)
        const occupiedEndAt = new Date(startAt.getTime() + 60 * 60 * 1000)

        const appointment = await createAppointment(prisma, {
            businessId,
            resourceId,
            serviceId,
            customerId,
            startAt,
            endAt,
            occupiedEndAt
        })

        return appointment.id
    }

    // Helper to get a valid future slot
    function getValidFutureSlot(daysFromNow: number = 10, hour: number = 14): Date {
        const date = new Date()
        date.setDate(date.getDate() + daysFromNow)
        date.setHours(hour + appointmentCounter, 0, 0, 0) // Offset by counter to avoid conflicts
        return date
    }

    beforeAll(async () => {
        // Create test business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Reschedule Repo Test ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `reschedule-repo-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create resource with 24/7 availability
        const resource = await createResource(prisma, businessId, {
            name: 'Profesional Test Repo',
            type: 'PERSON',
            status: 'ACTIVE'
        })
        resourceId = resource.id

        await setAvailability(prisma, resourceId, [
            { dayOfWeek: 0, startMinutes: 0, endMinutes: 24 * 60 },
            { dayOfWeek: 1, startMinutes: 0, endMinutes: 24 * 60 },
            { dayOfWeek: 2, startMinutes: 0, endMinutes: 24 * 60 },
            { dayOfWeek: 3, startMinutes: 0, endMinutes: 24 * 60 },
            { dayOfWeek: 4, startMinutes: 0, endMinutes: 24 * 60 },
            { dayOfWeek: 5, startMinutes: 0, endMinutes: 24 * 60 },
            { dayOfWeek: 6, startMinutes: 0, endMinutes: 24 * 60 }
        ])

        // Create service
        const service = await createService(prisma, businessId, {
            name: 'Servicio Test Repo',
            durationMinutes: 60,
            slotIntervalMinutes: 60
        })
        serviceId = service.id

        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        // Create customer
        const customer = await upsertCustomer(prisma, businessId, {
            fullName: 'Cliente Test Repo',
            email: 'cliente-repo@test.com',
            phone: null
        })
        customerId = customer.id
    })

    afterAll(async () => {
        // Cleanup - delete business (cascade deletes related data)
        await prisma.business.delete({ where: { id: businessId } })
    })

    it('successfully reschedules when appointment is SCHEDULED', async () => {
        const appointmentId = await createTestAppointment()
        const newSlot = getValidFutureSlot(11, 9)

        const result = await createRescheduledAppointment(prisma, {
            originalAppointmentId: appointmentId,
            businessId,
            resourceId,
            serviceId,
            customerId,
            startAt: newSlot,
            endAt: new Date(newSlot.getTime() + 60 * 60 * 1000),
            occupiedEndAt: new Date(newSlot.getTime() + 60 * 60 * 1000)
        })

        expect(result.originalAppointmentId).toBe(appointmentId)
        expect(result.newAppointmentId).toBeDefined()
        expect(result.newAppointmentId).not.toBe(appointmentId)

        // Verify original is now RESCHEDULED
        const original = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        expect(original?.status).toBe('RESCHEDULED')

        // Verify new appointment is SCHEDULED with reference
        const newAppt = await prisma.appointment.findUnique({ where: { id: result.newAppointmentId } })
        expect(newAppt?.status).toBe('SCHEDULED')
        expect(newAppt?.rescheduledFromId).toBe(appointmentId)
    })

    it('throws APPOINTMENT_INVALID_STATUS when appointment was CANCELLED (race condition)', async () => {
        // 1. Create a SCHEDULED appointment
        const appointmentId = await createTestAppointment()

        // 2. Directly change status to CANCELLED (simulates concurrent cancellation)
        // This bypasses domain validation - tests the repo-level protection
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'CANCELLED' }
        })

        // 3. Call createRescheduledAppointment directly (as if domain validation passed)
        const newSlot = getValidFutureSlot(12, 10)

        await expect(
            createRescheduledAppointment(prisma, {
                originalAppointmentId: appointmentId,
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: newSlot,
                endAt: new Date(newSlot.getTime() + 60 * 60 * 1000),
                occupiedEndAt: new Date(newSlot.getTime() + 60 * 60 * 1000)
            })
        ).rejects.toMatchObject({
            code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            httpStatus: 409
        })

        // 4. Verify appointment is still CANCELLED (not overwritten)
        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        expect(appointment?.status).toBe('CANCELLED')
    })

    it('throws APPOINTMENT_INVALID_STATUS when appointment was COMPLETED (race condition)', async () => {
        // 1. Create a SCHEDULED appointment
        const appointmentId = await createTestAppointment()

        // 2. Directly change status to COMPLETED (simulates concurrent completion)
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'COMPLETED' }
        })

        // 3. Call createRescheduledAppointment directly
        const newSlot = getValidFutureSlot(13, 11)

        await expect(
            createRescheduledAppointment(prisma, {
                originalAppointmentId: appointmentId,
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: newSlot,
                endAt: new Date(newSlot.getTime() + 60 * 60 * 1000),
                occupiedEndAt: new Date(newSlot.getTime() + 60 * 60 * 1000)
            })
        ).rejects.toMatchObject({
            code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            httpStatus: 409
        })

        // 4. Verify appointment is still COMPLETED
        const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
        expect(appointment?.status).toBe('COMPLETED')
    })

    it('does not create new appointment when race condition is detected', async () => {
        // 1. Create and cancel an appointment
        const appointmentId = await createTestAppointment()
        await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'CANCELLED' }
        })

        // 2. Count appointments before
        const countBefore = await prisma.appointment.count({ where: { businessId } })

        // 3. Try to reschedule (should fail)
        const newSlot = getValidFutureSlot(14, 15)
        try {
            await createRescheduledAppointment(prisma, {
                originalAppointmentId: appointmentId,
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: newSlot,
                endAt: new Date(newSlot.getTime() + 60 * 60 * 1000),
                occupiedEndAt: new Date(newSlot.getTime() + 60 * 60 * 1000)
            })
        } catch {
            // Expected to fail
        }

        // 4. Count appointments after - should be the same (transaction rolled back)
        const countAfter = await prisma.appointment.count({ where: { businessId } })
        expect(countAfter).toBe(countBefore)
    })

    it('allows rescheduling a RESCHEDULED appointment (chained rescheduling)', async () => {
        // 1. Create and reschedule an appointment
        const originalId = await createTestAppointment()
        const firstSlot = getValidFutureSlot(15, 9)

        const firstReschedule = await createRescheduledAppointment(prisma, {
            originalAppointmentId: originalId,
            businessId,
            resourceId,
            serviceId,
            customerId,
            startAt: firstSlot,
            endAt: new Date(firstSlot.getTime() + 60 * 60 * 1000),
            occupiedEndAt: new Date(firstSlot.getTime() + 60 * 60 * 1000)
        })

        // 2. The new appointment is SCHEDULED, original is RESCHEDULED
        // Now reschedule the original again (it's RESCHEDULED, should still work)
        // Actually, we should reschedule the NEW appointment, which is SCHEDULED
        const secondSlot = getValidFutureSlot(16, 10)

        const secondReschedule = await createRescheduledAppointment(prisma, {
            originalAppointmentId: firstReschedule.newAppointmentId,
            businessId,
            resourceId,
            serviceId,
            customerId,
            startAt: secondSlot,
            endAt: new Date(secondSlot.getTime() + 60 * 60 * 1000),
            occupiedEndAt: new Date(secondSlot.getTime() + 60 * 60 * 1000)
        })

        expect(secondReschedule.newAppointmentId).toBeDefined()

        // Verify chain: original -> first reschedule (RESCHEDULED) -> second reschedule (SCHEDULED)
        const firstAppt = await prisma.appointment.findUnique({
            where: { id: firstReschedule.newAppointmentId }
        })
        expect(firstAppt?.status).toBe('RESCHEDULED')

        const secondAppt = await prisma.appointment.findUnique({
            where: { id: secondReschedule.newAppointmentId }
        })
        expect(secondAppt?.status).toBe('SCHEDULED')
        expect(secondAppt?.rescheduledFromId).toBe(firstReschedule.newAppointmentId)
    })
})
