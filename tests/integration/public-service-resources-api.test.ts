/**
 * Integration tests for Public Service Resources API
 * Tests GET /api/v1/public/businesses/:slug/services/:serviceId/resources
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService, updateService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'
import { GET } from '@/app/api/v1/public/businesses/[slug]/services/[serviceId]/resources/route'

describe('Public Service Resources API - Integration Tests', () => {
    let businessId: string
    let businessSlug: string
    let activeResourceId: string
    let inactiveResourceId: string
    let serviceWithResourcesId: string
    let serviceWithoutResourcesId: string
    let inactiveServiceId: string
    const userId = 'test-user-public-resources-api'

    beforeAll(async () => {
        // Crear negocio con un resourceLabel custom
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Public Test Business ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires',
                resourceLabel: 'Profesional'
            },
            `pub-test-${Date.now()}`,
            userId
        )
        businessId = biz.business.id
        businessSlug = biz.business.slug

        // Crear recursos: uno activo, uno inactivo
        const activeResource = await createResource(prisma, businessId, {
            name: 'Juan Pérez',
            type: 'PERSON',
            status: 'ACTIVE'
        })
        activeResourceId = activeResource.id

        const inactiveResource = await createResource(prisma, businessId, {
            name: 'María García',
            type: 'PERSON',
            status: 'INACTIVE'
        })
        inactiveResourceId = inactiveResource.id

        // Crear servicios (por default se crean ACTIVE)
        const serviceWithResources = await createService(prisma, businessId, {
            name: 'Corte de Pelo',
            durationMinutes: 30
        })
        serviceWithResourcesId = serviceWithResources.id

        const serviceWithoutResources = await createService(prisma, businessId, {
            name: 'Manicura',
            durationMinutes: 45
        })
        serviceWithoutResourcesId = serviceWithoutResources.id

        // Crear servicio y luego desactivarlo
        const inactiveService = await createService(prisma, businessId, {
            name: 'Servicio Inactivo',
            durationMinutes: 60
        })
        await updateService(prisma, businessId, inactiveService.id, { status: 'INACTIVE' })
        inactiveServiceId = inactiveService.id

        // Asignar ambos recursos al servicio con recursos (uno activo, uno inactivo)
        await setServiceResources(prisma, businessId, serviceWithResourcesId, [activeResourceId, inactiveResourceId])
    })

    afterAll(async () => {
        // Cleanup
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('GET /api/v1/public/businesses/:slug/services/:serviceId/resources', () => {
        it('devuelve solo recursos ACTIVE asignados al servicio', async () => {
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/${serviceWithResourcesId}/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: serviceWithResourcesId }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.service.id).toBe(serviceWithResourcesId)
            expect(data.data.service.name).toBe('Corte de Pelo')
            expect(data.data.resources).toHaveLength(1) // Solo el activo
            expect(data.data.resources[0].id).toBe(activeResourceId)
            expect(data.data.resources[0].name).toBe('Juan Pérez')
            expect(data.data.resources[0].type).toBe('PERSON')
            expect(data.meta.resourceLabel).toBe('Profesional')
            expect(data.meta.count).toBe(1)
        })

        it('devuelve array vacío cuando el servicio no tiene recursos asignados', async () => {
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/${serviceWithoutResourcesId}/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: serviceWithoutResourcesId }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data.data.resources).toHaveLength(0)
            expect(data.meta.count).toBe(0)
        })

        it('devuelve 404 para slug inexistente', async () => {
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/slug-inexistente/services/${serviceWithResourcesId}/resources`
            )
            const context = {
                params: Promise.resolve({ slug: 'slug-inexistente', serviceId: serviceWithResourcesId })
            }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('BUSINESS_NOT_FOUND')
        })

        it('devuelve 404 para serviceId inexistente', async () => {
            const fakeServiceId = '00000000-0000-0000-0000-000000000000'
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/${fakeServiceId}/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: fakeServiceId }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('devuelve 404 para serviceId con formato inválido (no UUID)', async () => {
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/not-a-uuid/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: 'not-a-uuid' }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('devuelve 404 para servicio INACTIVE (no lo expone)', async () => {
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/${inactiveServiceId}/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: inactiveServiceId }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')
        })

        it('devuelve 404 para servicio de otro negocio', async () => {
            // Crear otro negocio con un servicio
            const otherBiz = await createBusinessWithOwner(
                prisma,
                {
                    name: `Other Business ${Date.now()}`,
                    timezone: 'UTC'
                },
                `other-${Date.now()}`,
                'other-user'
            )
            const otherService = await createService(prisma, otherBiz.business.id, {
                name: 'Servicio de otro negocio',
                durationMinutes: 30
            })

            // Intentar acceder al servicio del otro negocio usando nuestro slug
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/${otherService.id}/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: otherService.id }) }

            const response = await GET(request, context)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data.error.code).toBe('SERVICE_NOT_FOUND')

            // Cleanup
            await prisma.business.delete({ where: { id: otherBiz.business.id } })
        })

        it('incluye header Cache-Control en la respuesta', async () => {
            const request = new NextRequest(
                `http://localhost/api/v1/public/businesses/${businessSlug}/services/${serviceWithResourcesId}/resources`
            )
            const context = { params: Promise.resolve({ slug: businessSlug, serviceId: serviceWithResourcesId }) }

            const response = await GET(request, context)

            expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
        })
    })
})
