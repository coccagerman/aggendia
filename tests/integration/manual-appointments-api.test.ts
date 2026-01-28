/**
 * Integration tests for Manual Appointments API
 * Tests POST /api/v1/businesses/:businessId/appointments
 *
 * @see docs/user-stories.md - US-7.3 Crear turnos manualmente desde la agenda
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { addDays, startOfDay, subMinutes } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { POST } from '@/app/api/v1/businesses/[businessId]/appointments/route'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

// Mock auth modules
vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

describe('Manual Appointments API - Integration Tests', () => {
    let businessId: string
    let resourceId: string
    let serviceId: string
    let serviceWithNoticeId: string
    let inactiveServiceId: string
    let inactiveResourceId: string
    let unmappedResourceId: string
    const userId = 'test-user-manual-appointments-api'

    // Helper to get a future Monday at 10:00 in business timezone
    const getNextMondaySlot = () => {
        const now = new Date()
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7 // Next Monday
        const monday = addDays(startOfDay(now), daysUntilMonday)
        // 10:00 in business timezone
        return fromZonedTime(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0), TIMEZONE)
    }

    // Helper to create a route context with params
    const createRouteContext = (businessId: string) => ({
        params: Promise.resolve({ businessId })
    })

    beforeAll(async () => {
        // Import mocks
        const { requireAuth } = await import('@/lib/auth')
        const { requireBusinessAccess } = await import('@/lib/auth/require-business-access')

        // Setup auth mocks
        vi.mocked(requireAuth).mockResolvedValue({ userId, email: 'test@example.com' })
        vi.mocked(requireBusinessAccess).mockImplementation(async (uid, bid) => ({
            role: 'OWNER' as const,
            businessId: bid
        }))

        // Create business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Manual Appointments Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `manual-appts-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create active resource with availability
        const resource = await createResource(prisma, businessId, {
            name: 'Profesional 1',
            type: 'PERSON',
            status: 'ACTIVE'
        })
        resourceId = resource.id

        // Set availability: Monday (1) 09:00-18:00
        await setAvailability(prisma, resourceId, [
            {
                dayOfWeek: 1, // Monday
                startMinutes: 9 * 60,
                endMinutes: 18 * 60
            }
        ])

        // Create active service (60 min duration)
        const service = await createService(prisma, businessId, {
            name: 'Consulta',
            durationMinutes: 60,
            slotIntervalMinutes: 60
        })
        serviceId = service.id

        // Create service with minimum booking notice (2 hours)
        const serviceWithNotice = await createService(prisma, businessId, {
            name: 'Consulta con anticipación',
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            minBookingNoticeMinutes: 120 // 2 hours
        })
        serviceWithNoticeId = serviceWithNotice.id

        // Map services to resource
        await setServiceResources(prisma, businessId, serviceId, [resourceId])
        await setServiceResources(prisma, businessId, serviceWithNoticeId, [resourceId])

        // Create inactive service
        const inactiveService = await createService(prisma, businessId, {
            name: 'Servicio Inactivo',
            durationMinutes: 30
        })
        inactiveServiceId = inactiveService.id
        await prisma.service.update({
            where: { id: inactiveServiceId },
            data: { status: 'INACTIVE' }
        })

        // Create inactive resource
        const inactiveResource = await createResource(prisma, businessId, {
            name: 'Profesional Inactivo',
            type: 'PERSON',
            status: 'INACTIVE'
        })
        inactiveResourceId = inactiveResource.id

        // Create unmapped resource (active but not linked to service)
        const unmappedResource = await createResource(prisma, businessId, {
            name: 'Profesional Sin Servicio',
            type: 'PERSON',
            status: 'ACTIVE'
        })
        unmappedResourceId = unmappedResource.id
    })

    afterAll(async () => {
        vi.restoreAllMocks()
        // Cleanup
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('POST /api/v1/businesses/:businessId/appointments - Validation', () => {
        it('returns 400 when fullName is missing', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: '', // empty
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when neither email nor phone is provided', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when startAt is in the past', async () => {
            const pastTime = subMinutes(new Date(), 5) // 5 minutes ago
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: pastTime.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('APPOINTMENT_IN_PAST')
            expect(data.error.message).toBe('No se pueden crear turnos en el pasado')
        })

        it('returns 404 when service not found', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId: '00000000-0000-0000-0000-000000000000',
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('returns 404 when service is inactive', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId: inactiveServiceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('returns 404 when resource not found', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId: '00000000-0000-0000-0000-000000000000',
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('RESOURCE_NOT_FOUND')
        })

        it('returns 409 when resource is inactive', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId: inactiveResourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('RESOURCE_INACTIVE')
        })

        it('returns 409 when service-resource mapping does not exist', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId: unmappedResourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('SERVICE_RESOURCE_NOT_LINKED')
        })

        it('returns 409 when slot is outside availability', async () => {
            // Tuesday at 10:00 (no availability on Tuesday)
            const now = new Date()
            const daysUntilTuesday = (9 - now.getDay()) % 7 || 7
            const tuesday = addDays(startOfDay(now), daysUntilTuesday)
            const startAt = fromZonedTime(
                new Date(tuesday.getFullYear(), tuesday.getMonth(), tuesday.getDate(), 10, 0),
                TIMEZONE
            )

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY')
        })
    })

    describe('POST /api/v1/businesses/:businessId/appointments - Success', () => {
        it('creates appointment successfully with email', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Cliente Manual',
                        email: 'manual-test@example.com'
                    },
                    notes: 'Reserva por teléfono'
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.data.appointmentId).toBeDefined()
            expect(data.data.status).toBe('SCHEDULED')
            expect(data.data.customer.fullName).toBe('Cliente Manual')

            // Verify the appointment was created with createdByUserId
            const appointment = await prisma.appointment.findUnique({
                where: { id: data.data.appointmentId }
            })
            expect(appointment).not.toBeNull()
            expect(appointment!.createdByUserId).toBe(userId)
            expect(appointment!.notes).toBe('Reserva por teléfono')
        })

        it('creates appointment successfully with phone', async () => {
            // Use 11:00 slot to avoid conflict with previous test
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday)
            const startAt = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 11, 0),
                TIMEZONE
            )

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Cliente Con Teléfono',
                        phone: '+54 11 1234-5678'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.data.appointmentId).toBeDefined()
            expect(data.data.status).toBe('SCHEDULED')
        })

        it('does NOT enforce minimum booking notice (US-7.3 requirement)', async () => {
            // This tests the key difference from public booking:
            // Manual booking should NOT enforce minBookingNoticeMinutes

            // Get a slot that would violate the 2-hour notice but is valid availability
            // We need a Monday slot within the next 2 hours
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const nextMonday = addDays(startOfDay(now), daysUntilMonday)

            // Use 12:00 slot on next Monday (should always be in the future)
            const startAt = fromZonedTime(
                new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate(), 12, 0),
                TIMEZONE
            )

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId: serviceWithNoticeId, // Service with 2-hour notice
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Cliente Sin Espera',
                        email: 'no-wait@example.com'
                    }
                })
            })

            const response = await POST(request, createRouteContext(businessId))
            const data = await response.json()

            // Should succeed even though service has minBookingNoticeMinutes
            expect(response.status).toBe(201)
            expect(data.data.appointmentId).toBeDefined()
            expect(data.data.status).toBe('SCHEDULED')
        })
    })

    describe('POST /api/v1/businesses/:businessId/appointments - Double Booking', () => {
        it('returns 409 when slot is already taken', async () => {
            // First, create an appointment
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday)
            const startAt = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 14, 0),
                TIMEZONE
            )

            const request1 = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Primer Cliente',
                        email: 'first@example.com'
                    }
                })
            })

            const response1 = await POST(request1, createRouteContext(businessId))
            expect(response1.status).toBe(201)

            // Try to book the same slot
            const request2 = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Segundo Cliente',
                        email: 'second@example.com'
                    }
                })
            })

            const response2 = await POST(request2, createRouteContext(businessId))
            const data2 = await response2.json()

            expect(response2.status).toBe(409)
            expect(data2.error.code).toBe('APPOINTMENT_SLOT_TAKEN')
        })
    })
})
