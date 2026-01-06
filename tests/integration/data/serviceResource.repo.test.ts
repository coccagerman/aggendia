/**
 * Integration tests for serviceResource repository
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    getResourcesByServiceId,
    getLinkedResourceSummaries,
    getServiceIdsWithResources,
    countResourcesByServiceIds,
    addResourceToService,
    removeResourceFromService,
    setServiceResources,
    getResourceIdsByServiceId
} from '@/data/repositories/serviceResource.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createService } from '@/data/repositories/service.repo'
import { createResource } from '@/data/repositories/resource.repo'

describe('ServiceResource Repository - Integration Tests', () => {
    let businessId: string
    let serviceId1: string
    let serviceId2: string
    let resourceId1: string
    let resourceId2: string
    let resourceId3: string

    beforeAll(async () => {
        // Crear negocio de prueba
        const { business } = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business ServiceResource ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-sr-${Date.now()}`,
            `test-user-sr-${Date.now()}`
        )
        businessId = business.id

        // Crear servicios de prueba
        const service1 = await createService(prisma, businessId, {
            name: 'Servicio Test 1',
            durationMinutes: 30
        })
        serviceId1 = service1.id

        const service2 = await createService(prisma, businessId, {
            name: 'Servicio Test 2',
            durationMinutes: 45
        })
        serviceId2 = service2.id

        // Crear recursos de prueba
        const resource1 = await createResource(prisma, businessId, { name: 'Recurso Test 1' })
        resourceId1 = resource1.id

        const resource2 = await createResource(prisma, businessId, { name: 'Recurso Test 2' })
        resourceId2 = resource2.id

        const resource3 = await createResource(prisma, businessId, {
            name: 'Recurso Test 3',
            status: 'INACTIVE'
        })
        resourceId3 = resource3.id
    })

    describe('addResourceToService', () => {
        it('asocia un recurso a un servicio', async () => {
            const link = await addResourceToService(prisma, businessId, serviceId1, resourceId1)

            expect(link.businessId).toBe(businessId)
            expect(link.serviceId).toBe(serviceId1)
            expect(link.resourceId).toBe(resourceId1)
            expect(link.id).toBeDefined()
            expect(link.createdAt).toBeDefined()
        })

        it('lanza error si el recurso ya está asociado', async () => {
            // Intentar agregar el mismo recurso otra vez
            await expect(addResourceToService(prisma, businessId, serviceId1, resourceId1)).rejects.toThrow(
                'El recurso ya está asociado a este servicio'
            )
        })

        it('lanza error si el servicio no existe', async () => {
            await expect(
                addResourceToService(prisma, businessId, '00000000-0000-0000-0000-000000000000', resourceId2)
            ).rejects.toThrow('Servicio no encontrado')
        })

        it('lanza error si el recurso no existe', async () => {
            await expect(
                addResourceToService(prisma, businessId, serviceId1, '00000000-0000-0000-0000-000000000000')
            ).rejects.toThrow('Recurso no encontrado')
        })
    })

    describe('getResourcesByServiceId', () => {
        it('devuelve recursos asociados con datos completos', async () => {
            const resources = await getResourcesByServiceId(prisma, businessId, serviceId1)

            expect(resources).toHaveLength(1)
            expect(resources[0].resourceId).toBe(resourceId1)
            expect(resources[0].resource).toBeDefined()
            expect(resources[0].resource.name).toBe('Recurso Test 1')
        })

        it('devuelve array vacío si no hay recursos asociados', async () => {
            const resources = await getResourcesByServiceId(prisma, businessId, serviceId2)

            expect(resources).toHaveLength(0)
        })
    })

    describe('getLinkedResourceSummaries', () => {
        it('devuelve resumen de recursos asociados', async () => {
            const summaries = await getLinkedResourceSummaries(prisma, businessId, serviceId1)

            expect(summaries).toHaveLength(1)
            expect(summaries[0].resourceId).toBe(resourceId1)
            expect(summaries[0].resourceName).toBe('Recurso Test 1')
            expect(summaries[0].resourceStatus).toBe('ACTIVE')
        })
    })

    describe('getServiceIdsWithResources', () => {
        it('devuelve set de servicios con recursos', async () => {
            const serviceIds = await getServiceIdsWithResources(prisma, businessId)

            expect(serviceIds.has(serviceId1)).toBe(true)
            expect(serviceIds.has(serviceId2)).toBe(false)
        })
    })

    describe('countResourcesByServiceIds', () => {
        it('cuenta recursos por servicio', async () => {
            // Agregar otro recurso al servicio 1
            await addResourceToService(prisma, businessId, serviceId1, resourceId2)

            const counts = await countResourcesByServiceIds(prisma, businessId, [serviceId1, serviceId2])

            expect(counts.get(serviceId1)).toBe(2)
            expect(counts.get(serviceId2)).toBeUndefined() // No tiene recursos
        })
    })

    describe('getResourceIdsByServiceId', () => {
        it('devuelve IDs de recursos asociados', async () => {
            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId1)

            expect(resourceIds).toHaveLength(2)
            expect(resourceIds).toContain(resourceId1)
            expect(resourceIds).toContain(resourceId2)
        })
    })

    describe('removeResourceFromService', () => {
        it('elimina asociación de recurso con servicio', async () => {
            const removed = await removeResourceFromService(prisma, businessId, serviceId1, resourceId2)

            expect(removed.resourceId).toBe(resourceId2)

            // Verificar que ya no está asociado
            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId1)
            expect(resourceIds).not.toContain(resourceId2)
        })

        it('lanza error si la asociación no existe', async () => {
            await expect(removeResourceFromService(prisma, businessId, serviceId1, resourceId2)).rejects.toThrow(
                'El recurso no está asociado a este servicio'
            )
        })
    })

    describe('setServiceResources', () => {
        it('reemplaza todos los recursos asociados', async () => {
            // Estado inicial: serviceId1 tiene resourceId1
            // Establecer nuevos recursos: resourceId2, resourceId3
            const links = await setServiceResources(prisma, businessId, serviceId1, [resourceId2, resourceId3])

            expect(links).toHaveLength(2)

            // Verificar que los recursos anteriores fueron reemplazados
            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId1)
            expect(resourceIds).toHaveLength(2)
            expect(resourceIds).not.toContain(resourceId1)
            expect(resourceIds).toContain(resourceId2)
            expect(resourceIds).toContain(resourceId3)
        })

        it('permite establecer lista vacía (desasociar todos)', async () => {
            const links = await setServiceResources(prisma, businessId, serviceId1, [])

            expect(links).toHaveLength(0)

            const resourceIds = await getResourceIdsByServiceId(prisma, businessId, serviceId1)
            expect(resourceIds).toHaveLength(0)
        })

        it('lanza error si algún recurso no es válido', async () => {
            await expect(
                setServiceResources(prisma, businessId, serviceId1, [
                    resourceId1,
                    '00000000-0000-0000-0000-000000000000'
                ])
            ).rejects.toThrow('Recursos no válidos')
        })

        it('lanza error si el servicio no existe', async () => {
            await expect(
                setServiceResources(prisma, '00000000-0000-0000-0000-000000000000', serviceId1, [resourceId1])
            ).rejects.toThrow('Servicio no encontrado')
        })
    })

    describe('tenant isolation', () => {
        it('no permite acceder a recursos de otro negocio', async () => {
            // Crear otro negocio
            const { business: otherBusiness } = await createBusinessWithOwner(
                prisma,
                {
                    name: `Other Business ${Date.now()}`,
                    timezone: 'America/Argentina/Buenos_Aires'
                },
                `other-biz-sr-${Date.now()}`,
                `other-user-sr-${Date.now()}`
            )

            // Intentar asociar recurso de businessId a servicio de otherBusiness
            const otherService = await createService(prisma, otherBusiness.id, {
                name: 'Servicio Otro Negocio',
                durationMinutes: 30
            })

            // Esto debe fallar porque resourceId1 pertenece a businessId, no a otherBusiness
            await expect(addResourceToService(prisma, otherBusiness.id, otherService.id, resourceId1)).rejects.toThrow(
                'Recurso no encontrado'
            )
        })
    })
})
