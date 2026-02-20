/**
 * Integration tests for resource repository
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    createResource,
    getResourcesByBusinessId,
    getResourceById,
    updateResource,
    deleteResource
} from '@/data/repositories/resource.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createService } from '@/data/repositories/service.repo'
import {
    addResourceToService,
    getResourceIdsByServiceId,
    countResourcesByServiceIds
} from '@/data/repositories/serviceResource.repo'

describe('Resource Repository - Integration Tests', () => {
    let businessId1: string
    let businessId2: string
    const userId = 'test-user-resources-' + Date.now()

    beforeAll(async () => {
        // Crear dos negocios de prueba
        const biz1 = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business 1 ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-resources-1-${Date.now()}`,
            userId
        )
        businessId1 = biz1.business.id

        const biz2 = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business 2 ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-resources-2-${Date.now()}`,
            userId + '-2'
        )
        businessId2 = biz2.business.id
    })

    describe('createResource', () => {
        it('crea recurso con datos mínimos (solo nombre)', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Recurso Mínimo'
            })

            expect(resource.id).toBeDefined()
            expect(resource.businessId).toBe(businessId1)
            expect(resource.name).toBe('Recurso Mínimo')
            expect(resource.type).toBeNull()
            expect(resource.status).toBe('ACTIVE')
            expect(resource.createdAt).toBeInstanceOf(Date)
            expect(resource.updatedAt).toBeInstanceOf(Date)
        })

        it('crea recurso con type PERSON', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Profesional 1',
                type: 'PERSON'
            })

            expect(resource.type).toBe('PERSON')
            expect(resource.status).toBe('ACTIVE')
        })

        it('crea recurso con type ASSET', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Cancha 1',
                type: 'ASSET'
            })

            expect(resource.type).toBe('ASSET')
            expect(resource.status).toBe('ACTIVE')
        })

        it('crea recurso con type null explícito', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Recurso Sin Tipo',
                type: null
            })

            expect(resource.type).toBeNull()
        })

        it('crea recurso con status INACTIVE explícito', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Recurso Inactivo',
                status: 'INACTIVE'
            })

            expect(resource.status).toBe('INACTIVE')
        })

        it('respeta unique constraint (businessId, name)', async () => {
            const name = `Recurso Único ${Date.now()}`
            await createResource(prisma, businessId1, { name })

            // Intentar crear otro con el mismo nombre en el mismo negocio
            await expect(createResource(prisma, businessId1, { name })).rejects.toThrow()
        })

        it('permite nombres duplicados en diferentes negocios', async () => {
            const name = `Recurso Compartido ${Date.now()}`

            const resource1 = await createResource(prisma, businessId1, { name })
            const resource2 = await createResource(prisma, businessId2, { name })

            expect(resource1.name).toBe(name)
            expect(resource2.name).toBe(name)
            expect(resource1.businessId).toBe(businessId1)
            expect(resource2.businessId).toBe(businessId2)
            expect(resource1.id).not.toBe(resource2.id)
        })

        it('trimea espacios en nombre al crear', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: '  Recurso con Espacios  '
            })

            expect(resource.name).toBe('Recurso con Espacios')
        })
    })

    describe('getResourcesByBusinessId', () => {
        it('devuelve recursos ACTIVE e INACTIVE del negocio', async () => {
            // Limpiar para este test
            const testBusinessName = `Clean Test Business ${Date.now()}`
            const cleanBiz = await createBusinessWithOwner(
                prisma,
                { name: testBusinessName, timezone: 'America/Argentina/Buenos_Aires' },
                `clean-biz-${Date.now()}`,
                userId + '-clean'
            )
            const cleanBusinessId = cleanBiz.business.id

            // Crear recursos con diferentes estados
            await createResource(prisma, cleanBusinessId, { name: 'Activo 1', status: 'ACTIVE' })
            await createResource(prisma, cleanBusinessId, { name: 'Inactivo 1', status: 'INACTIVE' })

            const resources = await getResourcesByBusinessId(prisma, cleanBusinessId)

            expect(resources.length).toBe(2)
            expect(resources.find(r => r.status === 'ACTIVE')).toBeDefined()
            expect(resources.find(r => r.status === 'INACTIVE')).toBeDefined()
        })

        it('excluye recursos DELETED', async () => {
            const testBusinessName = `Deleted Test Business ${Date.now()}`
            const deletedBiz = await createBusinessWithOwner(
                prisma,
                { name: testBusinessName, timezone: 'America/Argentina/Buenos_Aires' },
                `deleted-biz-${Date.now()}`,
                userId + '-deleted'
            )
            const deletedBusinessId = deletedBiz.business.id

            // Crear recurso y marcarlo como DELETED
            const resource = await createResource(prisma, deletedBusinessId, { name: 'A eliminar' })
            await updateResource(prisma, deletedBusinessId, resource.id, { status: 'DELETED' })

            const resources = await getResourcesByBusinessId(prisma, deletedBusinessId)

            expect(resources).toEqual([])
        })

        it('no devuelve recursos de otro negocio (tenant isolation)', async () => {
            const resourceBiz1 = await createResource(prisma, businessId1, {
                name: `Resource Business 1 ${Date.now()}`
            })

            await createResource(prisma, businessId2, {
                name: `Resource Business 2 ${Date.now()}`
            })

            const resources = await getResourcesByBusinessId(prisma, businessId1)

            expect(resources.some(r => r.id === resourceBiz1.id)).toBe(true)
            expect(resources.every(r => r.businessId === businessId1)).toBe(true)
        })

        it('ordena por createdAt ascendente', async () => {
            const testBusinessName = `Order Test Business ${Date.now()}`
            const orderBiz = await createBusinessWithOwner(
                prisma,
                { name: testBusinessName, timezone: 'America/Argentina/Buenos_Aires' },
                `order-biz-${Date.now()}`,
                userId + '-order'
            )
            const orderBusinessId = orderBiz.business.id

            // Crear recursos en secuencia
            const r1 = await createResource(prisma, orderBusinessId, { name: 'Primero' })
            // Pequeña pausa para asegurar timestamps diferentes
            await new Promise(resolve => setTimeout(resolve, 10))
            const r2 = await createResource(prisma, orderBusinessId, { name: 'Segundo' })
            await new Promise(resolve => setTimeout(resolve, 10))
            const r3 = await createResource(prisma, orderBusinessId, { name: 'Tercero' })

            const resources = await getResourcesByBusinessId(prisma, orderBusinessId)

            expect(resources[0].id).toBe(r1.id)
            expect(resources[1].id).toBe(r2.id)
            expect(resources[2].id).toBe(r3.id)
        })
    })

    describe('getResourceById', () => {
        it('devuelve recurso existente del negocio', async () => {
            const created = await createResource(prisma, businessId1, {
                name: `Get By ID ${Date.now()}`
            })

            const found = await getResourceById(prisma, businessId1, created.id)

            expect(found).toBeDefined()
            expect(found?.id).toBe(created.id)
            expect(found?.businessId).toBe(businessId1)
        })

        it('devuelve null si el recurso no existe', async () => {
            const found = await getResourceById(prisma, businessId1, 'non-existent-id')
            expect(found).toBeNull()
        })

        it('devuelve null si el recurso pertenece a otro negocio', async () => {
            const resourceBiz2 = await createResource(prisma, businessId2, {
                name: `Resource Biz2 ${Date.now()}`
            })

            // Intentar obtenerlo desde businessId1
            const found = await getResourceById(prisma, businessId1, resourceBiz2.id)
            expect(found).toBeNull()
        })
    })

    describe('updateResource', () => {
        it('actualiza nombre del recurso', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Nombre Original'
            })

            const updated = await updateResource(prisma, businessId1, resource.id, {
                name: 'Nombre Actualizado'
            })

            expect(updated.name).toBe('Nombre Actualizado')
        })

        it('actualiza type del recurso', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Sin Tipo Inicial',
                type: null
            })

            const updated = await updateResource(prisma, businessId1, resource.id, {
                type: 'PERSON'
            })

            expect(updated.type).toBe('PERSON')
        })

        it('actualiza status del recurso', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'A Desactivar'
            })

            expect(resource.status).toBe('ACTIVE')

            const updated = await updateResource(prisma, businessId1, resource.id, {
                status: 'INACTIVE'
            })

            expect(updated.status).toBe('INACTIVE')
        })

        it('actualiza múltiples campos a la vez', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: 'Multi Update',
                type: null,
                status: 'ACTIVE'
            })

            const updated = await updateResource(prisma, businessId1, resource.id, {
                name: 'Multi Actualizado',
                type: 'ASSET',
                status: 'INACTIVE'
            })

            expect(updated.name).toBe('Multi Actualizado')
            expect(updated.type).toBe('ASSET')
            expect(updated.status).toBe('INACTIVE')
        })

        it('rechaza actualizar recurso de otro negocio', async () => {
            const resourceBiz2 = await createResource(prisma, businessId2, {
                name: 'Resource Biz2'
            })

            // Intentar actualizar desde businessId1
            await expect(
                updateResource(prisma, businessId1, resourceBiz2.id, {
                    name: 'Intento Malicioso'
                })
            ).rejects.toThrow()
        })
    })

    describe('deleteResource', () => {
        it('hace soft delete cambiando status a DELETED', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: `Delete Test ${Date.now()}`,
                status: 'ACTIVE'
            })

            // Delete
            await deleteResource(prisma, businessId1, resource.id)

            // Verificar que no aparece en listado
            const resources = await getResourcesByBusinessId(prisma, businessId1)
            const found = resources.find(r => r.id === resource.id)
            expect(found).toBeUndefined()
        })

        it('recurso eliminado no se encuentra con getResourceById', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: `Delete ById Test ${Date.now()}`
            })

            await deleteResource(prisma, businessId1, resource.id)

            const found = await getResourceById(prisma, businessId1, resource.id)
            expect(found).toBeNull()
        })

        it('rechaza eliminar recurso de otro negocio', async () => {
            const resourceBiz2 = await createResource(prisma, businessId2, {
                name: `Delete Cross Tenant ${Date.now()}`
            })

            // Intentar eliminar desde businessId1
            await expect(deleteResource(prisma, businessId1, resourceBiz2.id)).rejects.toThrow()
        })

        it('rechaza eliminar recurso inexistente', async () => {
            await expect(deleteResource(prisma, businessId1, 'non-existent-id')).rejects.toThrow()
        })

        it('recurso INACTIVE también puede ser eliminado', async () => {
            const resource = await createResource(prisma, businessId1, {
                name: `Delete Inactive ${Date.now()}`,
                status: 'INACTIVE'
            })

            await deleteResource(prisma, businessId1, resource.id)

            const found = await getResourceById(prisma, businessId1, resource.id)
            expect(found).toBeNull()
        })
    })

    describe('soft delete - name reuse', () => {
        it('permite crear recurso con nombre de uno eliminado (índice parcial único)', async () => {
            const resourceName = `Recurso Reusable ${Date.now()}`

            // Crear el recurso
            const original = await createResource(prisma, businessId1, {
                name: resourceName,
                type: 'PERSON'
            })
            expect(original.status).toBe('ACTIVE')

            // Eliminarlo (soft delete)
            await deleteResource(prisma, businessId1, original.id)

            // Crear otro con el mismo nombre - ahora funciona gracias al índice parcial
            const reused = await createResource(prisma, businessId1, {
                name: resourceName,
                type: 'ASSET'
            })

            expect(reused.id).not.toBe(original.id)
            expect(reused.name).toBe(resourceName)
            expect(reused.type).toBe('ASSET')
            expect(reused.status).toBe('ACTIVE')
        })

        it('rechaza crear recurso con nombre duplicado si existe uno activo', async () => {
            const resourceName = `Recurso Activo Duplicado ${Date.now()}`

            // Crear recurso activo
            await createResource(prisma, businessId1, {
                name: resourceName
            })

            // Intentar crear otro con el mismo nombre - debería fallar
            await expect(
                createResource(prisma, businessId1, {
                    name: resourceName
                })
            ).rejects.toThrow('Ya existe un recurso / prestador activo o inactivo con ese nombre')
        })

        it('rechaza crear recurso con nombre duplicado si existe uno inactivo', async () => {
            const resourceName = `Recurso Inactivo Duplicado ${Date.now()}`

            // Crear recurso y marcarlo como inactivo
            const resource = await createResource(prisma, businessId1, {
                name: resourceName
            })
            await updateResource(prisma, businessId1, resource.id, { status: 'INACTIVE' })

            // Intentar crear otro con el mismo nombre - debería fallar
            await expect(
                createResource(prisma, businessId1, {
                    name: resourceName
                })
            ).rejects.toThrow('Ya existe un recurso / prestador activo o inactivo con ese nombre')
        })

        it('permite actualizar nombre a uno de recurso eliminado (índice parcial único)', async () => {
            const deletedName = `Recurso Eliminado ${Date.now()}`
            const activeName = `Recurso Activo ${Date.now()}`

            // Crear y eliminar un recurso
            const deletedResource = await createResource(prisma, businessId1, {
                name: deletedName
            })
            await deleteResource(prisma, businessId1, deletedResource.id)

            // Crear otro recurso con nombre diferente
            const activeResource = await createResource(prisma, businessId1, {
                name: activeName
            })

            // Actualizar al nombre del eliminado - ahora funciona gracias al índice parcial
            const updated = await updateResource(prisma, businessId1, activeResource.id, {
                name: deletedName
            })

            expect(updated.name).toBe(deletedName)
        })

        it('rechaza actualizar nombre a uno de recurso activo existente', async () => {
            const existingName = `Recurso Existente ${Date.now()}`
            const otherName = `Recurso Otro ${Date.now()}`

            // Crear dos recursos
            await createResource(prisma, businessId1, {
                name: existingName
            })

            const otherResource = await createResource(prisma, businessId1, {
                name: otherName
            })

            // Intentar cambiar el nombre del segundo al del primero - debería fallar
            await expect(
                updateResource(prisma, businessId1, otherResource.id, {
                    name: existingName
                })
            ).rejects.toThrow('Ya existe un recurso / prestador activo o inactivo con ese nombre')
        })
    })

    describe('deleteResource - service link cleanup', () => {
        it('elimina las asociaciones ServiceResource cuando se elimina un recurso', async () => {
            // Crear recurso y servicio
            const resource = await createResource(prisma, businessId1, {
                name: `Recurso para Desasignar ${Date.now()}`
            })
            const service = await createService(prisma, businessId1, {
                name: `Servicio para Test Link ${Date.now()}`,
                durationMinutes: 30
            })

            // Asociar recurso al servicio
            await addResourceToService(prisma, businessId1, service.id, resource.id)

            // Verificar que la asociación existe
            const linksBefore = await getResourceIdsByServiceId(prisma, businessId1, service.id)
            expect(linksBefore).toContain(resource.id)

            // Eliminar el recurso (soft delete)
            await deleteResource(prisma, businessId1, resource.id)

            // Verificar que la asociación fue eliminada
            const linksAfter = await getResourceIdsByServiceId(prisma, businessId1, service.id)
            expect(linksAfter).not.toContain(resource.id)
        })

        it('actualiza el contador de recursos de un servicio cuando se elimina un recurso asignado', async () => {
            // Crear dos recursos y un servicio
            const resource1 = await createResource(prisma, businessId1, {
                name: `Recurso Count 1 ${Date.now()}`
            })
            const resource2 = await createResource(prisma, businessId1, {
                name: `Recurso Count 2 ${Date.now()}`
            })
            const service = await createService(prisma, businessId1, {
                name: `Servicio Count Test ${Date.now()}`,
                durationMinutes: 30
            })

            // Asociar ambos recursos al servicio
            await addResourceToService(prisma, businessId1, service.id, resource1.id)
            await addResourceToService(prisma, businessId1, service.id, resource2.id)

            // Verificar contador antes
            const countsBefore = await countResourcesByServiceIds(prisma, businessId1, [service.id])
            expect(countsBefore.get(service.id)).toBe(2)

            // Eliminar uno de los recursos
            await deleteResource(prisma, businessId1, resource1.id)

            // Verificar contador después
            const countsAfter = await countResourcesByServiceIds(prisma, businessId1, [service.id])
            expect(countsAfter.get(service.id)).toBe(1)
        })

        it('elimina asociaciones de múltiples servicios cuando se elimina un recurso', async () => {
            // Crear un recurso y dos servicios
            const resource = await createResource(prisma, businessId1, {
                name: `Recurso Multi Service ${Date.now()}`
            })
            const service1 = await createService(prisma, businessId1, {
                name: `Servicio Multi 1 ${Date.now()}`,
                durationMinutes: 30
            })
            const service2 = await createService(prisma, businessId1, {
                name: `Servicio Multi 2 ${Date.now()}`,
                durationMinutes: 45
            })

            // Asociar el recurso a ambos servicios
            await addResourceToService(prisma, businessId1, service1.id, resource.id)
            await addResourceToService(prisma, businessId1, service2.id, resource.id)

            // Verificar que las asociaciones existen
            expect(await getResourceIdsByServiceId(prisma, businessId1, service1.id)).toContain(resource.id)
            expect(await getResourceIdsByServiceId(prisma, businessId1, service2.id)).toContain(resource.id)

            // Eliminar el recurso
            await deleteResource(prisma, businessId1, resource.id)

            // Verificar que ambas asociaciones fueron eliminadas
            expect(await getResourceIdsByServiceId(prisma, businessId1, service1.id)).not.toContain(resource.id)
            expect(await getResourceIdsByServiceId(prisma, businessId1, service2.id)).not.toContain(resource.id)
        })
    })
})
