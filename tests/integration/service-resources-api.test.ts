/**
 * Integration Tests - Service Resources API
 *
 * Tests de integración para los endpoints de asociación Service ↔ Resource.
 * Los tests HTTP de endpoints están cubiertos por tests E2E con Playwright.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    setServiceResources,
    getResourceIdsByServiceId,
    addResourceToService
} from '@/data/repositories/serviceResource.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createService } from '@/data/repositories/service.repo'
import { createResource } from '@/data/repositories/resource.repo'

describe('Service Resources API Integration', () => {
    let businessId: string
    let serviceId: string
    let resource1Id: string
    let resource2Id: string
    let resource3Id: string

    beforeAll(async () => {
        // Setup: crear negocio, servicio y recursos
        const { business } = await createBusinessWithOwner(
            prisma,
            {
                name: `API Test Business ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `api-test-biz-${Date.now()}`,
            `api-test-user-${Date.now()}`
        )
        businessId = business.id

        const service = await createService(prisma, businessId, {
            name: 'API Test Service',
            durationMinutes: 30
        })
        serviceId = service.id

        const r1 = await createResource(prisma, businessId, { name: 'API Resource 1' })
        resource1Id = r1.id

        const r2 = await createResource(prisma, businessId, { name: 'API Resource 2' })
        resource2Id = r2.id

        const r3 = await createResource(prisma, businessId, {
            name: 'API Resource 3 Inactive',
            status: 'INACTIVE'
        })
        resource3Id = r3.id
    })

    describe('PUT /api/v1/businesses/:businessId/services/:serviceId/resources', () => {
        it('should replace all service resources via repo', async () => {
            // Simular la operación que haría el endpoint PUT
            await setServiceResources(prisma, businessId, serviceId, [resource1Id, resource2Id])

            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId)
            expect(resourceIds).toHaveLength(2)
            expect(resourceIds).toContain(resource1Id)
            expect(resourceIds).toContain(resource2Id)
        })

        it('should clear all resources when empty array', async () => {
            await setServiceResources(prisma, businessId, serviceId, [])

            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId)
            expect(resourceIds).toHaveLength(0)
        })

        it('should allow inactive resources to be linked', async () => {
            // Los recursos inactivos también pueden asociarse
            await setServiceResources(prisma, businessId, serviceId, [resource3Id])

            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId)
            expect(resourceIds).toHaveLength(1)
            expect(resourceIds).toContain(resource3Id)
        })
    })

    describe('POST /api/v1/businesses/:businessId/services/:serviceId/resources', () => {
        it('should add single resource via repo', async () => {
            // Limpiar primero
            await setServiceResources(prisma, businessId, serviceId, [])

            // Agregar un recurso
            const link = await addResourceToService(prisma, businessId, serviceId, resource1Id)

            expect(link.serviceId).toBe(serviceId)
            expect(link.resourceId).toBe(resource1Id)
        })
    })

    describe('Validation', () => {
        it('should reject invalid resource IDs', async () => {
            await expect(setServiceResources(prisma, businessId, serviceId, ['invalid-uuid'])).rejects.toThrow()
        })

        it('should reject non-existent resource IDs', async () => {
            await expect(
                setServiceResources(prisma, businessId, serviceId, ['00000000-0000-0000-0000-000000000000'])
            ).rejects.toThrow('Recursos no válidos')
        })
    })
})
