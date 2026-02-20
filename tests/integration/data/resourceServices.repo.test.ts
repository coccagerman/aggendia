/**
 * Integration tests for Resource Services API
 * Tests the ability to assign/unassign services from a resource
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { getServiceIdsByResourceId, setResourceServices } from '@/data/repositories/serviceResource.repo'

describe('Resource Services Repository - Integration Tests', () => {
    let businessId: string
    let resourceId: string
    let serviceId1: string
    let serviceId2: string
    let serviceId3: string
    const userId = 'test-user-resource-services-' + Date.now()

    beforeAll(async () => {
        // Crear negocio de prueba
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business Resource Services ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-resource-services-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Crear recurso de prueba
        const resource = await createResource(prisma, businessId, {
            name: 'Test Resource'
        })
        resourceId = resource.id

        // Crear servicios de prueba
        const service1 = await createService(prisma, businessId, {
            name: 'Servicio 1',
            durationMinutes: 30
        })
        serviceId1 = service1.id

        const service2 = await createService(prisma, businessId, {
            name: 'Servicio 2',
            durationMinutes: 45
        })
        serviceId2 = service2.id

        const service3 = await createService(prisma, businessId, {
            name: 'Servicio 3',
            durationMinutes: 60
        })
        serviceId3 = service3.id
    })

    afterAll(async () => {
        // Cleanup: eliminar el negocio (cascade elimina todo)
        await prisma.business.delete({ where: { id: businessId } })
    })

    describe('getServiceIdsByResourceId', () => {
        it('devuelve array vacío cuando no hay servicios asignados', async () => {
            const serviceIds = await getServiceIdsByResourceId(prisma, businessId, resourceId)
            expect(serviceIds).toEqual([])
        })
    })

    describe('setResourceServices', () => {
        it('asigna servicios a un recurso', async () => {
            await setResourceServices(prisma, businessId, resourceId, [serviceId1, serviceId2])

            const serviceIds = await getServiceIdsByResourceId(prisma, businessId, resourceId)
            expect(serviceIds).toHaveLength(2)
            expect(serviceIds).toContain(serviceId1)
            expect(serviceIds).toContain(serviceId2)
        })

        it('reemplaza servicios existentes al actualizar', async () => {
            // Primero asignar algunos servicios
            await setResourceServices(prisma, businessId, resourceId, [serviceId1])

            // Luego reemplazar con otros
            await setResourceServices(prisma, businessId, resourceId, [serviceId2, serviceId3])

            const serviceIds = await getServiceIdsByResourceId(prisma, businessId, resourceId)
            expect(serviceIds).toHaveLength(2)
            expect(serviceIds).not.toContain(serviceId1)
            expect(serviceIds).toContain(serviceId2)
            expect(serviceIds).toContain(serviceId3)
        })

        it('permite desasignar todos los servicios', async () => {
            // Asignar servicios
            await setResourceServices(prisma, businessId, resourceId, [serviceId1, serviceId2])

            // Desasignar todos
            await setResourceServices(prisma, businessId, resourceId, [])

            const serviceIds = await getServiceIdsByResourceId(prisma, businessId, resourceId)
            expect(serviceIds).toEqual([])
        })

        it('lanza error si el recurso no existe', async () => {
            await expect(
                setResourceServices(prisma, businessId, 'non-existent-resource-id', [serviceId1])
            ).rejects.toThrow('Recurso / prestador no encontrado')
        })

        it('lanza error si algún servicio no existe', async () => {
            await expect(
                setResourceServices(prisma, businessId, resourceId, [serviceId1, 'non-existent-service-id'])
            ).rejects.toThrow('Servicios no válidos')
        })

        it('lanza error si el recurso pertenece a otro negocio', async () => {
            // Crear otro negocio
            const otherBiz = await createBusinessWithOwner(
                prisma,
                {
                    name: `Other Business ${Date.now()}`,
                    timezone: 'America/Argentina/Buenos_Aires'
                },
                `other-biz-${Date.now()}`,
                userId + '-other'
            )

            // Intentar asignar servicios de otro negocio
            await expect(setResourceServices(prisma, otherBiz.business.id, resourceId, [serviceId1])).rejects.toThrow(
                'Recurso / prestador no encontrado'
            )

            // Cleanup
            await prisma.business.delete({ where: { id: otherBiz.business.id } })
        })

        it('no permite asignar servicios eliminados', async () => {
            // Crear y eliminar un servicio
            const deletedService = await createService(prisma, businessId, {
                name: 'Servicio a Eliminar',
                durationMinutes: 30
            })
            await prisma.service.update({
                where: { id: deletedService.id },
                data: { status: 'DELETED' }
            })

            // Intentar asignar el servicio eliminado
            await expect(setResourceServices(prisma, businessId, resourceId, [deletedService.id])).rejects.toThrow(
                'Servicios no válidos'
            )
        })
    })
})
