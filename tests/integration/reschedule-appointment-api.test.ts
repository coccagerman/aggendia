/**
 * Integration tests for Reschedule Appointment API
 * Tests PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule
 *
 * @see docs/user-stories.md - US-6.3
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { BusinessRole } from '@prisma/client'

// Mock auth modules BEFORE importing the route handler
vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

// Import route handler AFTER mocks are set up
import { PATCH } from '@/app/api/v1/businesses/[businessId]/appointments/[appointmentId]/reschedule/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'

// Import other dependencies
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { createAppointment } from '@/data/repositories/appointment.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { createBlock } from '@/data/repositories/block.repo'

const TIMEZONE = 'America/Argentina/Buenos_Aires'
const TEST_EMAIL = 'test@example.com'

describe('Reschedule Appointment API - Integration Tests', () => {
    let businessId: string
    let resourceId: string
    let serviceId: string
    let customerId: string
    const userId = 'test-user-reschedule-appointment-api'

    // Counter for unique appointment times
    let appointmentCounter = 0

    // Helper to create a new appointment for testing with unique time slot
    async function createTestAppointment(
        status: 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED' = 'SCHEDULED',
        daysFromNow: number = 1
    ): Promise<{ id: string; startAt: Date }> {
        appointmentCounter++
        // Use counter to generate unique time slots: each appointment starts 2 hours after the previous
        const baseHours = 10 + appointmentCounter * 2 // Start at 10:00 + offset
        const startAt = new Date()
        startAt.setDate(startAt.getDate() + daysFromNow)
        startAt.setHours(baseHours, 0, 0, 0)

        const endAt = new Date(startAt.getTime() + 60 * 60 * 1000) // +1 hour
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

        if (status !== 'SCHEDULED') {
            await prisma.appointment.update({
                where: { id: appointment.id },
                data: { status }
            })
        }

        return { id: appointment.id, startAt }
    }

    // Helper to generate a valid future slot time
    function getValidFutureSlot(daysFromNow: number = 2, hour: number = 14): string {
        const date = new Date()
        date.setDate(date.getDate() + daysFromNow)
        date.setHours(hour, 0, 0, 0)
        return date.toISOString()
    }

    // Helper to set up successful auth mocks
    function mockAuthSuccess() {
        vi.mocked(requireAuth).mockResolvedValue({ userId, email: TEST_EMAIL })
        vi.mocked(requireBusinessAccess).mockResolvedValue({
            role: 'OWNER' as BusinessRole,
            businessId
        })
    }

    beforeAll(async () => {
        // Create test business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Reschedule Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `reschedule-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create resource with 24/7 availability
        const resource = await createResource(prisma, businessId, {
            name: 'Profesional Test',
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
            name: 'Servicio Test',
            durationMinutes: 60,
            slotIntervalMinutes: 60
        })
        serviceId = service.id

        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        // Create customer
        const customer = await upsertCustomer(prisma, businessId, {
            fullName: 'Cliente Test',
            email: 'cliente-reschedule@test.com',
            phone: null
        })
        customerId = customer.id
    })

    afterAll(async () => {
        // Cleanup - delete business (cascade deletes related data)
        await prisma.business.delete({ where: { id: businessId } })
    })

    beforeEach(() => {
        // Reset mocks before each test
        vi.mocked(requireAuth).mockReset()
        vi.mocked(requireBusinessAccess).mockReset()
    })

    describe('Authentication and Authorization', () => {
        it('returns 401 when user is not authenticated', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')

            vi.mocked(requireAuth).mockRejectedValue({
                httpStatus: 401,
                toJSON: () => ({ error: { code: 'AUTH_UNAUTHORIZED', message: 'No autenticado' } })
            })

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: getValidFutureSlot() })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.error.code).toBe('AUTH_UNAUTHORIZED')
        })

        it('returns 403 when user does not have access to business', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')

            vi.mocked(requireAuth).mockResolvedValue({ userId, email: TEST_EMAIL })
            vi.mocked(requireBusinessAccess).mockRejectedValue({
                httpStatus: 403,
                toJSON: () => ({ error: { code: 'AUTH_FORBIDDEN', message: 'Sin acceso al negocio' } })
            })

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: getValidFutureSlot() })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.error.code).toBe('AUTH_FORBIDDEN')
        })
    })

    describe('Successful Rescheduling', () => {
        it('reschedules a SCHEDULED appointment and returns success', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')
            const newStartAt = getValidFutureSlot(3, 15) // 3 days from now at 15:00
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.originalAppointmentId).toBe(appointmentId)
            expect(data.data.newAppointmentId).toBeDefined()
            expect(data.data.newAppointmentId).not.toBe(appointmentId)

            // Verify original appointment is now RESCHEDULED
            const originalAppointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
            expect(originalAppointment?.status).toBe('RESCHEDULED')

            // Verify new appointment exists with SCHEDULED status
            const newAppointment = await prisma.appointment.findUnique({
                where: { id: data.data.newAppointmentId }
            })
            expect(newAppointment?.status).toBe('SCHEDULED')
            expect(newAppointment?.rescheduledFromId).toBe(appointmentId)
        })

        it('reschedules a RESCHEDULED appointment (chained rescheduling)', async () => {
            const { id: appointmentId } = await createTestAppointment('RESCHEDULED')
            const newStartAt = getValidFutureSlot(4, 11) // 4 days from now at 11:00
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.newAppointmentId).toBeDefined()
        })

        it('frees original slot after rescheduling (slot can be booked)', async () => {
            // Create appointment
            const { id: appointmentId, startAt: originalStartAt } = await createTestAppointment('SCHEDULED', 5)
            const newStartAt = getValidFutureSlot(6, 16) // Move to different time
            mockAuthSuccess()

            // Reschedule it
            const rescheduleRequest = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt })
                }
            )

            const rescheduleResponse = await PATCH(rescheduleRequest, {
                params: Promise.resolve({ businessId, appointmentId })
            })
            expect(rescheduleResponse.status).toBe(200)

            // Verify original slot is now free (no SCHEDULED appointment at that time)
            const overlappingAppointments = await prisma.appointment.findMany({
                where: {
                    resourceId,
                    status: 'SCHEDULED',
                    startAt: { lt: new Date(originalStartAt.getTime() + 60 * 60 * 1000) },
                    occupiedEndAt: { gt: originalStartAt }
                }
            })

            // The original slot should have no SCHEDULED appointments blocking it
            const originalSlotOccupied = overlappingAppointments.some(
                a => a.startAt.getTime() === originalStartAt.getTime()
            )
            expect(originalSlotOccupied).toBe(false)
        })
    })

    describe('Validation Errors', () => {
        it('returns 404 when appointment does not exist', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000'
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${nonExistentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: getValidFutureSlot() })
                }
            )

            const response = await PATCH(request, {
                params: Promise.resolve({ businessId, appointmentId: nonExistentId })
            })
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('APPOINTMENT_NOT_FOUND')
        })

        it('returns 400 when trying to reschedule CANCELLED appointment', async () => {
            const { id: appointmentId } = await createTestAppointment('CANCELLED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: getValidFutureSlot() })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
        })

        it('returns 400 when trying to reschedule COMPLETED appointment', async () => {
            const { id: appointmentId } = await createTestAppointment('COMPLETED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: getValidFutureSlot() })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
        })

        it('returns 400 when newStartAt is in the past', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')
            const pastDate = new Date()
            pastDate.setHours(pastDate.getHours() - 2)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: pastDate.toISOString() })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY')
        })

        it('returns 400 when newStartAt is missing', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when newStartAt is invalid format', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: 'not-a-date' })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })

            expect(response.status).toBe(400)
        })
    })

    describe('Block Validation', () => {
        it('returns 409 when new slot overlaps with a resource block', async () => {
            const { id: appointmentId } = await createTestAppointment('SCHEDULED')

            // Create a block at the target time
            const targetTime = new Date()
            targetTime.setDate(targetTime.getDate() + 7)
            targetTime.setHours(10, 0, 0, 0)

            await createBlock(prisma, {
                resourceId,
                startAt: targetTime,
                endAt: new Date(targetTime.getTime() + 2 * 60 * 60 * 1000), // 2 hour block
                reason: 'Vacaciones'
            })

            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: targetTime.toISOString() })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY')
        })
    })

    describe('Double Booking Prevention', () => {
        it('returns 409 when new slot is already taken', async () => {
            // Create first appointment at a specific time
            const targetTime = new Date()
            targetTime.setDate(targetTime.getDate() + 8)
            targetTime.setHours(14, 0, 0, 0)

            const firstAppointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: targetTime,
                endAt: new Date(targetTime.getTime() + 60 * 60 * 1000),
                occupiedEndAt: new Date(targetTime.getTime() + 60 * 60 * 1000)
            })

            // Create second appointment to reschedule
            const { id: appointmentToReschedule } = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            // Try to reschedule to the same slot
            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentToReschedule}/reschedule`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newStartAt: targetTime.toISOString() })
                }
            )

            const response = await PATCH(request, {
                params: Promise.resolve({ businessId, appointmentId: appointmentToReschedule })
            })
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('APPOINTMENT_SLOT_TAKEN')

            // Cleanup
            await prisma.appointment.delete({ where: { id: firstAppointment.id } })
        })
    })

    // Note: Race condition prevention at the repository level is tested in
    // tests/integration/reschedule-appointment-repo.test.ts
    // Those tests call createRescheduledAppointment directly to bypass domain validation
    // and exercise the updateMany conditional check.
})
