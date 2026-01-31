/**
 * Multi-tenant isolation tests for Blocks API
 *
 * Blocks have an indirect business ownership through resource:
 * block → resource → business
 *
 * This tests the ownership chain validation.
 *
 * @see docs/user-stories.md - US-9.1
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
    requireAuth: vi.fn()
}))

vi.mock('@/lib/auth/require-business-access', () => ({
    requireBusinessAccess: vi.fn()
}))

import { GET, POST } from '@/app/api/v1/businesses/[businessId]/resources/[resourceId]/blocks/route'
import { DELETE as DELETE_BLOCK } from '@/app/api/v1/businesses/[businessId]/resources/[resourceId]/blocks/[blockId]/route'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'

import {
    setupCrossTenantScenario,
    createTenantResource,
    mockAuthForUser,
    mockAuthForbidden,
    expectForbiddenResponse,
    expectNotFoundResponse,
    CrossTenantScenario
} from '../../helpers/multi-tenant.helper'

// Helper to create a block
async function createBlock(resourceId: string, label: string): Promise<string> {
    const block = await prisma.resourceBlock.create({
        data: {
            resourceId,
            startAt: new Date('2030-01-15T10:00:00Z'),
            endAt: new Date('2030-01-15T12:00:00Z'),
            reason: label
        }
    })
    return block.id
}

describe('Blocks API - Multi-tenant Isolation (Ownership Chain)', () => {
    let scenario: CrossTenantScenario
    let resourceA: string
    let resourceB: string
    let blockInA: string
    let blockInB: string

    beforeAll(async () => {
        scenario = await setupCrossTenantScenario('block-isolation')

        resourceA = await createTenantResource(scenario.tenantA.businessId, 'Resource A for blocks')
        resourceB = await createTenantResource(scenario.tenantB.businessId, 'Resource B for blocks')

        blockInA = await createBlock(resourceA, 'Block in Tenant A')
        blockInB = await createBlock(resourceB, 'Block in Tenant B')
    })

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // =====================================================
    // GET /businesses/:businessId/resources/:resourceId/blocks
    // =====================================================

    describe('GET .../blocks', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceB}/blocks`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceB
                })
            }

            const response = await GET(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when resource belongs to different business (IDOR on parent)', async () => {
            // User has access to B but tries to list blocks of resource from A
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceA}/blocks`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceA // Resource from Tenant A!
                })
            }

            const response = await GET(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'RESOURCE_NOT_FOUND')
        })

        it('returns ONLY blocks from the correct resource (tenant isolation)', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.tenantA.userId,
                scenario.tenantA.businessId
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantA.businessId}/resources/${resourceA}/blocks`
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantA.businessId,
                    resourceId: resourceA
                })
            }

            const response = await GET(request, context)
            const body = await response.json()

            expect(response.status).toBe(200)
            const blockIds = body.data.map((b: { id: string }) => b.id)
            expect(blockIds).toContain(blockInA)
            expect(blockIds).not.toContain(blockInB)
        })
    })

    // =====================================================
    // POST /businesses/:businessId/resources/:resourceId/blocks
    // =====================================================

    describe('POST .../blocks', () => {
        it('returns 403 when user has no access to business', async () => {
            mockAuthForbidden(vi.mocked(requireAuth), vi.mocked(requireBusinessAccess), scenario.tenantA.userId)

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceB}/blocks`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        startAt: '2030-02-01T10:00:00Z',
                        endAt: '2030-02-01T11:00:00Z',
                        reason: 'Hacked'
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceB
                })
            }

            const response = await POST(request, context)
            const body = await response.json()

            expectForbiddenResponse(response, body)
        })

        it('returns 404 when trying to create block on resource from another tenant', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceA}/blocks`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        startAt: '2030-02-01T10:00:00Z',
                        endAt: '2030-02-01T11:00:00Z',
                        reason: 'IDOR Attack'
                    }),
                    headers: { 'Content-Type': 'application/json' }
                }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceA // Resource from Tenant A!
                })
            }

            const response = await POST(request, context)
            const body = await response.json()

            expectNotFoundResponse(response, body, 'RESOURCE_NOT_FOUND')
        })
    })

    // =====================================================
    // =====================================================
    // DELETE /businesses/:businessId/resources/:resourceId/blocks/:blockId
    // Note: There's no PATCH endpoint for blocks in this API
    // =====================================================

    describe('DELETE .../blocks/:blockId', () => {
        it('returns 404 when trying to delete block from another tenant', async () => {
            mockAuthForUser(
                vi.mocked(requireAuth),
                vi.mocked(requireBusinessAccess),
                scenario.multiTenantUserId,
                scenario.tenantB.businessId,
                'STAFF'
            )

            const request = new NextRequest(
                `http://localhost/api/v1/businesses/${scenario.tenantB.businessId}/resources/${resourceA}/blocks/${blockInA}`,
                { method: 'DELETE' }
            )
            const context = {
                params: Promise.resolve({
                    businessId: scenario.tenantB.businessId,
                    resourceId: resourceA,
                    blockId: blockInA
                })
            }

            const response = await DELETE_BLOCK(request, context)
            const body = await response.json()

            // Block route validates resource ownership first, then block ownership
            // When resource belongs to wrong business, it returns BLOCK_NOT_FOUND to avoid info leakage
            expectNotFoundResponse(response, body, 'BLOCK_NOT_FOUND')
        })
    })
})
