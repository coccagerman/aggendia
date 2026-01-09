/**
 * Integration tests for Complete Appointment API
 * Tests PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/complete
 *
 * @see docs/user-stories.md - US-6.4 Marcar completado
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
import { PATCH } from '@/app/api/v1/businesses/[businessId]/appointments/[appointmentId]/complete/route'
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

const TIMEZONE = 'America/Argentina/Buenos_Aires'
const TEST_EMAIL = 'test@example.com'

describe('Complete Appointment API - Integration Tests', () => {
    let businessId: string
    let otherBusinessId: string
    let resourceId: string
    let serviceId: string
    let customerId: string
    const userId = 'test-user-complete-appointment-api'
    const otherUserId = 'test-user-other-business-complete'

    // Counter for unique appointment times
    let appointmentCounter = 0

    /**
     * Helper to create a new appointment for testing with unique time slot
     * @param status - Desired appointment status
     * @param isPast - If true, creates appointment in the past; if false, in the future
     */
    async function createTestAppointment(
        status: 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED' = 'SCHEDULED',
        isPast: boolean = true
    ): Promise<string> {
        appointmentCounter++
        // Use counter to generate unique time slots
        const hoursOffset = isPast ? -(24 + appointmentCounter * 2) : 24 + appointmentCounter * 2
        const startAt = new Date(Date.now() + hoursOffset * 60 * 60 * 1000)
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

        return appointment.id
    }

    // Helper to set up successful auth mocks
    function mockAuthSuccess(targetBusinessId: string = businessId, targetUserId: string = userId) {
        vi.mocked(requireAuth).mockResolvedValue({ userId: targetUserId, email: TEST_EMAIL })
        vi.mocked(requireBusinessAccess).mockResolvedValue({
            role: 'OWNER' as BusinessRole,
            businessId: targetBusinessId
        })
    }

    beforeAll(async () => {
        // Create main test business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Complete Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `complete-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create another business for cross-tenant tests
        const otherBiz = await createBusinessWithOwner(
            prisma,
            {
                name: `Other Business Complete ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Recurso'
            },
            `other-biz-complete-${Date.now()}`,
            otherUserId
        )
        otherBusinessId = otherBiz.business.id

        // Create resource with availability (all week)
        const resource = await createResource(prisma, businessId, {
            name: 'Profesional Test Complete',
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
            name: 'Servicio Test Complete',
            durationMinutes: 60,
            slotIntervalMinutes: 60
        })
        serviceId = service.id

        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        // Create customer
        const customer = await upsertCustomer(prisma, businessId, {
            fullName: 'Cliente Test Complete',
            email: 'cliente-complete@test.com',
            phone: null
        })
        customerId = customer.id
    })

    afterAll(async () => {
        // Cleanup - delete businesses (cascade deletes related data)
        await prisma.business.delete({ where: { id: businessId } })
        await prisma.business.delete({ where: { id: otherBusinessId } })
    })

    beforeEach(() => {
        // Reset mocks before each test
        vi.mocked(requireAuth).mockReset()
        vi.mocked(requireBusinessAccess).mockReset()
    })

    describe('Authentication and Authorization', () => {
        it('returns 401 when user is not authenticated', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)

            vi.mocked(requireAuth).mockRejectedValue({
                httpStatus: 401,
                toJSON: () => ({ error: { code: 'AUTH_UNAUTHORIZED', message: 'No autenticado' } })
            })

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.error.code).toBe('AUTH_UNAUTHORIZED')
        })

        it('returns 403 when user does not have access to business', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)

            vi.mocked(requireAuth).mockResolvedValue({ userId, email: TEST_EMAIL })
            vi.mocked(requireBusinessAccess).mockRejectedValue({
                httpStatus: 403,
                toJSON: () => ({ error: { code: 'AUTH_FORBIDDEN', message: 'Sin acceso al negocio' } })
            })

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.error.code).toBe('AUTH_FORBIDDEN')
        })
    })

    describe('Successful Completion', () => {
        it('marks a past SCHEDULED appointment as completed', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true) // past appointment
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.appointmentId).toBe(appointmentId)
            expect(data.data.status).toBe('COMPLETED')

            // Verify DB state
            const dbAppointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
            expect(dbAppointment?.status).toBe('COMPLETED')
        })

        it('marks a past RESCHEDULED appointment as completed', async () => {
            const appointmentId = await createTestAppointment('RESCHEDULED', true) // past appointment
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('COMPLETED')
        })
    })

    describe('Idempotency', () => {
        it('returns success when completing an already completed appointment', async () => {
            const appointmentId = await createTestAppointment('COMPLETED', true)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('COMPLETED')
        })
    })

    describe('Error Cases - Invalid Status', () => {
        it('returns 400 when trying to complete a CANCELLED appointment', async () => {
            const appointmentId = await createTestAppointment('CANCELLED', true)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
            expect(data.error.message).toContain('CANCELLED')
        })
    })

    describe('Error Cases - Not Finished Appointments', () => {
        it('returns 400 when trying to complete a future SCHEDULED appointment', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', false) // future appointment
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
            expect(data.error.message).toContain('aún no ha finalizado')
        })

        it('returns 400 when trying to complete a future RESCHEDULED appointment', async () => {
            const appointmentId = await createTestAppointment('RESCHEDULED', false) // future appointment
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
            expect(data.error.message).toContain('aún no ha finalizado')
        })

        it('returns 400 when trying to complete an in-progress appointment', async () => {
            // Create appointment that started 30 min ago but ends 30 min from now
            appointmentCounter++
            const now = Date.now()
            const startAt = new Date(now - 30 * 60 * 1000) // 30 min ago
            const endAt = new Date(now + 30 * 60 * 1000) // 30 min from now
            const occupiedEndAt = new Date(now + 30 * 60 * 1000) // 30 min from now

            const inProgressAppointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt,
                endAt,
                occupiedEndAt
            })

            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${inProgressAppointment.id}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, {
                params: Promise.resolve({ businessId, appointmentId: inProgressAppointment.id })
            })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
            expect(data.error.message).toContain('aún no ha finalizado')
        })
    })

    describe('Error Cases - Not Found', () => {
        it('returns 404 when appointment does not exist', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000'
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${nonExistentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, {
                params: Promise.resolve({ businessId, appointmentId: nonExistentId })
            })
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('APPOINTMENT_NOT_FOUND')
        })

        it('returns 404 when appointment belongs to different business (security)', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)
            // Mock auth for otherBusinessId
            mockAuthSuccess(otherBusinessId, otherUserId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${otherBusinessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, {
                params: Promise.resolve({ businessId: otherBusinessId, appointmentId })
            })
            const data = await response.json()

            // Returns 404 (not 403) to avoid revealing appointment existence
            expect(response.status).toBe(404)
            expect(data.error.code).toBe('APPOINTMENT_NOT_FOUND')
        })
    })

    describe('Slot Availability - No Impact', () => {
        it('completing an appointment does NOT free the slot (it is already in the past)', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)

            // Get original appointment details
            const originalAppointment = await prisma.appointment.findUnique({
                where: { id: appointmentId }
            })

            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                { method: 'PATCH' }
            )

            await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })

            // Verify the appointment still exists with same time fields (not deleted/freed)
            const updatedAppointment = await prisma.appointment.findUnique({
                where: { id: appointmentId }
            })

            expect(updatedAppointment).not.toBeNull()
            expect(updatedAppointment?.status).toBe('COMPLETED')
            expect(updatedAppointment?.startAt.getTime()).toBe(originalAppointment!.startAt.getTime())
            expect(updatedAppointment?.endAt.getTime()).toBe(originalAppointment!.endAt.getTime())
            expect(updatedAppointment?.occupiedEndAt.getTime()).toBe(originalAppointment!.occupiedEndAt.getTime())
        })
    })

    describe('Request Body Validation', () => {
        it('returns 400 when body contains malformed JSON', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                {
                    method: 'PATCH',
                    body: '{ invalid json }',
                    headers: { 'Content-Type': 'application/json' }
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
            expect(data.error.message).toContain('JSON inválido')
        })

        it('returns 400 when body contains unexpected fields', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ unexpectedField: 'value' }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
            expect(data.error.message).toContain('vacío')
        })

        it('succeeds when body is empty string', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                {
                    method: 'PATCH',
                    body: '',
                    headers: { 'Content-Type': 'application/json' }
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('COMPLETED')
        })

        it('succeeds when body is empty object {}', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED', true)
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({}),
                    headers: { 'Content-Type': 'application/json' }
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('COMPLETED')
        })
    })
})
