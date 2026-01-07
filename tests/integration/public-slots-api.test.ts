/**
 * Integration tests for Public Slots API
 * Tests GET /api/v1/public/slots
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { setAvailability } from '@/data/repositories/availability.repo'
import { createBlock } from '@/data/repositories/block.repo'
import { addDays, startOfDay } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { GET } from '@/app/api/v1/public/slots/route'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

describe('Public Slots API - Integration Tests', () => {
    let businessId: string
    let businessSlug: string
    let resourceId: string
    let serviceId: string
    let serviceId2: string
    let unmappedResourceId: string
    const userId = 'test-user-public-slots-api'

    beforeAll(async () => {
        // Create business
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Slots Test Business ${Date.now()}`,
                timezone: TIMEZONE,
                resourceLabel: 'Cancha'
            },
            `slots-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id
        businessSlug = biz.business.slug

        // Create resource with availability
        const resource = await createResource(prisma, businessId, {
            name: 'Cancha 1',
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

        // Create service
        const service = await createService(prisma, businessId, {
            name: 'Fútbol 5',
            durationMinutes: 60,
            bufferMinutes: 0
        })
        serviceId = service.id

        // Map service to resource
        await setServiceResources(prisma, businessId, serviceId, [resourceId])

        // Create service with buffer
        const service2 = await createService(prisma, businessId, {
            name: 'Fútbol 7',
            durationMinutes: 60,
            bufferMinutes: 15
        })
        serviceId2 = service2.id

        // Map service2 to resource
        await setServiceResources(prisma, businessId, serviceId2, [resourceId])

        // Create unmapped resource
        const unmappedResource = await createResource(prisma, businessId, {
            name: 'Cancha 2',
            type: 'ASSET',
            status: 'ACTIVE'
        })
        unmappedResourceId = unmappedResource.id
    })

    afterAll(async () => {
        // Cleanup
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('GET /api/v1/public/slots', () => {
        it('returns 400 when slug is missing', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when serviceId is not a valid UUID', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', 'invalid-uuid')
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error.code).toBe('VALIDATION_ERROR')
        })

        it('returns 400 when fromDate >= toDate', async () => {
            const fromDate = addDays(startOfDay(new Date()), 1).toISOString()
            const toDate = startOfDay(new Date()).toISOString() // toDate < fromDate

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error.code).toBe('VALIDATION_ERROR')
            expect(data.error.message).toContain('fromDate debe ser menor que toDate')
        })

        it('returns 400 when date range exceeds 30 days', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 31).toISOString() // 31 days

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(400)
            const data = await response.json()
            expect(data.error.code).toBe('VALIDATION_ERROR')
            expect(data.error.message).toContain('rango máximo')
        })

        it('returns 404 when business not found', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', 'non-existent-slug')
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(404)
            const data = await response.json()
            expect(data.error.code).toBe('BUSINESS_NOT_FOUND')
        })

        it('returns 404 when service not found', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()
            const fakeServiceId = '00000000-0000-0000-0000-000000000000'

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', fakeServiceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(404)
            const data = await response.json()
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('returns 404 when resource not found', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()
            const fakeResourceId = '00000000-0000-0000-0000-000000000000'

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', fakeResourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(404)
            const data = await response.json()
            expect(data.error.code).toBe('RESOURCE_NOT_FOUND')
        })

        it('returns 409 when service-resource mapping does not exist', async () => {
            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', unmappedResourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(409)
            const data = await response.json()
            expect(data.error.message).toContain('no ofrece el servicio')
        })

        it('returns slots for valid request (Monday availability)', async () => {
            // Find next Monday
            const today = new Date()
            let nextMonday = startOfDay(today)
            while (nextMonday.getDay() !== 1) {
                nextMonday = addDays(nextMonday, 1)
            }

            const fromDate = nextMonday.toISOString()
            const toDate = addDays(nextMonday, 1).toISOString()

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(200)
            const data = await response.json()

            expect(data.data).toBeDefined()
            expect(Array.isArray(data.data)).toBe(true)
            expect(data.data.length).toBeGreaterThan(0) // Should have slots on Monday

            // Validate slot structure
            const firstSlot = data.data[0]
            expect(firstSlot.startAt).toBeDefined()
            expect(firstSlot.endAt).toBeDefined()
            expect(firstSlot.displayTime).toBeDefined()

            // Validate ISO 8601 format
            expect(firstSlot.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

            // Validate displayTime format
            expect(firstSlot.displayTime).toMatch(/^\d{2}:\d{2}$/)
        })

        it('returns empty array for days without availability', async () => {
            // Find next Sunday (no availability) in the business timezone
            // We need to work in the business timezone to avoid UTC offset issues
            const today = new Date()
            let dayOffset = 0
            let testDate = new Date(today)

            // Find the next Sunday
            while (testDate.getDay() !== 0) {
                dayOffset++
                testDate = addDays(today, dayOffset)
            }

            // Create Sunday 00:00 and Sunday 23:59 in business timezone
            // This ensures we query ONLY Sunday in the business's local time
            const sundayStart = fromZonedTime(`${testDate.toISOString().split('T')[0]}T00:00:00`, TIMEZONE)
            const sundayEnd = fromZonedTime(`${testDate.toISOString().split('T')[0]}T23:59:59`, TIMEZONE)

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', sundayStart.toISOString())
            url.searchParams.set('toDate', sundayEnd.toISOString())

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(200)
            const data = await response.json()
            expect(data.data).toEqual([]) // No availability on Sunday
        })

        it('respects service buffer when calculating slots', async () => {
            // Find next Monday
            const today = new Date()
            let nextMonday = startOfDay(today)
            while (nextMonday.getDay() !== 1) {
                nextMonday = addDays(nextMonday, 1)
            }

            const fromDate = nextMonday.toISOString()
            const toDate = addDays(nextMonday, 1).toISOString()

            // Service 1: 60min duration, 0min buffer
            const url1 = new URL(`http://localhost/api/v1/public/slots`)
            url1.searchParams.set('slug', businessSlug)
            url1.searchParams.set('serviceId', serviceId)
            url1.searchParams.set('resourceId', resourceId)
            url1.searchParams.set('fromDate', fromDate)
            url1.searchParams.set('toDate', toDate)

            const request1 = new NextRequest(url1)
            const response1 = await GET(request1)
            const data1 = await response1.json()

            // Service 2: 60min duration, 15min buffer
            const url2 = new URL(`http://localhost/api/v1/public/slots`)
            url2.searchParams.set('slug', businessSlug)
            url2.searchParams.set('serviceId', serviceId2)
            url2.searchParams.set('resourceId', resourceId)
            url2.searchParams.set('fromDate', fromDate)
            url2.searchParams.set('toDate', toDate)

            const request2 = new NextRequest(url2)
            const response2 = await GET(request2)
            const data2 = await response2.json()

            // Service with buffer should have fewer slots
            expect(data2.data.length).toBeLessThan(data1.data.length)
        })

        it('respects blocks when calculating slots', async () => {
            // Find next Monday
            const today = new Date()
            let nextMonday = startOfDay(today)
            while (nextMonday.getDay() !== 1) {
                nextMonday = addDays(nextMonday, 1)
            }

            // Create block from 10:00-12:00 on that Monday
            const blockStart = fromZonedTime(`${nextMonday.toISOString().split('T')[0]}T10:00:00`, TIMEZONE)
            const blockEnd = fromZonedTime(`${nextMonday.toISOString().split('T')[0]}T12:00:00`, TIMEZONE)

            const block = await createBlock(prisma, {
                resourceId,
                startAt: blockStart,
                endAt: blockEnd,
                reason: 'Test block'
            })

            const fromDate = nextMonday.toISOString()
            const toDate = addDays(nextMonday, 1).toISOString()

            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', businessSlug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(200)
            const data = await response.json()

            // No slots should exist between 10:00-12:00
            const displayTimes = data.data.map((s: { displayTime: string }) => s.displayTime)
            expect(displayTimes.some((t: string) => t >= '10:00' && t < '12:00')).toBe(false)

            // Cleanup
            await prisma.resourceBlock.delete({ where: { id: block.id } })
        })

        it('enforces multi-tenant isolation', async () => {
            // Create another business
            const otherBiz = await createBusinessWithOwner(
                prisma,
                {
                    name: `Other Business ${Date.now()}`,
                    timezone: TIMEZONE,
                    resourceLabel: 'Sala'
                },
                `other-${Date.now()}`,
                'other-user'
            )

            const fromDate = startOfDay(new Date()).toISOString()
            const toDate = addDays(startOfDay(new Date()), 1).toISOString()

            // Try to query with businessSlug from otherBiz but serviceId/resourceId from original biz
            const url = new URL(`http://localhost/api/v1/public/slots`)
            url.searchParams.set('slug', otherBiz.business.slug)
            url.searchParams.set('serviceId', serviceId)
            url.searchParams.set('resourceId', resourceId)
            url.searchParams.set('fromDate', fromDate)
            url.searchParams.set('toDate', toDate)

            const request = new NextRequest(url)
            const response = await GET(request)

            expect(response.status).toBe(404) // Service not found for this business
            const data = await response.json()
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')

            // Cleanup
            await prisma.business.delete({ where: { id: otherBiz.business.id } })
        })
    })
})
