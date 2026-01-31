/**
 * Multi-tenant isolation tests for Appointments API
 *
 * Appointments are the most sensitive entity - they involve customer data.
 * Ownership chain: appointment → business
 *
 * Tests the real endpoints that exist:
 * - POST /appointments (create)
 * - PATCH /appointments/:id/cancel
 * - PATCH /appointments/:id/complete
 * - PATCH /appointments/:id/reschedule
 *
 * Note: There's no GET /appointments list endpoint - listing is done via Server Components.
 *
 * @see docs/user-stories.md - US-9.1
 */

import { describe, it, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

import { POST as CREATE_APPOINTMENT } from '@/app/api/v1/businesses/[businessId]/appointments/route'
import { PATCH as CANCEL_APPOINTMENT } from '@/app/api/v1/businesses/[businessId]/appointments/[appointmentId]/cancel/route'
import { PATCH as COMPLETE_APPOINTMENT } from '@/app/api/v1/businesses/[businessId]/appointments/[appointmentId]/complete/route'
import { PATCH as RESCHEDULE_APPOINTMENT } from '@/app/api/v1/businesses/[businessId]/appointments/[appointmentId]/reschedule/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { AppointmentStatus } from '@prisma/client'

import {
    setupCrossTenantScenario,
    createTenantResource,
    createTenantService,
    mockAuthForUser,
    mockAuthForbidden,
    expectForbiddenResponse,
    expectNotFoundResponse,
    CrossTenantScenario
} from '../../helpers/multi-tenant.helper'

// Helper to create a minimal appointment
async function createAppointment(
    businessId: string,
    resourceId: string,
    serviceId: string,
    startTime: Date = new Date('2030-06-15T10:00:00Z')
): Promise<string> {
    // Create a customer first
    const customer = await prisma.customer.create({
        data: {
            businessId,
            fullName: `Test Customer ${Date.now()}`,
            email: `test-${Date.now()}@example.com`
        }
    })

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000) // +1 hour
    const occupiedEndTime = new Date(startTime.getTime() + 75 * 60 * 1000) // +1h15m for buffer

    const appointment = await prisma.appointment.create({
        data: {
            businessId,
            resourceId,
            serviceId,
            customerId: customer.id,
            startAt: startTime,
            endAt: endTime,
            occupiedEndAt: occupiedEndTime,
            status: AppointmentStatus.SCHEDULED
        }
    })

    return appointment.id
}

describe('Appointments API - Multi-tenant Isolation', () => {
    let scenario: CrossTenantScenario
    let resourceA: string
    let resourceB: string
    let serviceA: string
    let serviceB: string
    let appointmentInA: string
    let appointmentInB: string

    beforeAll(async () => {
        scenario = await setupCrossTenantScenario('appointment-isolation')

        resourceA = await createTenantResource(scenario.tenantA.businessId, 'Resource A for appts')
        resourceB = await createTenantResource(scenario.tenantB.businessId, 'Resource B for appts')

        serviceA = await createTenantService(scenario.tenantA.businessId, 'Service A for appts')
        serviceB = await createTenantService(scenario.tenantB.businessId, 'Service B for appts')

        appointmentInA = await createAppointment(scenario.tenantA.businessId, resourceA, serviceA)
        appointmentInB = await createAppointment(scenario.tenantB.businessId, resourceB, serviceB)
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // =====================================================
    // POST /businesses/:businessId/appointments (Create)
    // =====================================================

    describe('POST /businesses/:businessId/appointments', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        serviceId: serviceB,
                        resourceId: resourceB,
                        startAt: '2030-07-01T10:00:00Z',
                        customer: { fullName: 'Hacked Customer' }
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await CREATE_APPOINTMENT(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to create appointment with resource from another tenant', async () => {
            // Multi-tenant user has access to B, tries to use resource from A
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        serviceId: serviceB,
                        resourceId: resourceA, // Resource from Tenant A!
                        startAt: '2030-07-01T10:00:00Z',
                        customer: { fullName: 'IDOR Test Customer', email: 'idor-resource@example.com' }
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await CREATE_APPOINTMENT(request, context)
            const body = await response.json()

            // Should fail - resource doesn't belong to business B
            expectNotFoundResponse(response, body, 'RESOURCE_NOT_FOUND')
        })

        it('returns 404 when trying to create appointment with service from another tenant', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        serviceId: serviceA, // Service from Tenant A!
                        resourceId: resourceB,
                        startAt: '2030-07-01T10:00:00Z',
                        customer: { fullName: 'IDOR Test Customer', email: 'idor-service@example.com' }
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await CREATE_APPOINTMENT(request, context)
            const body = await response.json()

            // Should fail - service doesn't belong to business B
            expectNotFoundResponse(response, body, 'SERVICE_NOT_FOUND')
        })
    })

    // =====================================================
    // PATCH /businesses/:businessId/appointments/:id/cancel
    // =====================================================

    describe('PATCH .../appointments/:appointmentId/cancel', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments/${appointmentInB}/cancel`,
                { method: 'PATCH' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    appointmentId: appointmentInB
                })
            }

            const response = await CANCEL_APPOINTMENT(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to cancel appointment from another tenant', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments/${appointmentInA}/cancel`,
                { method: 'PATCH' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    appointmentId: appointmentInA // Appointment from Tenant A!
                })
            }

            const response = await CANCEL_APPOINTMENT(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'APPOINTMENT_NOT_FOUND')
        })
    })

    // =====================================================
    // PATCH /businesses/:businessId/appointments/:id/complete
    // =====================================================

    describe('PATCH .../appointments/:appointmentId/complete', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments/${appointmentInB}/complete`,
                { method: 'PATCH' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    appointmentId: appointmentInB
                })
            }

            const response = await COMPLETE_APPOINTMENT(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to complete appointment from another tenant', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments/${appointmentInA}/complete`,
                { method: 'PATCH' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    appointmentId: appointmentInA
                })
            }

            const response = await COMPLETE_APPOINTMENT(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'APPOINTMENT_NOT_FOUND')
        })
    })

    // =====================================================
    // PATCH /businesses/:businessId/appointments/:id/reschedule
    // =====================================================

    describe('PATCH .../appointments/:appointmentId/reschedule', () => {
        let rescheduleApptA: string
        let rescheduleApptB: string

        beforeAll(async () => {
            // Create separate appointments for reschedule tests to avoid state issues
            rescheduleApptA = await createAppointment(
                scenario.tenantA.businessId,
                resourceA,
                serviceA,
                new Date('2030-08-01T10:00:00Z')
            )
            rescheduleApptB = await createAppointment(
                scenario.tenantB.businessId,
                resourceB,
                serviceB,
                new Date('2030-08-01T10:00:00Z')
            )
        })

        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments/${rescheduleApptB}/reschedule`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        newStartAt: '2030-08-02T14:00:00Z'
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    appointmentId: rescheduleApptB
                })
            }

            const response = await RESCHEDULE_APPOINTMENT(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to reschedule appointment from another tenant', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/appointments/${rescheduleApptA}/reschedule`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        newStartAt: '2030-08-02T14:00:00Z'
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    appointmentId: rescheduleApptA // Appointment from Tenant A!
                })
            }

            const response = await RESCHEDULE_APPOINTMENT(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'APPOINTMENT_NOT_FOUND')
        })
    })
})
