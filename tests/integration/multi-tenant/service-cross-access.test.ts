/**
 * Multi-tenant isolation tests for Services API
 *
 * Tests that verify tenant isolation for services.
 * Services have a direct businessId, similar to resources.
 *
 * @see docs/user-stories.md - US-9.1
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth modules BEFORE importing route handlers
vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

import { GET, POST } from '@/app/api/v1/businesses/[businessId]/services/route'
import {
    GET as GET_SERVICE,
    PATCH as PATCH_SERVICE,
    DELETE as DELETE_SERVICE
} from '@/app/api/v1/businesses/[businessId]/services/[serviceId]/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'

import {
    setupCrossTenantScenario,
    createTenantService,
    mockAuthForUser,
    mockAuthForbidden,
    expectForbiddenResponse,
    expectNotFoundResponse,
    CrossTenantScenario
} from '../../helpers/multi-tenant.helper'

describe('Services API - Multi-tenant Isolation', () => {
    let scenario: CrossTenantScenario
    let serviceInTenantA: string
    let serviceInTenantB: string

    beforeAll(async () => {
        scenario = await setupCrossTenantScenario('service-isolation')

        serviceInTenantA = await createTenantService(scenario.tenantA.businessId, 'Service in Tenant A')
        serviceInTenantB = await createTenantService(scenario.tenantB.businessId, 'Service in Tenant B')
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // =====================================================
    // GET /businesses/:businessId/services (List)
    // =====================================================

    describe('GET /businesses/:businessId/services', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/services`
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await GET(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns ONLY services from the requested business (tenant isolation)', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.tenantA.userId,
                scenario.tenantA.businessId
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantA.businessId}/services`
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantA.businessId }) }

            const response = await GET(request, context)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.data).toBeDefined()

            const serviceIds = body.data.map((s: { id: string }) => s.id)
            expect(serviceIds).toContain(serviceInTenantA)
            expect(serviceIds).not.toContain(serviceInTenantB)
        })
    })

    // =====================================================
    // GET /businesses/:businessId/services/:serviceId
    // =====================================================

    describe('GET /businesses/:businessId/services/:serviceId', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/services/${serviceInTenantB}`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    serviceId: serviceInTenantB
                })
            }

            const response = await GET_SERVICE(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when service belongs to different business (IDOR protection)', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/services/${serviceInTenantA}`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    serviceId: serviceInTenantA
                })
            }

            const response = await GET_SERVICE(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'SERVICE_NOT_FOUND')
        })

        it('returns 200 when user has access and service belongs to business', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.tenantA.userId,
                scenario.tenantA.businessId
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantA.businessId}/services/${serviceInTenantA}`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantA.businessId,
                    serviceId: serviceInTenantA
                })
            }

            const response = await GET_SERVICE(request, context)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.data.id).toBe(serviceInTenantA)
        })
    })

    // =====================================================
    // POST /businesses/:businessId/services
    // =====================================================

    describe('POST /businesses/:businessId/services', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/services`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        name: 'Hacked Service',
                        durationMinutes: 30,
                        slotIntervalMinutes: 30,
                        priceCents: 1000
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await POST(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })
    })

    // =====================================================
    // PATCH /businesses/:businessId/services/:serviceId
    // =====================================================

    describe('PATCH /businesses/:businessId/services/:serviceId', () => {
        it('returns 404 when trying to modify service from another tenant (IDOR protection)', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/services/${serviceInTenantA}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ name: 'IDOR Attack' }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    serviceId: serviceInTenantA
                })
            }

            const response = await PATCH_SERVICE(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'SERVICE_NOT_FOUND')
        })
    })

    // =====================================================
    // DELETE /businesses/:businessId/services/:serviceId
    // =====================================================

    describe('DELETE /businesses/:businessId/services/:serviceId', () => {
        it('returns 404 when trying to delete service from another tenant (IDOR protection)', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/services/${serviceInTenantA}`,
                { method: 'DELETE' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    serviceId: serviceInTenantA
                })
            }

            const response = await DELETE_SERVICE(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'SERVICE_NOT_FOUND')
        })
    })
})
