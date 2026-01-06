/**
 * Integration tests for Resource Services API endpoints
 * Tests GET and PUT /api/v1/businesses/:businessId/resources/:resourceId/services
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { GET, PUT } from '@/app/api/v1/businesses/[businessId]/resources/[resourceId]/services/route'

// Mock auth
vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn().mockResolvedValue({ userId: 'test-user-resource-services-api' })
}))

describe('Resource Services API - Integration Tests', () => {
    let businessId: string
    let resourceId: string
    let serviceId1: string
    let serviceId2: string
    const userId = 'test-user-resource-services-api'

    beforeAll(async () => {
        // Crear negocio con el usuario mockeado como owner
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business API ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-api-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Crear recurso de prueba
        const resource = await createResource(prisma, businessId, {
            name: 'Test Resource API'
        })
        resourceId = resource.id

        // Crear servicios de prueba
        const service1 = await createService(prisma, businessId, {
            name: 'Servicio API 1',
            durationMinutes: 30
        })
        serviceId1 = service1.id

        const service2 = await createService(prisma, businessId, {
            name: 'Servicio API 2',
            durationMinutes: 45
        })
        serviceId2 = service2.id
    })

    afterAll(async () => {
        // Cleanup
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('GET /api/v1/businesses/:businessId/resources/:resourceId/services', () => {
        it('devuelve array vacío cuando no hay servicios asignados', async () => {
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/' + resourceId + '/services'
            )
            const context = { params: Promise.resolve({ businessId, resourceId }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.serviceIds).toEqual([])
        })

        it('devuelve 404 si el recurso no existe', async () => {
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/non-existent/services'
            )
            const context = { params: Promise.resolve({ businessId, resourceId: 'non-existent' }) }

            const response = await GET(request, context)

            expect(response.status).toBe(404)
        })
    })

    describe('PUT /api/v1/businesses/:businessId/resources/:resourceId/services', () => {
        it('asigna servicios a un recurso', async () => {
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/' + resourceId + '/services',
                {
                    method: 'PUT',
                    body: JSON.stringify({ serviceIds: [serviceId1, serviceId2] }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId, resourceId }) }

            const response = await PUT(request, context)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.serviceIds).toHaveLength(2)
            expect(data.data.serviceIds).toContain(serviceId1)
            expect(data.data.serviceIds).toContain(serviceId2)
            expect(data.meta.count).toBe(2)
        })

        it('permite desasignar todos los servicios', async () => {
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/' + resourceId + '/services',
                {
                    method: 'PUT',
                    body: JSON.stringify({ serviceIds: [] }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId, resourceId }) }

            const response = await PUT(request, context)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.serviceIds).toEqual([])
            expect(data.meta.count).toBe(0)
        })

        it('devuelve 400 si el body es inválido', async () => {
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/' + resourceId + '/services',
                {
                    method: 'PUT',
                    body: JSON.stringify({ serviceIds: ['not-a-uuid'] }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId, resourceId }) }

            const response = await PUT(request, context)

            expect(response.status).toBe(400)
        })

        it('devuelve 400 si se intenta asignar servicios que no existen', async () => {
            const fakeServiceId = '00000000-0000-0000-0000-000000000000'
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/' + resourceId + '/services',
                {
                    method: 'PUT',
                    body: JSON.stringify({ serviceIds: [fakeServiceId] }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId, resourceId }) }

            const response = await PUT(request, context)

            expect(response.status).toBe(400)
        })

        it('devuelve 404 si el recurso no existe', async () => {
            const fakeResourceId = '00000000-0000-0000-0000-000000000000'
            const request = new NextRequest(
                'http://localhost/api/v1/businesses/' + businessId + '/resources/' + fakeResourceId + '/services',
                {
                    method: 'PUT',
                    body: JSON.stringify({ serviceIds: [serviceId1] }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId, resourceId: fakeResourceId }) }

            const response = await PUT(request, context)

            expect(response.status).toBe(404)
        })
    })
})
