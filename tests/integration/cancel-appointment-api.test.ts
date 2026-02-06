/**
 * Integration tests for Cancel Appointment API
 * Tests PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/cancel
 *
 * @see docs/user-stories.md - US-6.2
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

// Mock notification service to verify calls without sending real emails
vi.mock('@/domain/notifications/notification.service', () => ({
    sendCancellationEmail: vi.fn().mockResolvedValue({ success: true, notificationId: 'mock-email-id' }),
    sendCancellationWhatsApp: vi.fn().mockResolvedValue({ success: true, notificationId: 'mock-whatsapp-id' })
}))

// Import route handler AFTER mocks are set up
import { PATCH } from '@/app/api/v1/businesses/[businessId]/appointments/[appointmentId]/cancel/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { sendCancellationEmail, sendCancellationWhatsApp } from '@/domain/notifications/notification.service'

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

describe('Cancel Appointment API - Integration Tests', () => {
    let businessId: string
    let otherBusinessId: string
    let resourceId: string
    let serviceId: string
    let customerId: string
    const userId = 'test-user-cancel-appointment-api'
    const otherUserId = 'test-user-other-business'

    // Counter for unique appointment times
    let appointmentCounter = 0

    // Helper to create a new appointment for testing with unique time slot
    async function createTestAppointment(
        status: 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED' = 'SCHEDULED'
    ): Promise<string> {
        appointmentCounter++
        // Use counter to generate unique time slots: each appointment starts 2 hours after the previous
        const hoursOffset = 24 + appointmentCounter * 2 // Start tomorrow + offset
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
                name: `Cancel Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `cancel-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create another business for cross-tenant tests
        const otherBiz = await createBusinessWithOwner(
            prisma,
            {
                name: `Other Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Recurso'
            },
            `other-biz-${Date.now()}`,
            otherUserId
        )
        otherBusinessId = otherBiz.business.id

        // Create resource with availability (all week)
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
            email: 'cliente@test.com',
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
        vi.mocked(sendCancellationEmail)
            .mockReset()
            .mockResolvedValue({ success: true, notificationId: 'mock-email-id' })
        vi.mocked(sendCancellationWhatsApp)
            .mockReset()
            .mockResolvedValue({ success: true, notificationId: 'mock-whatsapp-id' })
    })

    describe('Authentication and Authorization', () => {
        it('returns 401 when user is not authenticated', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')

            vi.mocked(requireAuth).mockRejectedValue({
                httpStatus: 401,
                toJSON: () => ({ error: { code: 'AUTH_UNAUTHORIZED', message: 'No autenticado' } })
            })

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(401)
            expect(data.error.code).toBe('AUTH_UNAUTHORIZED')
        })

        it('returns 403 when user does not have access to business', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')

            vi.mocked(requireAuth).mockResolvedValue({ userId, email: TEST_EMAIL })
            vi.mocked(requireBusinessAccess).mockRejectedValue({
                httpStatus: 403,
                toJSON: () => ({ error: { code: 'AUTH_FORBIDDEN', message: 'Sin acceso al negocio' } })
            })

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(403)
            expect(data.error.code).toBe('AUTH_FORBIDDEN')
        })
    })

    describe('Successful Cancellation', () => {
        it('cancels a SCHEDULED appointment and returns success', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cancellationReason: 'Cliente canceló por WhatsApp' })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.appointmentId).toBe(appointmentId)
            expect(data.data.status).toBe('CANCELLED')
            expect(data.data.cancellationReason).toBe('Cliente canceló por WhatsApp')

            // Verify DB state
            const dbAppointment = await prisma.appointment.findUnique({ where: { id: appointmentId } })
            expect(dbAppointment?.status).toBe('CANCELLED')
            expect(dbAppointment?.cancellationReason).toBe('Cliente canceló por WhatsApp')
        })

        it('cancels a RESCHEDULED appointment', async () => {
            const appointmentId = await createTestAppointment('RESCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('CANCELLED')
        })

        it('cancels without cancellation reason', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('CANCELLED')
            expect(data.data.cancellationReason).toBeNull()
        })

        it('strips HTML tags from cancellation reason', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cancellationReason: '<script>alert("xss")</script>Cliente canceló' })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.cancellationReason).toBe('alert("xss")Cliente canceló')
        })
    })

    describe('Idempotency', () => {
        it('returns success when cancelling an already cancelled appointment', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')

            // First, cancel the appointment directly in DB
            await prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: 'CANCELLED', cancellationReason: 'Primera cancelación' }
            })

            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cancellationReason: 'Segunda cancelación (ignorada)' })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.status).toBe('CANCELLED')
            // Original reason is preserved (idempotent)
            expect(data.data.cancellationReason).toBe('Primera cancelación')
        })
    })

    describe('Error Cases', () => {
        it('returns 404 when appointment does not exist', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000'
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${nonExistentId}/cancel`,
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
            const appointmentId = await createTestAppointment('SCHEDULED')
            // Mock auth for otherBusinessId
            mockAuthSuccess(otherBusinessId, otherUserId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${otherBusinessId}/appointments/${appointmentId}/cancel`,
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

        it('returns 400 when trying to cancel a COMPLETED appointment', async () => {
            const appointmentId = await createTestAppointment('COMPLETED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_INVALID_STATUS')
        })

        it('returns 400 when cancellation reason exceeds 500 characters', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const longReason = 'x'.repeat(501)
            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cancellationReason: longReason })
                }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })
    })

    describe('Notifications', () => {
        it('calls sendCancellationEmail after successful cancellation', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            expect(response.status).toBe(200)

            // Wait for fire-and-forget promises to settle
            await new Promise(resolve => setTimeout(resolve, 50))

            expect(sendCancellationEmail).toHaveBeenCalledTimes(1)
            expect(sendCancellationEmail).toHaveBeenCalledWith(
                expect.anything(), // prisma client
                expect.objectContaining({
                    appointmentId,
                    business: expect.objectContaining({ id: businessId }),
                    customer: expect.objectContaining({ fullName: 'Cliente Test' })
                })
            )
        })

        it('calls sendCancellationWhatsApp after successful cancellation', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')
            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            expect(response.status).toBe(200)

            // Wait for fire-and-forget promises to settle
            await new Promise(resolve => setTimeout(resolve, 50))

            expect(sendCancellationWhatsApp).toHaveBeenCalledTimes(1)
            expect(sendCancellationWhatsApp).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    appointmentId,
                    business: expect.objectContaining({ id: businessId })
                })
            )
        })

        it('does NOT send notifications for idempotent cancellation (already cancelled)', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')

            // Cancel directly in DB
            await prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: 'CANCELLED', cancellationReason: 'Ya cancelado' }
            })

            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            const response = await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })
            expect(response.status).toBe(200)

            await new Promise(resolve => setTimeout(resolve, 50))

            // Should NOT send notifications when already cancelled (idempotent)
            expect(sendCancellationEmail).not.toHaveBeenCalled()
            expect(sendCancellationWhatsApp).not.toHaveBeenCalled()
        })
    })

    describe('Slot Availability After Cancellation', () => {
        it('slot becomes available after cancellation', async () => {
            const appointmentId = await createTestAppointment('SCHEDULED')

            // Get original appointment details
            const originalAppointment = await prisma.appointment.findUnique({
                where: { id: appointmentId }
            })

            mockAuthSuccess()

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`,
                { method: 'PATCH' }
            )

            await PATCH(request, { params: Promise.resolve({ businessId, appointmentId }) })

            // Check that no active appointments exist in that slot
            const overlappingAppointments = await prisma.appointment.findMany({
                where: {
                    resourceId,
                    status: { in: ['SCHEDULED', 'RESCHEDULED'] },
                    startAt: { lt: originalAppointment!.occupiedEndAt },
                    occupiedEndAt: { gt: originalAppointment!.startAt }
                }
            })

            expect(overlappingAppointments.length).toBe(0)
        })
    })
})
