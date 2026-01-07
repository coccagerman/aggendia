/**
 * Integration tests for Public Appointments API
 * Tests POST /api/v1/public/appointments
 *
 * @see docs/user-stories.md - US-5.4
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { addDays, addHours, startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { POST } from '@/app/api/v1/public/appointments/route'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('Public Appointments API - Integration Tests', () => {
    let businessId: string
    let businessSlug: string
    let resourceId: string
    let serviceId: string
    let inactiveServiceId: string
    let inactiveResourceId: string
    let unmappedResourceId: string
    const userId = 'test-user-public-appointments-api'

    // Helper to get a future Monday at 10:00 in business timezone
    const getNextMondaySlot = () => {
        const now = new Date()
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7 // Next Monday
        const monday = addDays(startOfDay(now), daysUntilMonday)
        // 10:00 in business timezone
        return fromZonedTime(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0), TIMEZONE)
    }

    beforeAll(async () => {
        // Create business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Appointments Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Cancha'
            },
            `appts-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id
        businessSlug = biz.business.slug

        // Create active resource with availability
        const resource = await createResource(prisma, businessId, {
            name: 'Cancha Principal',
            type: 'ASSET',
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

        // Create active service
        const service = await createService(prisma, businessId, {
            name: 'Fútbol 5',
            durationMinutes: 60,
            bufferMinutes: 15
        })
        serviceId = service.id

        // Map service to resource
        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        // Create inactive service
        const inactiveService = await createService(prisma, businessId, {
            name: 'Servicio Inactivo',
            durationMinutes: 30,
            bufferMinutes: 0
        })
        inactiveServiceId = inactiveService.id
        await prisma.service.update({
            where: { id: inactiveServiceId },
            data: { status: 'INACTIVE' }
        })

        // Create inactive resource
        const inactiveResource = await createResource(prisma, businessId, {
            name: 'Cancha Inactiva',
            type: 'ASSET',
            status: 'INACTIVE'
        })
        inactiveResourceId = inactiveResource.id

        // Create unmapped resource (active but not linked to service)
        const unmappedResource = await createResource(prisma, businessId, {
            name: 'Cancha Sin Servicio',
            type: 'ASSET',
            status: 'ACTIVE'
        })
        unmappedResourceId = unmappedResource.id
    })

    afterAll(async () => {
        // Cleanup
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('POST /api/v1/public/appointments - Validation', () => {
        it('returns 400 when fullName is missing', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: '', // empty
                        email: 'test@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when neither email nor phone is provided', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez'
                        // no email or phone
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when startAt is invalid', async () => {
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: 'not-a-date',
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })
    })

    describe('POST /api/v1/public/appointments - Business Rules', () => {
        it('returns 404 when business slug does not exist', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: 'non-existent-slug',
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('BUSINESS_NOT_FOUND')
        })

        it('returns 404 when service does not exist', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId: '00000000-0000-0000-0000-000000000000',
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('returns 404 when service is INACTIVE', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId: inactiveServiceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('returns 404 when resource does not exist', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId: '00000000-0000-0000-0000-000000000000',
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('RESOURCE_NOT_FOUND')
        })

        it('returns 409 when resource is INACTIVE', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId: inactiveResourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('RESOURCE_INACTIVE')
        })

        it('returns 409 when service-resource mapping does not exist', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId: unmappedResourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('SERVICE_RESOURCE_NOT_LINKED')
        })
    })

    describe('POST /api/v1/public/appointments - Success', () => {
        it('creates appointment with email', async () => {
            const startAt = getNextMondaySlot()
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Juan Pérez',
                        email: 'juan@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.data).toMatchObject({
                status: 'SCHEDULED',
                service: { id: serviceId },
                resource: { id: resourceId },
                customer: { fullName: 'Juan Pérez' }
            })
            expect(data.data.appointmentId).toBeDefined()
            expect(data.data.startAt).toBe(startAt.toISOString())
        })

        it('creates appointment with phone', async () => {
            // Use different time to avoid conflict
            const startAt = addHours(getNextMondaySlot(), 2)
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'María García',
                        phone: '+5491112345678'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.data.customer.fullName).toBe('María García')
        })

        it('creates appointment with both email and phone', async () => {
            const startAt = addHours(getNextMondaySlot(), 4)
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Pedro López',
                        email: 'pedro@example.com',
                        phone: '+5491198765432'
                    },
                    notes: 'Llego 5 minutos tarde'
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            expect(data.data.customer.fullName).toBe('Pedro López')
        })
    })

    describe('POST /api/v1/public/appointments - Double Booking', () => {
        it('returns 409 when slot is already taken', async () => {
            // Use a specific time for this test
            const startAt = addHours(getNextMondaySlot(), 6)

            // First booking should succeed
            const request1 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Cliente 1',
                        email: 'cliente1@example.com'
                    }
                })
            })

            const response1 = await POST(request1)
            expect(response1.status).toBe(201)

            // Second booking for same slot should fail
            const request2 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Cliente 2',
                        email: 'cliente2@example.com'
                    }
                })
            })

            const response2 = await POST(request2)
            const data2 = await response2.json()

            expect(response2.status).toBe(409)
            expect(data2.error.code).toBe('APPOINTMENT_SLOT_TAKEN')
        })

        it('returns 409 when slot overlaps with existing appointment', async () => {
            // Use a different week (2 weeks from now) to avoid conflicts with other tests
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday + 14) // 2 weeks ahead
            // 10:00 in business timezone
            const startAt1 = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0),
                TIMEZONE
            )
            const request1 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt1.toISOString(),
                    customer: {
                        fullName: 'Cliente Overlap 1',
                        email: 'overlap1@example.com'
                    }
                })
            })

            const response1 = await POST(request1)
            expect(response1.status).toBe(201)

            // Try to book at 10:30 - should overlap (first one occupies 10:00-11:15)
            const startAt2 = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 30),
                TIMEZONE
            )

            const request2 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt2.toISOString(),
                    customer: {
                        fullName: 'Cliente Overlap 2',
                        email: 'overlap2@example.com'
                    }
                })
            })

            const response2 = await POST(request2)
            const data2 = await response2.json()

            expect(response2.status).toBe(409)
            expect(data2.error.code).toBe('APPOINTMENT_SLOT_TAKEN')
        })
    })

    describe('POST /api/v1/public/appointments - Customer Upsert', () => {
        it('does not duplicate customer with same email', async () => {
            const email = `upsert-test-${Date.now()}@example.com`
            // Use unique week offset to avoid conflicts
            const now = new Date()
            const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilNextMonday + 7) // Use NEXT week's Monday
            const startAt1 = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0),
                TIMEZONE
            )
            const startAt2 = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12, 0),
                TIMEZONE
            )

            // First booking
            const request1 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt1.toISOString(),
                    customer: {
                        fullName: 'Test Customer',
                        email
                    }
                })
            })

            await POST(request1)

            // Second booking with same email but different name
            const request2 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt2.toISOString(),
                    customer: {
                        fullName: 'Test Customer Updated',
                        email
                    }
                })
            })

            await POST(request2)

            // Check that only one customer exists with this email (normalized to lowercase)
            const normalizedEmail = email.toLowerCase()
            const customers = await prisma.customer.findMany({
                where: {
                    businessId,
                    email: normalizedEmail
                }
            })

            expect(customers.length).toBe(1)
            expect(customers[0].fullName).toBe('Test Customer Updated')
        })

        it('normalizes email to lowercase for deduplication', async () => {
            const baseEmail = `normalize-test-${Date.now()}`
            // Use unique week offset to avoid conflicts
            const now = new Date()
            const daysUntilNextMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilNextMonday + 7) // Use NEXT week's Monday
            const startAt1 = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 14, 0),
                TIMEZONE
            )
            const startAt2 = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 16, 0),
                TIMEZONE
            )

            // First booking with UPPERCASE email
            const request1 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt1.toISOString(),
                    customer: {
                        fullName: 'Original Name',
                        email: `${baseEmail.toUpperCase()}@EXAMPLE.COM`
                    }
                })
            })

            await POST(request1)

            // Second booking with lowercase email (same customer)
            const request2 = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt2.toISOString(),
                    customer: {
                        fullName: 'Updated Name',
                        email: `${baseEmail.toLowerCase()}@example.com`
                    }
                })
            })

            await POST(request2)

            // Should find only ONE customer with normalized email
            const customers = await prisma.customer.findMany({
                where: {
                    businessId,
                    email: `${baseEmail.toLowerCase()}@example.com`
                }
            })

            expect(customers.length).toBe(1)
            expect(customers[0].fullName).toBe('Updated Name')
        })
    })

    describe('POST /api/v1/public/appointments - Availability Validation', () => {
        it('returns 409 when booking is outside availability hours', async () => {
            // Try to book at 08:00 (availability starts at 09:00)
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday)
            // 08:00 in business timezone - BEFORE availability
            const startAt = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 8, 0),
                TIMEZONE
            )

            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Early Bird',
                        email: 'early@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY')
        })

        it('returns 409 when booking is after availability hours', async () => {
            // Try to book at 18:30 (availability ends at 18:00)
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday)
            // 18:30 in business timezone - AFTER availability (service is 60min)
            const startAt = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 18, 30),
                TIMEZONE
            )

            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Late Night',
                        email: 'late@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY')
        })

        it('returns 409 when booking on day with no availability', async () => {
            // Try to book on Sunday (no availability defined)
            const now = new Date()
            const daysUntilSunday = (7 - now.getDay()) % 7 || 7
            const sunday = addDays(startOfDay(now), daysUntilSunday)
            const startAt = fromZonedTime(
                new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 10, 0),
                TIMEZONE
            )

            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Sunday Booker',
                        email: 'sunday@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(409)
            expect(data.error.code).toBe('APPOINTMENT_OUTSIDE_AVAILABILITY')
        })
    })

    describe('POST /api/v1/public/appointments - XSS Sanitization', () => {
        it('strips HTML tags from fullName', async () => {
            // Use 3 weeks ahead to avoid conflicts with other tests
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday + 21) // 3 weeks ahead
            const startAt = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0),
                TIMEZONE
            )
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: '<script>alert("xss")</script>Juan Pérez',
                        email: 'xss-test@example.com'
                    }
                })
            })

            const response = await POST(request)
            const data = await response.json()

            expect(response.status).toBe(201)
            // HTML tags should be stripped
            expect(data.data.customer.fullName).toBe('alert("xss")Juan Pérez')
        })

        it('strips HTML tags from notes', async () => {
            // Use 3 weeks ahead at 12:00 to avoid conflicts
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday + 21) // 3 weeks ahead
            const startAt = fromZonedTime(
                new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12, 0),
                TIMEZONE
            )
            const request = new NextRequest('http://localhost/api/v1/public/appointments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slug: businessSlug,
                    serviceId,
                    resourceId,
                    startAt: startAt.toISOString(),
                    customer: {
                        fullName: 'Normal Name',
                        email: 'xss-notes@example.com'
                    },
                    notes: '<img src=x onerror=alert(1)>Notas normales'
                })
            })

            const response = await POST(request)

            expect(response.status).toBe(201)

            // Verify notes were sanitized in DB
            const data = await response.json()
            const appointment = await prisma.appointment.findUnique({
                where: { id: data.data.appointmentId }
            })
            expect(appointment?.notes).toBe('Notas normales')
        })
    })

    describe('POST /api/v1/public/appointments - Rate Limiting', () => {
        const originalEnv = process.env.DISABLE_RATE_LIMIT

        beforeAll(() => {
            // Enable rate limiting for this test group
            process.env.DISABLE_RATE_LIMIT = 'false'
        })

        afterAll(() => {
            // Restore original value
            process.env.DISABLE_RATE_LIMIT = originalEnv
        })

        it('returns 429 after exceeding rate limit', async () => {
            // The rate limit is 10 requests per 5 minutes per IP
            // We'll use a unique IP header for this test to isolate it
            const testIp = `rate-limit-test-${Date.now()}`
            const now = new Date()
            const daysUntilMonday = (8 - now.getDay()) % 7 || 7
            const monday = addDays(startOfDay(now), daysUntilMonday + 28) // 4 weeks ahead

            const makeRequest = (hour: number) => {
                const startAt = fromZonedTime(
                    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), hour, 0),
                    TIMEZONE
                )
                return new NextRequest('http://localhost/api/v1/public/appointments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-forwarded-for': testIp
                    },
                    body: JSON.stringify({
                        slug: businessSlug,
                        serviceId,
                        resourceId,
                        startAt: startAt.toISOString(),
                        customer: {
                            fullName: 'Rate Limit Test',
                            email: `rate-limit-${hour}@example.com`
                        }
                    })
                })
            }

            // Make 10 requests sequentially (the limit) - these should succeed
            // Use different hours to avoid slot conflicts (9, 10, 11, ..., 17)
            // Note: service has 60min duration + 15min buffer = 75min total
            // Availability is 09:00-18:00, so we can fit 9 appointments max at hours 9-17
            const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17]
            for (const hour of hours) {
                const response = await POST(makeRequest(hour))
                // Should succeed (201) or maybe 409 if slot taken by other test
                // Key is we're using a unique IP so rate limit is isolated
                if (response.status !== 201) {
                    // Skip this test if slots conflict (not what we're testing)
                    console.log(`Hour ${hour} status: ${response.status}`)
                }
            }

            // The 10th request should still be under the limit
            // The 11th request should trigger rate limiting
            const request10 = makeRequest(9) // Same hour doesn't matter - rate limit first
            const response10 = await POST(request10)

            // 10th request may succeed or fail for slot reasons, but not rate limited yet
            if (response10.status === 429) {
                // We hit rate limit early - this is fine, limit was reached
                const data = await response10.json()
                expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
                return
            }

            // 11th request should definitely be rate limited
            const request11 = makeRequest(9)
            const response11 = await POST(request11)

            expect(response11.status).toBe(429)

            const data = await response11.json()
            expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED')
            expect(data.error.message).toContain('Demasiados intentos')
        })
    })
})
