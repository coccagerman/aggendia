/**
 * ServiceResources domain service - Business logic for Service ↔ Resource relationships
 */

import { PrismaClient } from '@prisma/client'
import { findActiveBusinessBySlug } from '@/data/repositories/business.repo'
import { getActiveResourcesByServiceId } from '@/data/repositories/serviceResource.repo'
import { AppError, ServiceErrorCodes, BusinessErrorCodes } from '@/domain/common/errors'
import type { PublicResourceSummary } from './serviceResource.types'

/**
 * Response type for public service resources query
 */
export type PublicServiceResourcesResult = {
    service: {
        id: string
        name: string
    }
    resources: PublicResourceSummary[]
    resourceLabel: string
}

/**
 * Gets ACTIVE resources assigned to a service for public booking flow
 * Validates business, service status, and filters only ACTIVE resources
 *
 * @param prisma - Prisma client
 * @param slug - Business slug (public identifier)
 * @param serviceId - Service ID (must be valid UUID)
 * @returns Service info + active resources + resource label
 * @throws AppError if business not found, service not found/inactive, or invalid serviceId
 */
export async function getPublicServiceResources(
    prisma: PrismaClient,
    slug: string,
    serviceId: string
): Promise<PublicServiceResourcesResult> {
    // Validate serviceId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(serviceId)) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
    }

    // Find business by slug
    const business = await findActiveBusinessBySlug(prisma, slug)
    if (!business) {
        throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado', 404)
    }

    // Find service (must be ACTIVE and belong to business)
    const service = await prisma.service.findFirst({
        where: {
            id: serviceId,
            businessId: business.id,
            status: 'ACTIVE'
        },
        select: {
            id: true,
            name: true
        }
    })

    if (!service) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
    }

    // Get ACTIVE resources assigned to this service
    const resources = await getActiveResourcesByServiceId(prisma, business.id, serviceId)

    return {
        service: {
            id: service.id,
            name: service.name
        },
        resources,
        resourceLabel: business.resourceLabel
    }
}
