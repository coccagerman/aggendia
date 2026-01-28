/**
 * Integration tests for service repository
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    getActiveServicesByBusinessId,
    getServicesByBusinessId,
    createService,
    updateService,
    deleteService
} from '@/data/repositories/service.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'

describe('Service Repository - Integration Tests', () => {
    let businessId1: string
    let businessId2: string
    const userId = 'test-user-services-' + Date.now()

    beforeAll(async () => {
        // Crear dos negocios de prueba
        const biz1 = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business 1 ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-services-1-${Date.now()}`,
            userId
        )
        businessId1 = biz1.business.id

        const biz2 = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business 2 ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-services-2-${Date.now()}`,
            userId + '-2'
        )
        businessId2 = biz2.business.id
    })

    describe('getActiveServicesByBusinessId', () => {
        it('devuelve solo servicios activos del negocio', async () => {
            // Crear servicios: 2 activos, 1 eliminado
            const service1 = await createService(prisma, businessId1, {
                name: 'Servicio Activo 1',
                durationMinutes: 30
            })

            const service2 = await createService(prisma, businessId1, {
                name: 'Servicio Activo 2',
                durationMinutes: 45
            })

            const service3 = await createService(prisma, businessId1, {
                name: 'Servicio Eliminado',
                durationMinutes: 60
            })
            await deleteService(prisma, businessId1, service3.id)

            const activeServices = await getActiveServicesByBusinessId(prisma, businessId1)

            expect(activeServices).toHaveLength(2)
            expect(activeServices.map(s => s.id)).toContain(service1.id)
            expect(activeServices.map(s => s.id)).toContain(service2.id)
            expect(activeServices.map(s => s.id)).not.toContain(service3.id)
        })

        it('devuelve array vacío si no hay servicios activos', async () => {
            const services = await getActiveServicesByBusinessId(prisma, businessId2)
            expect(services).toEqual([])
        })

        it('no devuelve servicios de otro negocio (tenant isolation)', async () => {
            // Crear servicio en business2
            const otherService = await createService(prisma, businessId2, {
                name: 'Servicio Otro Negocio',
                durationMinutes: 30
            })

            // Buscar servicios de business1
            const services = await getActiveServicesByBusinessId(prisma, businessId1)

            // No debe incluir el servicio de business2
            expect(services.map(s => s.id)).not.toContain(otherService.id)
        })

        it('ordena servicios por nombre ascendente', async () => {
            // Limpiar servicios previos
            const existingServices = await getServicesByBusinessId(prisma, businessId2)
            for (const s of existingServices) {
                await deleteService(prisma, businessId2, s.id)
            }

            // Crear servicios en orden no alfabético
            await createService(prisma, businessId2, {
                name: 'Zebra Service',
                durationMinutes: 30
            })
            await createService(prisma, businessId2, {
                name: 'Alpha Service',
                durationMinutes: 30
            })
            await createService(prisma, businessId2, {
                name: 'Middle Service',
                durationMinutes: 30
            })

            const services = await getActiveServicesByBusinessId(prisma, businessId2)

            expect(services).toHaveLength(3)
            expect(services[0].name).toBe('Alpha Service')
            expect(services[1].name).toBe('Middle Service')
            expect(services[2].name).toBe('Zebra Service')
        })
    })

    describe('getServicesByBusinessId', () => {
        it('devuelve todos los servicios (activos e inactivos, excluyendo eliminados)', async () => {
            const allServices = await getServicesByBusinessId(prisma, businessId1)

            // Debe incluir tanto activos como inactivos, pero no eliminados
            const activeCount = allServices.filter(s => s.status === 'ACTIVE').length
            const deletedCount = allServices.filter(s => s.status === 'DELETED').length

            expect(allServices.length).toBeGreaterThan(0)
            expect(activeCount).toBeGreaterThan(0)
            // Los DELETED no deberían aparecer
            expect(deletedCount).toBe(0)
        })

        it('ordena por fecha de creación descendente', async () => {
            const services = await getServicesByBusinessId(prisma, businessId1)

            // Verificar que están ordenados por createdAt desc
            for (let i = 0; i < services.length - 1; i++) {
                expect(services[i].createdAt.getTime()).toBeGreaterThanOrEqual(services[i + 1].createdAt.getTime())
            }
        })
    })

    describe('createService', () => {
        it('crea servicio con datos mínimos (slotInterval = duration por defecto)', async () => {
            const service = await createService(prisma, businessId1, {
                name: 'Servicio Mínimo',
                durationMinutes: 30
            })

            expect(service.id).toBeDefined()
            expect(service.name).toBe('Servicio Mínimo')
            expect(service.durationMinutes).toBe(30)
            expect(service.slotIntervalMinutes).toBe(30) // default = duration
            expect(service.status).toBe('ACTIVE')
            expect(service.currency).toBe('ARS')
        })

        it('crea servicio con todos los datos incluyendo slotIntervalMinutes', async () => {
            const service = await createService(prisma, businessId1, {
                name: 'Servicio Completo',
                description: 'Descripción del servicio',
                durationMinutes: 60,
                slotIntervalMinutes: 75,
                priceCents: 5000,
                currency: 'USD'
            })

            expect(service.name).toBe('Servicio Completo')
            expect(service.description).toBe('Descripción del servicio')
            expect(service.durationMinutes).toBe(60)
            expect(service.slotIntervalMinutes).toBe(75)
            expect(service.priceCents).toBe(5000)
            expect(service.currency).toBe('USD')
        })

        it('respeta unique constraint (businessId, name)', async () => {
            await createService(prisma, businessId1, {
                name: 'Servicio Único',
                durationMinutes: 30
            })

            // Intentar crear otro servicio con el mismo nombre en el mismo negocio
            await expect(
                createService(prisma, businessId1, {
                    name: 'Servicio Único',
                    durationMinutes: 45
                })
            ).rejects.toThrow()
        })
    })

    describe('updateService', () => {
        it('actualiza nombre del servicio', async () => {
            const service = await createService(prisma, businessId1, {
                name: 'Nombre Original',
                durationMinutes: 30
            })

            const updated = await updateService(prisma, businessId1, service.id, {
                name: 'Nombre Actualizado'
            })

            expect(updated.name).toBe('Nombre Actualizado')
            expect(updated.durationMinutes).toBe(30) // No cambió
        })

        it('actualiza múltiples campos incluyendo status', async () => {
            const service = await createService(prisma, businessId1, {
                name: 'Multi Update',
                durationMinutes: 30
            })

            const updated = await updateService(prisma, businessId1, service.id, {
                durationMinutes: 60,
                slotIntervalMinutes: 75,
                priceCents: 3000,
                status: 'INACTIVE'
            })

            expect(updated.durationMinutes).toBe(60)
            expect(updated.slotIntervalMinutes).toBe(75)
            expect(updated.priceCents).toBe(3000)
            expect(updated.status).toBe('INACTIVE')
        })

        it('auto-ajusta slotIntervalMinutes cuando durationMinutes sube y supera el intervalo existente', async () => {
            // Crear servicio con duration=30 y slotInterval=30 (default)
            const service = await createService(prisma, businessId1, {
                name: 'Auto Ajuste Test',
                durationMinutes: 30
            })
            expect(service.slotIntervalMinutes).toBe(30)

            // Actualizar solo durationMinutes a 60 (sin especificar slotInterval)
            // El backend debe auto-ajustar slotInterval a 60 para cumplir constraint
            const updated = await updateService(prisma, businessId1, service.id, {
                durationMinutes: 60
            })

            expect(updated.durationMinutes).toBe(60)
            expect(updated.slotIntervalMinutes).toBe(60) // Auto-ajustado
        })

        it('no modifica slotIntervalMinutes si ya es mayor o igual a la nueva duración', async () => {
            // Crear servicio con duration=30 y slotInterval=90
            const service = await createService(prisma, businessId1, {
                name: 'No Ajuste Test',
                durationMinutes: 30,
                slotIntervalMinutes: 90
            })
            expect(service.slotIntervalMinutes).toBe(90)

            // Actualizar durationMinutes a 60 (slotInterval 90 sigue siendo válido)
            const updated = await updateService(prisma, businessId1, service.id, {
                durationMinutes: 60
            })

            expect(updated.durationMinutes).toBe(60)
            expect(updated.slotIntervalMinutes).toBe(90) // No cambió, sigue siendo válido
        })
    })

    describe('deleteService', () => {
        it('elimina un servicio (soft delete con status DELETED)', async () => {
            const service = await createService(prisma, businessId1, {
                name: 'Para Eliminar',
                durationMinutes: 30
            })

            expect(service.status).toBe('ACTIVE')

            const deleted = await deleteService(prisma, businessId1, service.id)

            expect(deleted.status).toBe('DELETED')
            expect(deleted.id).toBe(service.id)
        })

        it('no aparece en getServicesByBusinessId después de eliminar', async () => {
            const service = await createService(prisma, businessId1, {
                name: 'Para Eliminar y Verificar',
                durationMinutes: 30
            })

            await deleteService(prisma, businessId1, service.id)

            const services = await getServicesByBusinessId(prisma, businessId1)
            expect(services.map(s => s.id)).not.toContain(service.id)
        })
    })

    describe('soft delete - name reuse', () => {
        it('permite crear servicio con nombre de uno eliminado (índice parcial único)', async () => {
            const serviceName = `Servicio Reusable ${Date.now()}`

            // Crear el servicio
            const original = await createService(prisma, businessId1, {
                name: serviceName,
                durationMinutes: 30
            })
            expect(original.status).toBe('ACTIVE')

            // Eliminarlo (soft delete)
            await deleteService(prisma, businessId1, original.id)

            // Crear otro con el mismo nombre - ahora funciona gracias al índice parcial
            const reused = await createService(prisma, businessId1, {
                name: serviceName,
                durationMinutes: 45
            })

            expect(reused.id).not.toBe(original.id)
            expect(reused.name).toBe(serviceName)
            expect(reused.durationMinutes).toBe(45)
            expect(reused.status).toBe('ACTIVE')
        })

        it('rechaza crear servicio con nombre duplicado si existe uno activo', async () => {
            const serviceName = `Servicio Activo Duplicado ${Date.now()}`

            // Crear servicio activo
            await createService(prisma, businessId1, {
                name: serviceName,
                durationMinutes: 30
            })

            // Intentar crear otro con el mismo nombre - debería fallar
            await expect(
                createService(prisma, businessId1, {
                    name: serviceName,
                    durationMinutes: 45
                })
            ).rejects.toThrow('Ya existe un servicio activo o inactivo con ese nombre')
        })

        it('rechaza crear servicio con nombre duplicado si existe uno inactivo', async () => {
            const serviceName = `Servicio Inactivo Duplicado ${Date.now()}`

            // Crear servicio y marcarlo como inactivo
            const service = await createService(prisma, businessId1, {
                name: serviceName,
                durationMinutes: 30
            })
            await updateService(prisma, businessId1, service.id, { status: 'INACTIVE' })

            // Intentar crear otro con el mismo nombre - debería fallar
            await expect(
                createService(prisma, businessId1, {
                    name: serviceName,
                    durationMinutes: 45
                })
            ).rejects.toThrow('Ya existe un servicio activo o inactivo con ese nombre')
        })

        it('permite actualizar nombre a uno de servicio eliminado (índice parcial único)', async () => {
            const deletedName = `Servicio Eliminado ${Date.now()}`
            const activeName = `Servicio Activo ${Date.now()}`

            // Crear y eliminar un servicio
            const deletedService = await createService(prisma, businessId1, {
                name: deletedName,
                durationMinutes: 30
            })
            await deleteService(prisma, businessId1, deletedService.id)

            // Crear otro servicio con nombre diferente
            const activeService = await createService(prisma, businessId1, {
                name: activeName,
                durationMinutes: 30
            })

            // Actualizar al nombre del eliminado - ahora funciona gracias al índice parcial
            const updated = await updateService(prisma, businessId1, activeService.id, {
                name: deletedName
            })

            expect(updated.name).toBe(deletedName)
        })

        it('rechaza actualizar nombre a uno de servicio activo existente', async () => {
            const existingName = `Servicio Existente ${Date.now()}`
            const otherName = `Servicio Otro ${Date.now()}`

            // Crear dos servicios
            await createService(prisma, businessId1, {
                name: existingName,
                durationMinutes: 30
            })

            const otherService = await createService(prisma, businessId1, {
                name: otherName,
                durationMinutes: 30
            })

            // Intentar cambiar el nombre del segundo al del primero - debería fallar
            await expect(
                updateService(prisma, businessId1, otherService.id, {
                    name: existingName
                })
            ).rejects.toThrow('Ya existe un servicio activo o inactivo con ese nombre')
        })
    })
})
