/**
 * Integration tests for Private Slots API
 * Tests GET /api/v1/businesses/:businessId/slots
 *
 * Key difference from public slots: does NOT apply minimum booking notice
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
import { addDays, startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { GET } from '@/app/api/v1/businesses/[businessId]/slots/route'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

// Mock auth modules
vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

describe('Private Slots API - Integration Tests', () => {
    let businessId: string
    let resourceId: string
    let serviceId: string
    let serviceWithNoticeId: string
    const userId = 'test-user-private-slots-api'

    // Helper to create a route context with params
    const createRouteContext = (businessId: string) => ({
        params: Promise.resolve({ businessId })
    })

    // Helper to get next Monday in business timezone
    const getNextMonday = () => {
        const now = new Date()
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7
        return addDays(startOfDay(now), daysUntilMonday)
    }

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
                name: `Private Slots Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Profesional'
            },
            `private-slots-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Create active resource with availability
        const resource = await createResource(prisma, businessId, {
            name: 'Profesional Test',
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

        // Create active service (30 min duration, no notice)
        const service = await createService(prisma, businessId, {
            name: 'Servicio Normal',
            durationMinutes: 30,
            slotIntervalMinutes: 30
        })
        serviceId = service.id

        // Create service with 4-hour minimum booking notice
        const serviceWithNotice = await createService(prisma, businessId, {
            name: 'Servicio Con Anticipación',
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            minBookingNoticeMinutes: 240 // 4 hours
        })
        serviceWithNoticeId = serviceWithNotice.id

        // Map services to resource
        await setServiceResources(prisma, businessId, serviceId, [resourceId])
        await setServiceResources(prisma, businessId, serviceWithNoticeId, [resourceId])
    })

    afterAll(async () => {
        vi.restoreAllMocks()
        // Cleanup
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('GET /api/v1/businesses/:businessId/slots - Validation', () => {
        it('returns 400 when required params are missing', async () => {
            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots`)

            const response = await GET(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when fromDate >= toDate', async () => {
            const monday = getNextMonday()
            const fromDate = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12, 0),
                TIMEZONE
            )
            const toDate = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0),
                TIMEZONE
            )

            const params = new URLSearchParams({
                serviceId,
                resourceId,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            })

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots?${params}`)

            const response = await GET(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })
    })

    describe('GET /api/v1/businesses/:businessId/slots - Success', () => {
        it('returns available slots for valid request', async () => {
            const monday = getNextMonday()
            const fromDate = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0),
                TIMEZONE
            )
            const toDate = addDays(fromDate, 1)

            const params = new URLSearchParams({
                serviceId,
                resourceId,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            })

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots?${params}`)

            const response = await GET(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data).toBeInstanceOf(Array)
            // Should have slots for 9am-6pm with 30min intervals (excluding past slots)
            expect(data.data.length).toBeGreaterThan(0)

            // Check slot structure
            const firstSlot = data.data[0]
            expect(firstSlot).toHaveProperty('startAt')
            expect(firstSlot).toHaveProperty('endAt')
            expect(firstSlot).toHaveProperty('displayTime')
        })

        it('does NOT apply minimum booking notice (key difference from public)', async () => {
            // This test verifies that private slots endpoint ignores minBookingNoticeMinutes
            // Unlike public endpoint, admin should see all available slots

            const monday = getNextMonday()
            const fromDate = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0),
                TIMEZONE
            )
            const toDate = addDays(fromDate, 1)

            const params = new URLSearchParams({
                serviceId: serviceWithNoticeId, // Service with 4-hour notice
                resourceId,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            })

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots?${params}`)

            const response = await GET(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data).toBeInstanceOf(Array)
            // Should return all slots within availability, not filtered by notice
            expect(data.data.length).toBeGreaterThan(0)

            // Compare with normal service - should have same number of slots
            const params2 = new URLSearchParams({
                serviceId, // Service without notice
                resourceId,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            })

            const request2 = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots?${params2}`)

            const response2 = await GET(request2, createRouteContext(businessId))
            const data2 = await response2.json()

            // Both should have the same slots since notice is ignored
            expect(data.data.length).toBe(data2.data.length)
        })
    })

    describe('GET /api/v1/businesses/:businessId/slots - Edge Cases', () => {
        it('returns empty array when no availability on requested day', async () => {
            // Request slots for Tuesday (no availability)
            const now = new Date()
            const daysUntilTuesday = (9 - now.getDay()) % 7 || 7
            const tuesday = addDays(startOfDay(now), daysUntilTuesday)
            const fromDate = fromZonedTime(
                new Date(tuesday.getFullYear(), tuesday.getMonth(), tuesday.getDate(), 0, 0),
                TIMEZONE
            )
            const toDate = addDays(fromDate, 1)

            const params = new URLSearchParams({
                serviceId,
                resourceId,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            })

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots?${params}`)

            const response = await GET(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data).toEqual([])
        })

        it('returns 409 when service-resource mapping does not exist', async () => {
            // Create a resource without mapping
            const unmappedResource = await createResource(prisma, businessId, {
                name: 'Unmapped Resource',
                type: 'PERSON',
                status: 'ACTIVE'
            })

            const monday = getNextMonday()
            const fromDate = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0),
                TIMEZONE
            )
            const toDate = addDays(fromDate, 1)

            const params = new URLSearchParams({
                serviceId,
                resourceId: unmappedResource.id,
                fromDate: fromDate.toISOString(),
                toDate: toDate.toISOString()
            })

            const request = new NextRequest(`http://localhost/api/v1/businesses/${businessId}/slots?${params}`)

            const response = await GET(request, createRouteContext(businessId))
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('SERVICE_RESOURCE_NOT_LINKED')
        })
    })
})
