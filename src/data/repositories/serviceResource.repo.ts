/**
 * ServiceResource repository - Data access layer for Service ↔ Resource links
 */

import { PrismaClient } from '@prisma/client'
import type {
    ServiceResource,
    ServiceResourceWithResource,
    LinkedResourceSummary,
    PublicResourceSummary
} from '@/domain/serviceResources/serviceResource.types'
import { AppError, ServiceResourceErrorCodes, ServiceErrorCodes, ResourceErrorCodes } from '@/domain/common/errors'

/**
 * Obtiene todos los recursos asociados a un servicio con sus datos
 * @param prisma - Prisma client
 * @param businessId - ID del negocio (para validación de tenant)
 * @param serviceId - ID del servicio
 * @returns Lista de ServiceResourceWithResource ordenada por nombre del recurso
 */
export async function getResourcesByServiceId(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string
): Promise<ServiceResourceWithResource[]> {
    return prisma.serviceResource.findMany({
        where: {
            businessId,
            serviceId
        },
        include: {
            resource: true
        },
        orderBy: {
            resource: {
                name: 'asc'
            }
        }
    })
}

/**
 * Obtiene resumen de recursos asociados a un servicio (para listados)
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @returns Lista de LinkedResourceSummary
 */
export async function getLinkedResourceSummaries(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string
): Promise<LinkedResourceSummary[]> {
    const links = await prisma.serviceResource.findMany({
        where: {
            businessId,
            serviceId
        },
        include: {
            resource: {
                select: {
                    id: true,
                    name: true,
                    status: true
                }
            }
        },
        orderBy: {
            resource: {
                name: 'asc'
            }
        }
    })

    return links.map(link => ({
        resourceId: link.resource.id,
        resourceName: link.resource.name,
        resourceStatus: link.resource.status
    }))
}

/**
 * Obtiene los IDs de servicios que tienen al menos un recurso asociado
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @returns Set de serviceIds con recursos
 */
export async function getServiceIdsWithResources(prisma: PrismaClient, businessId: string): Promise<Set<string>> {
    const links = await prisma.serviceResource.findMany({
        where: { businessId },
        select: { serviceId: true },
        distinct: ['serviceId']
    })
    return new Set(links.map(link => link.serviceId))
}

/**
 * Cuenta la cantidad de recursos asociados a cada servicio
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceIds - Lista de IDs de servicios a consultar
 * @returns Map de serviceId -> cantidad de recursos
 */
export async function countResourcesByServiceIds(
    prisma: PrismaClient,
    businessId: string,
    serviceIds: string[]
): Promise<Map<string, number>> {
    const counts = await prisma.serviceResource.groupBy({
        by: ['serviceId'],
        where: {
            businessId,
            serviceId: { in: serviceIds }
        },
        _count: {
            resourceId: true
        }
    })

    const result = new Map<string, number>()
    for (const count of counts) {
        result.set(count.serviceId, count._count.resourceId)
    }
    return result
}

/**
 * Asocia un recurso a un servicio
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @param resourceId - ID del recurso a asociar
 * @returns ServiceResource creado
 * @throws AppError si el servicio o recurso no existe o ya está asociado
 */
export async function addResourceToService(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string,
    resourceId: string
): Promise<ServiceResource> {
    // Verificar que el servicio existe y pertenece al negocio
    const service = await prisma.service.findFirst({
        where: { id: serviceId, businessId, status: { not: 'DELETED' } }
    })
    if (!service) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
    }

    // Verificar que el recurso existe, pertenece al negocio y no está eliminado
    const resource = await prisma.resource.findFirst({
        where: { id: resourceId, businessId, status: { not: 'DELETED' } }
    })
    if (!resource) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado', 404)
    }

    // Verificar que no exista ya la asociación
    const existing = await prisma.serviceResource.findFirst({
        where: { serviceId, resourceId }
    })
    if (existing) {
        throw new AppError(
            ServiceResourceErrorCodes.SERVICE_RESOURCE_ALREADY_EXISTS,
            'El recurso ya está asociado a este servicio',
            409
        )
    }

    return prisma.serviceResource.create({
        data: {
            businessId,
            serviceId,
            resourceId
        }
    })
}

/**
 * Elimina la asociación de un recurso con un servicio
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @param resourceId - ID del recurso a desasociar
 * @returns ServiceResource eliminado
 * @throws AppError si la asociación no existe
 */
export async function removeResourceFromService(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string,
    resourceId: string
): Promise<ServiceResource> {
    const link = await prisma.serviceResource.findFirst({
        where: { businessId, serviceId, resourceId }
    })
    if (!link) {
        throw new AppError(
            ServiceResourceErrorCodes.SERVICE_RESOURCE_NOT_FOUND,
            'El recurso no está asociado a este servicio',
            404
        )
    }

    return prisma.serviceResource.delete({
        where: { id: link.id }
    })
}

/**
 * Reemplaza todos los recursos asociados a un servicio (bulk update)
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @param resourceIds - Lista de IDs de recursos a asociar (reemplaza los existentes)
 * @returns Lista de ServiceResource creados
 * @throws AppError si el servicio no existe o algún recurso no es válido
 */
export async function setServiceResources(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string,
    resourceIds: string[]
): Promise<ServiceResource[]> {
    // Verificar que el servicio existe y pertenece al negocio
    const service = await prisma.service.findFirst({
        where: { id: serviceId, businessId, status: { not: 'DELETED' } }
    })
    if (!service) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
    }

    // Verificar que todos los recursos existen, pertenecen al negocio y no están eliminados
    if (resourceIds.length > 0) {
        const validResources = await prisma.resource.findMany({
            where: {
                id: { in: resourceIds },
                businessId,
                status: { not: 'DELETED' }
            },
            select: { id: true }
        })

        const validIds = new Set(validResources.map(r => r.id))
        const invalidIds = resourceIds.filter(id => !validIds.has(id))

        if (invalidIds.length > 0) {
            throw new AppError(
                ServiceResourceErrorCodes.SERVICE_RESOURCE_INVALID_RESOURCE,
                `Recursos no válidos: ${invalidIds.join(', ')}`,
                400,
                { invalidResourceIds: invalidIds }
            )
        }
    }

    // Transacción: eliminar todas las asociaciones existentes y crear las nuevas
    return prisma.$transaction(async tx => {
        // Eliminar asociaciones existentes
        await tx.serviceResource.deleteMany({
            where: { businessId, serviceId }
        })

        // Si no hay recursos a asociar, retornar vacío
        if (resourceIds.length === 0) {
            return []
        }

        // Crear nuevas asociaciones
        await tx.serviceResource.createMany({
            data: resourceIds.map(resourceId => ({
                businessId,
                serviceId,
                resourceId
            }))
        })

        // Retornar las asociaciones creadas
        return tx.serviceResource.findMany({
            where: { businessId, serviceId }
        })
    })
}

/**
 * Obtiene los IDs de recursos asociados a un servicio
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @returns Array de resourceIds
 */
export async function getResourceIdsByServiceId(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string
): Promise<string[]> {
    const links = await prisma.serviceResource.findMany({
        where: { businessId, serviceId },
        select: { resourceId: true }
    })
    return links.map(link => link.resourceId)
}

/**
 * Obtiene los IDs de recursos asociados a múltiples servicios (batch)
 * Evita N+1 queries al hacer una sola consulta para todos los servicios
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceIds - Lista de IDs de servicios
 * @returns Map de serviceId -> array de resourceIds
 */
export async function getResourceIdsByServiceIds(
    prisma: PrismaClient,
    businessId: string,
    serviceIds: string[]
): Promise<Map<string, string[]>> {
    if (serviceIds.length === 0) {
        return new Map()
    }

    const links = await prisma.serviceResource.findMany({
        where: {
            businessId,
            serviceId: { in: serviceIds }
        },
        select: { serviceId: true, resourceId: true }
    })

    const result = new Map<string, string[]>()
    // Inicializar todos los serviceIds con arrays vacíos
    for (const serviceId of serviceIds) {
        result.set(serviceId, [])
    }
    // Poblar con los resultados
    for (const link of links) {
        result.get(link.serviceId)!.push(link.resourceId)
    }
    return result
}

/**
 * Obtiene los IDs de servicios asociados a un recurso
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param resourceId - ID del recurso
 * @returns Array de serviceIds
 */
export async function getServiceIdsByResourceId(
    prisma: PrismaClient,
    businessId: string,
    resourceId: string
): Promise<string[]> {
    const links = await prisma.serviceResource.findMany({
        where: { businessId, resourceId },
        select: { serviceId: true }
    })
    return links.map(link => link.serviceId)
}

/**
 * Reemplaza todos los servicios asociados a un recurso (bulk update)
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param resourceId - ID del recurso
 * @param serviceIds - Lista de IDs de servicios a asociar (reemplaza los existentes)
 * @returns Lista de ServiceResource creados
 * @throws AppError si el recurso no existe o algún servicio no es válido
 */
export async function setResourceServices(
    prisma: PrismaClient,
    businessId: string,
    resourceId: string,
    serviceIds: string[]
): Promise<ServiceResource[]> {
    // Verificar que el recurso existe, pertenece al negocio y no está eliminado
    const resource = await prisma.resource.findFirst({
        where: { id: resourceId, businessId, status: { not: 'DELETED' } }
    })
    if (!resource) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado', 404)
    }

    // Verificar que todos los servicios existen, pertenecen al negocio y no están eliminados
    if (serviceIds.length > 0) {
        const validServices = await prisma.service.findMany({
            where: {
                id: { in: serviceIds },
                businessId,
                status: { not: 'DELETED' }
            },
            select: { id: true }
        })

        const validIds = new Set(validServices.map(s => s.id))
        const invalidIds = serviceIds.filter(id => !validIds.has(id))

        if (invalidIds.length > 0) {
            throw new AppError(
                ServiceResourceErrorCodes.SERVICE_RESOURCE_INVALID_SERVICE,
                `Servicios no válidos: ${invalidIds.join(', ')}`,
                400,
                { invalidServiceIds: invalidIds }
            )
        }
    }

    // Transacción: eliminar todas las asociaciones existentes y crear las nuevas
    return prisma.$transaction(async tx => {
        // Eliminar asociaciones existentes
        await tx.serviceResource.deleteMany({
            where: { businessId, resourceId }
        })

        // Si no hay servicios a asociar, retornar vacío
        if (serviceIds.length === 0) {
            return []
        }

        // Crear nuevas asociaciones
        await tx.serviceResource.createMany({
            data: serviceIds.map(serviceId => ({
                businessId,
                serviceId,
                resourceId
            }))
        })

        // Retornar las asociaciones creadas
        return tx.serviceResource.findMany({
            where: { businessId, resourceId }
        })
    })
}

/**
 * Obtiene recursos ACTIVE asignados a un servicio (para UI pública)
 * Solo devuelve recursos con status ACTIVE (no INACTIVE ni DELETED)
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @returns Lista de PublicResourceSummary ordenada por nombre
 */
export async function getActiveResourcesByServiceId(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string
): Promise<PublicResourceSummary[]> {
    const links = await prisma.serviceResource.findMany({
        where: {
            businessId,
            serviceId,
            resource: {
                status: 'ACTIVE'
            }
        },
        include: {
            resource: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            }
        },
        orderBy: {
            resource: {
                name: 'asc'
            }
        }
    })

    return links.map(link => ({
        id: link.resource.id,
        name: link.resource.name,
        type: link.resource.type
    }))
}

/**
 * Cuenta servicios que tienen al menos un recurso ACTIVE asignado
 * Útil para filtrar servicios "reservables" en la UI pública
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceIds - Lista de IDs de servicios a verificar
 * @returns Set de serviceIds que tienen recursos activos
 */
export async function getServiceIdsWithActiveResources(
    prisma: PrismaClient,
    businessId: string,
    serviceIds: string[]
): Promise<Set<string>> {
    if (serviceIds.length === 0) {
        return new Set()
    }

    const links = await prisma.serviceResource.findMany({
        where: {
            businessId,
            serviceId: { in: serviceIds },
            resource: {
                status: 'ACTIVE'
            }
        },
        select: { serviceId: true },
        distinct: ['serviceId']
    })

    return new Set(links.map(link => link.serviceId))
}

/**
 * Elimina todas las asociaciones Service-Resource de un recurso.
 * Se usa cuando se elimina un recurso (soft delete) para limpiar las relaciones.
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param resourceId - ID del recurso
 * @returns Cantidad de asociaciones eliminadas
 */
export async function removeAllServiceLinksForResource(
    prisma: PrismaClient,
    businessId: string,
    resourceId: string
): Promise<number> {
    const result = await prisma.serviceResource.deleteMany({
        where: {
            businessId,
            resourceId
        }
    })
    return result.count
}
