/**
 * Multi-tenant isolation tests for Resources API
 *
 * Tests that verify:
 * - 403 when user has no membership in the business
 * - 404 when accessing resource from another tenant (IDOR protection)
 * - Listados only return resources from the requested business
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

// Import route handlers AFTER mocks
import { GET, POST } from '@/app/api/v1/businesses/[businessId]/resources/route'
import {
    GET as GET_RESOURCE,
    PATCH as PATCH_RESOURCE,
    DELETE as DELETE_RESOURCE
} from '@/app/api/v1/businesses/[businessId]/resources/[resourceId]/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'

// Import helpers
import {
    setupCrossTenantScenario,
    createTenantResource,
    mockAuthForUser,
    mockAuthForbidden,
    expectForbiddenResponse,
    expectNotFoundResponse,
    CrossTenantScenario
} from '../../helpers/multi-tenant.helper'

describe('Resources API - Multi-tenant Isolation', () => {
    let scenario: CrossTenantScenario
    let resourceInTenantA: string
    let resourceInTenantB: string

    beforeAll(async () => {
        // Set up cross-tenant scenario
        scenario = await setupCrossTenantScenario('resource-isolation')

        // Create resources in each tenant
        resourceInTenantA = await createTenantResource(scenario.tenantA.businessId, 'Resource in Tenant A')
        resourceInTenantB = await createTenantResource(scenario.tenantB.businessId, 'Resource in Tenant B')
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // =====================================================
    // GET /businesses/:businessId/resources (List)
    // =====================================================

    describe('GET /businesses/:businessId/resources', () => {
        it('returns 403 when user has no access to business', async () => {
            // User A tries to list resources in Tenant B
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources`
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await GET(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns ONLY resources from the requested business (tenant isolation)', async () => {
            // User A lists resources in Tenant A - should only see Tenant A resources
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.tenantA.userId,
                scenario.tenantA.businessId
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantA.businessId}/resources`
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantA.businessId }) }

            const response = await GET(request, context)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.data).toBeDefined()
            expect(Array.isArray(body.data)).toBe(true)

            // Should include resource from Tenant A
            const resourceIds = body.data.map((r: { id: string }) => r.id)
            expect(resourceIds).toContain(resourceInTenantA)

            // Should NOT include resource from Tenant B
            expect(resourceIds).not.toContain(resourceInTenantB)
        })
    })

    // =====================================================
    // GET /businesses/:businessId/resources/:resourceId
    // =====================================================

    describe('GET /businesses/:businessId/resources/:resourceId', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceInTenantB}`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceInTenantB
                })
            }

            const response = await GET_RESOURCE(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when resource belongs to different business (IDOR protection)', async () => {
            // Multi-tenant user is member of both A and B
            // Tries to access resource from A using business B's endpoint
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceInTenantA}`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceInTenantA // Resource from Tenant A!
                })
            }

            const response = await GET_RESOURCE(request, context)
            const body = await response.json()

            // Should return 404 (not 403) to avoid revealing resource exists in another tenant
            expectNotFoundResponse(response, body, 'RESOURCE_NOT_FOUND')
        })

        it('returns 200 when user has access and resource belongs to the business', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.tenantA.userId,
                scenario.tenantA.businessId
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantA.businessId}/resources/${resourceInTenantA}`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantA.businessId,
                    resourceId: resourceInTenantA
                })
            }

            const response = await GET_RESOURCE(request, context)
            const body = await response.json()

            expect(response.status).toBe(200)
            expect(body.data.id).toBe(resourceInTenantA)
        })
    })

    // =====================================================
    // POST /businesses/:businessId/resources
    // =====================================================

    describe('POST /businesses/:businessId/resources', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources`,
                {
                    method: 'POST',
                    body: JSON.stringify({ name: 'New Resource' }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantB.businessId }) }

            const response = await POST(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('creates resource in the correct business when authorized', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.tenantA.userId,
                scenario.tenantA.businessId
            )

            const resourceName = `Cross Tenant Test Resource ${Date.now()}`
            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantA.businessId}/resources`,
                {
                    method: 'POST',
                    body: JSON.stringify({ name: resourceName }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = { params: Promise.resolve({ businessId: scenario.tenantA.businessId }) }

            const response = await POST(request, context)
            const body = await response.json()

            expect(response.status).toBe(201)
            expect(body.data.name).toBe(resourceName)
            expect(body.data.businessId).toBe(scenario.tenantA.businessId)
        })
    })

    // =====================================================
    // PATCH /businesses/:businessId/resources/:resourceId
    // =====================================================

    describe('PATCH /businesses/:businessId/resources/:resourceId', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceInTenantB}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ name: 'Hacked Name' }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceInTenantB
                })
            }

            const response = await PATCH_RESOURCE(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to modify resource from another tenant (IDOR protection)', async () => {
            // Multi-tenant user tries to modify resource A from business B context
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceInTenantA}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ name: 'Attempted IDOR Attack' }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceInTenantA
                })
            }

            const response = await PATCH_RESOURCE(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'RESOURCE_NOT_FOUND')
        })
    })

    // =====================================================
    // DELETE /businesses/:businessId/resources/:resourceId
    // =====================================================

    describe('DELETE /businesses/:businessId/resources/:resourceId', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceInTenantB}`,
                { method: 'DELETE' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceInTenantB
                })
            }

            const response = await DELETE_RESOURCE(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to delete resource from another tenant (IDOR protection)', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceInTenantA}`,
                { method: 'DELETE' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceInTenantA
                })
            }

            const response = await DELETE_RESOURCE(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'RESOURCE_NOT_FOUND')
        })
    })
})
