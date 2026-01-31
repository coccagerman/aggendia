/**
 * Helper functions for multi-tenant isolation tests
 *
 * Provides utilities for setting up cross-tenant test scenarios
 * and asserting proper isolation behavior.
 *
 * @see docs/user-stories.md - US-9.1
 */

import { vi, expect } from 'vitest'
import { BusinessRole } from '@prisma/client'
import { prisma } from '@/data/prisma/prisma'
import { createBusinessWithOwner } from '@/data/repositories/business.repo'
import { createResource } from '@/data/repositories/resource.repo'
import { createService } from '@/data/repositories/service.repo'
import { AppError, AuthErrorCodes } from '@/domain/common/errors'

const TIMEZONE = 'America/Argentina/Buenos_Aires'

export interface TenantFixture {
    businessId: string
    businessSlug: string
    userId: string
    resourceId?: string
    serviceId?: string
}

export interface CrossTenantScenario {
    tenantA: TenantFixture
    tenantB: TenantFixture
    /** User that is member of BOTH tenants (for IDOR tests) */
    multiTenantUserId: string
}

/**
 * Creates two isolated tenants for cross-tenant testing.
 * Also creates a user that is member of both (for IDOR scenarios).
 */
export async function setupCrossTenantScenario(testPrefix: string): Promise<CrossTenantScenario> {
    const timestamp = Date.now()

    // Create Tenant A with User A
    const userIdA = `${testPrefix}-user-a-${timestamp}`
    const bizA = await createBusinessWithOwner(
        prisma,
        {
            name: `Tenant A ${timestamp}`,
            timezone: TIMEZONE,
            resourceLabel: 'Profesional'
        },
        `${testPrefix}-tenant-a-${timestamp}`,
        userIdA
    )

    // Create Tenant B with User B
    const userIdB = `${testPrefix}-user-b-${timestamp}`
    const bizB = await createBusinessWithOwner(
        prisma,
        {
            name: `Tenant B ${timestamp}`,
            timezone: TIMEZONE,
            resourceLabel: 'Recurso'
        },
        `${testPrefix}-tenant-b-${timestamp}`,
        userIdB
    )

    // Create multi-tenant user (member of both)
    const multiTenantUserId = `${testPrefix}-multi-user-${timestamp}`
    await prisma.businessMember.create({
        data: {
            businessId: bizA.business.id,
            userId: multiTenantUserId,
            role: 'STAFF'
        }
    })
    await prisma.businessMember.create({
        data: {
            businessId: bizB.business.id,
            userId: multiTenantUserId,
            role: 'STAFF'
        }
    })

    return {
        tenantA: {
            businessId: bizA.business.id,
            businessSlug: bizA.business.slug,
            userId: userIdA
        },
        tenantB: {
            businessId: bizB.business.id,
            businessSlug: bizB.business.slug,
            userId: userIdB
        },
        multiTenantUserId
    }
}

/**
 * Creates a resource in the specified tenant
 */
export async function createTenantResource(businessId: string, name: string): Promise<string> {
    const resource = await createResource(prisma, businessId, {
        name,
        status: 'ACTIVE'
    })
    return resource.id
}

/**
 * Creates a service in the specified tenant
 */
export async function createTenantService(businessId: string, name: string): Promise<string> {
    const service = await createService(prisma, businessId, {
        name,
        durationMinutes: 60,
        slotIntervalMinutes: 60
    })
    return service.id
}

/**
 * Mock auth to simulate a specific user accessing a specific business
 */
export function mockAuthForUser(
    requireAuthMock: ReturnType<typeof vi.fn>,
    requireBusinessAccessMock: ReturnType<typeof vi.fn>,
    userId: string,
    businessId: string,
    role: BusinessRole = 'OWNER'
) {
    requireAuthMock.mockResolvedValue({
        userId,
        email: `${userId}@test.com`
    })
    requireBusinessAccessMock.mockResolvedValue({
        role,
        businessId
    })
}

/**
 * Mock auth to simulate a user WITHOUT access to the business (403 scenario)
 *
 * This mock simulates what requireBusinessAccess throws when user doesn't have access.
 * Must throw a real AppError instance for proper handling by route handlers.
 */
export function mockAuthForbidden(
    requireAuthMock: ReturnType<typeof vi.fn>,
    requireBusinessAccessMock: ReturnType<typeof vi.fn>,
    userId: string
) {
    requireAuthMock.mockResolvedValue({
        userId,
        email: `${userId}@test.com`
    })
    // Throw real AppError instance for instanceof check in route handlers
    requireBusinessAccessMock.mockRejectedValue(
        new AppError(AuthErrorCodes.FORBIDDEN, 'No tenés acceso a este negocio.', 403)
    )
}

/**
 * Assert that response is a 403 Forbidden with standard error shape
 */
export function expectForbiddenResponse(response: { status: number }, body: unknown) {
    expect(response.status).toBe(403)
    expect(body).toMatchObject({
        error: {
            code: 'AUTH_FORBIDDEN',
            message: expect.any(String)
        }
    })
}

/**
 * Assert that response is a 404 Not Found with standard error shape
 */
export function expectNotFoundResponse(response: { status: number }, body: unknown, expectedCode?: string) {
    expect(response.status).toBe(404)
    expect(body).toMatchObject({
        error: {
            code: expectedCode ?? expect.stringMatching(/_NOT_FOUND$/),
            message: expect.any(String)
        }
    })
}

/**
 * Assert that response has standard error shape
 */
export function expectStandardErrorShape(body: unknown) {
    expect(body).toMatchObject({
        error: {
            code: expect.any(String),
            message: expect.any(String)
        }
    })
}

/**
 * Clean up test data created by setupCrossTenantScenario
 * Note: Usually not needed if using test DB reset between suites
 */
export async function cleanupCrossTenantScenario(scenario: CrossTenantScenario) {
    // Delete in reverse order of dependencies
    await prisma.businessMember.deleteMany({
        where: {
            businessId: { in: [scenario.tenantA.businessId, scenario.tenantB.businessId] }
        }
    })
    await prisma.business.deleteMany({
        where: {
            id: { in: [scenario.tenantA.businessId, scenario.tenantB.businessId] }
        }
    })
}
