/**
 * Integration tests for appointment repository - getAppointmentsByBusinessAndDay
 * @see docs/user-stories.md - US-6.1
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import { getAppointmentsByBusinessAndDay, createAppointment } from '@/data/repositories/appointment.repo'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { setServiceResources } from '@/data/repositories/serviceResource.repo'

describe('Appointment Repository - getAppointmentsByBusinessAndDay', () => {
    let businessId: string
    let otherBusinessId: string
    let resourceId: string
    let resource2Id: string
    let serviceId: string
    let customerId: string
    const userId = 'test-user-agenda-' + Date.now()

    beforeAll(async () => {
        // Crear negocio de prueba
        const biz = await createBusinessWithOwner(
            prisma,
            {
                name: `Test Business Agenda ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `test-biz-agenda-${Date.now()}`,
            userId
        )
        businessId = biz.business.id

        // Crear otro negocio para test de tenant isolation
        const otherBiz = await createBusinessWithOwner(
            prisma,
            {
                name: `Other Business ${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires'
            },
            `other-biz-agenda-${Date.now()}`,
            userId + '-other'
        )
        otherBusinessId = otherBiz.business.id

        // Crear recursos
        const resource = await createResource(prisma, businessId, {
            name: 'Resource 1',
            status: 'ACTIVE'
        })
        resourceId = resource.id

        const resource2 = await createResource(prisma, businessId, {
            name: 'Resource 2',
            status: 'ACTIVE'
        })
        resource2Id = resource2.id

        // Crear servicio
        const service = await createService(prisma, businessId, {
            name: 'Test Service',
            durationMinutes: 60,
            slotIntervalMinutes: 60
        })
        serviceId = service.id

        // Crear relación service-resource (asocia ambos recursos al servicio)
        await setServiceResources(prisma, businessId, serviceId, [resourceId, resource2Id])

        // Crear cliente
        const customer = await prisma.customer.create({
            data: {
                businessId,
                fullName: 'Test Customer',
                email: `test-agenda-${Date.now()}@test.com`
            }
        })
        customerId = customer.id
    })

    describe('basic functionality', () => {
        it('should return appointments for the specified day', async () => {
            // Crear turno para el día 2026-01-15 09:00 Buenos Aires = 12:00 UTC
            const startAt = new Date('2026-01-15T12:00:00Z')
            const endAt = new Date('2026-01-15T13:00:00Z')
            const occupiedEndAt = new Date('2026-01-15T13:00:00Z')

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt,
                endAt,
                occupiedEndAt
            })

            // Query para el día 2026-01-15 en Argentina (UTC-3)
            // Día completo: 2026-01-15 00:00 ART = 03:00 UTC hasta 2026-01-16 00:00 ART = 03:00 UTC
            const dayStart = new Date('2026-01-15T03:00:00Z')
            const dayEnd = new Date('2026-01-16T03:00:00Z')

            const appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            expect(appointments.length).toBeGreaterThanOrEqual(1)
            expect(appointments.some(a => a.id === appointment.id)).toBe(true)
        })

        it('should not return appointments from other days', async () => {
            // Crear turno para el día 2026-01-20
            const startAt = new Date('2026-01-20T12:00:00Z')
            const endAt = new Date('2026-01-20T13:00:00Z')
            const occupiedEndAt = new Date('2026-01-20T13:00:00Z')

            const appointment = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt,
                endAt,
                occupiedEndAt
            })

            // Query para el día 2026-01-21
            const dayStart = new Date('2026-01-21T03:00:00Z')
            const dayEnd = new Date('2026-01-22T03:00:00Z')

            const appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            expect(appointments.some(a => a.id === appointment.id)).toBe(false)
        })

        it('should filter by resourceId when provided', async () => {
            // Crear turnos para dos recursos diferentes el mismo día
            const startAt1 = new Date('2026-02-10T14:00:00Z')
            const startAt2 = new Date('2026-02-10T15:00:00Z')

            const appointment1 = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: startAt1,
                endAt: new Date('2026-02-10T15:00:00Z'),
                occupiedEndAt: new Date('2026-02-10T15:00:00Z')
            })

            const appointment2 = await createAppointment(prisma, {
                businessId,
                resourceId: resource2Id,
                serviceId,
                customerId,
                startAt: startAt2,
                endAt: new Date('2026-02-10T16:00:00Z'),
                occupiedEndAt: new Date('2026-02-10T16:00:00Z')
            })

            // Query filtrando por resource1
            const dayStart = new Date('2026-02-10T03:00:00Z')
            const dayEnd = new Date('2026-02-11T03:00:00Z')

            const filteredAppointments = await getAppointmentsByBusinessAndDay(
                prisma,
                businessId,
                dayStart,
                dayEnd,
                resourceId
            )

            expect(filteredAppointments.some(a => a.id === appointment1.id)).toBe(true)
            expect(filteredAppointments.some(a => a.id === appointment2.id)).toBe(false)
        })

        it('should return all appointments when resourceId is not provided', async () => {
            // Query sin filtro de recurso
            const dayStart = new Date('2026-02-10T03:00:00Z')
            const dayEnd = new Date('2026-02-11T03:00:00Z')

            const allAppointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            // Debería incluir turnos de ambos recursos
            expect(allAppointments.length).toBeGreaterThanOrEqual(2)
        })
    })

    describe('tenant isolation', () => {
        it('should not return appointments from other businesses', async () => {
            // Crear recurso y servicio en el otro negocio
            const otherResource = await createResource(prisma, otherBusinessId, {
                name: 'Other Resource',
                status: 'ACTIVE'
            })

            const otherService = await createService(prisma, otherBusinessId, {
                name: 'Other Service',
                durationMinutes: 60,
                slotIntervalMinutes: 60
            })

            await setServiceResources(prisma, otherBusinessId, otherService.id, [otherResource.id])

            const otherCustomer = await prisma.customer.create({
                data: {
                    businessId: otherBusinessId,
                    fullName: 'Other Customer',
                    email: `other-customer-${Date.now()}@test.com`
                }
            })

            // Crear turno en el otro negocio
            const otherAppointment = await createAppointment(prisma, {
                businessId: otherBusinessId,
                resourceId: otherResource.id,
                serviceId: otherService.id,
                customerId: otherCustomer.id,
                startAt: new Date('2026-03-15T12:00:00Z'),
                endAt: new Date('2026-03-15T13:00:00Z'),
                occupiedEndAt: new Date('2026-03-15T13:00:00Z')
            })

            // Query desde el negocio principal
            const dayStart = new Date('2026-03-15T03:00:00Z')
            const dayEnd = new Date('2026-03-16T03:00:00Z')

            const appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            expect(appointments.some(a => a.id === otherAppointment.id)).toBe(false)
        })
    })

    describe('includes relations', () => {
        it('should include service, resource, customer and business data', async () => {
            const startAt = new Date('2026-04-15T12:00:00Z')
            await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt,
                endAt: new Date('2026-04-15T13:00:00Z'),
                occupiedEndAt: new Date('2026-04-15T13:00:00Z')
            })

            const dayStart = new Date('2026-04-15T03:00:00Z')
            const dayEnd = new Date('2026-04-16T03:00:00Z')

            const appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            expect(appointments.length).toBeGreaterThanOrEqual(1)
            const appointment = appointments[0]

            // Verify relations are included
            expect(appointment.service).toBeDefined()
            expect(appointment.service.id).toBeDefined()
            expect(appointment.service.name).toBeDefined()

            expect(appointment.resource).toBeDefined()
            expect(appointment.resource.id).toBeDefined()
            expect(appointment.resource.name).toBeDefined()

            expect(appointment.customer).toBeDefined()
            expect(appointment.customer.id).toBeDefined()
            expect(appointment.customer.fullName).toBeDefined()

            expect(appointment.business).toBeDefined()
            expect(appointment.business.timezone).toBeDefined()
        })
    })

    describe('status filtering', () => {
        it('should return appointments with all statuses (SCHEDULED, CANCELLED)', async () => {
            const dayStart = new Date('2026-05-10T03:00:00Z')
            const dayEnd = new Date('2026-05-11T03:00:00Z')

            // Crear turno SCHEDULED
            const scheduledAppt = await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: new Date('2026-05-10T12:00:00Z'),
                endAt: new Date('2026-05-10T13:00:00Z'),
                occupiedEndAt: new Date('2026-05-10T13:00:00Z')
            })

            // Crear turno y cancelarlo
            const cancelledAppt = await createAppointment(prisma, {
                businessId,
                resourceId: resource2Id,
                serviceId,
                customerId,
                startAt: new Date('2026-05-10T14:00:00Z'),
                endAt: new Date('2026-05-10T15:00:00Z'),
                occupiedEndAt: new Date('2026-05-10T15:00:00Z')
            })
            await prisma.appointment.update({
                where: { id: cancelledAppt.id },
                data: { status: 'CANCELLED' }
            })

            const appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            // Ambos deberían aparecer (admin necesita ver todos los estados)
            expect(appointments.some(a => a.id === scheduledAppt.id)).toBe(true)
            expect(appointments.some(a => a.id === cancelledAppt.id)).toBe(true)
        })
    })

    describe('ordering', () => {
        it('should return appointments ordered by startAt ascending', async () => {
            const dayStart = new Date('2026-06-10T03:00:00Z')
            const dayEnd = new Date('2026-06-11T03:00:00Z')

            // Crear turnos en orden no cronológico
            await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: new Date('2026-06-10T16:00:00Z'),
                endAt: new Date('2026-06-10T17:00:00Z'),
                occupiedEndAt: new Date('2026-06-10T17:00:00Z')
            })

            await createAppointment(prisma, {
                businessId,
                resourceId: resource2Id,
                serviceId,
                customerId,
                startAt: new Date('2026-06-10T10:00:00Z'),
                endAt: new Date('2026-06-10T11:00:00Z'),
                occupiedEndAt: new Date('2026-06-10T11:00:00Z')
            })

            await createAppointment(prisma, {
                businessId,
                resourceId,
                serviceId,
                customerId,
                startAt: new Date('2026-06-10T14:00:00Z'),
                endAt: new Date('2026-06-10T15:00:00Z'),
                occupiedEndAt: new Date('2026-06-10T15:00:00Z')
            })

            const appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd)

            // Verificar orden ascendente
            for (let i = 1; i < appointments.length; i++) {
                const prev = new Date(appointments[i - 1].startAt).getTime()
                const curr = new Date(appointments[i].startAt).getTime()
                expect(curr).toBeGreaterThanOrEqual(prev)
            }
        })
    })
})
