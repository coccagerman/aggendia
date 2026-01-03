/**
 * Integration tests for resource repository
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    createResource,
    getResourcesByBusinessId,
    getResourceById,
    updateResource
} from '@/data/repositories/resource.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'

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
})
