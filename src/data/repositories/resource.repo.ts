import { PrismaClient } from '@prisma/client'
import { Resource, CreateResourceInput, UpdateResourceInput } from '@/domain/resources/resource.types'
import { AppError, ResourceErrorCodes, ValidationErrorCodes, SystemErrorCodes } from '@/domain/common/errors'
import { removeAllServiceLinksForResource } from './serviceResource.repo'

function ensureResourceClient(prisma: PrismaClient): PrismaClient {
    if ((prisma as unknown as { resource?: unknown }).resource) {
        return prisma
    }

    // Fallback defensivo: re-instanciar PrismaClient directo si el adaptador global no tiene el modelo
    const fallback = new PrismaClient()
    if (!(fallback as unknown as { resource?: unknown }).resource) {
        throw new AppError(SystemErrorCodes.DB_ERROR, 'Prisma Client no inicializado para Resource.', 500)
    }
    return fallback
}

/**
 * Crea un recurso asociado a un negocio.
 */
export async function createResource(
    prisma: PrismaClient,
    businessId: string,
    input: CreateResourceInput
): Promise<Resource> {
    const client = ensureResourceClient(prisma)

    // Verificar que no exista un recurso activo/inactivo con el mismo nombre
    const existingWithSameName = await client.resource.findFirst({
        where: {
            businessId,
            name: input.name.trim(),
            status: { not: 'DELETED' }
        }
    })
    if (existingWithSameName) {
        throw new AppError(
            ResourceErrorCodes.RESOURCE_NAME_CONFLICT,
            'Ya existe un recurso activo o inactivo con ese nombre en este negocio.',
            409
        )
    }

    return client.resource.create({
        data: {
            businessId,
            name: input.name.trim(),
            type: input.type ?? null,
            status: input.status ?? 'ACTIVE'
        }
    })
}

/**
 * Obtiene todos los recursos activos e inactivos de un negocio (excluye DELETED).
 */
export async function getResourcesByBusinessId(prisma: PrismaClient, businessId: string): Promise<Resource[]> {
    const client = ensureResourceClient(prisma)
    return client.resource.findMany({
        where: {
            businessId,
            status: {
                not: 'DELETED'
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    })
}

/**
 * Obtiene todos los recursos para un conjunto de negocios (excluye DELETED).
 */
export async function getResourcesByBusinessIds(prisma: PrismaClient, businessIds: string[]): Promise<Resource[]> {
    if (businessIds.length === 0) return []

    const client = ensureResourceClient(prisma)

    return client.resource.findMany({
        where: {
            businessId: {
                in: businessIds
            },
            status: {
                not: 'DELETED'
            }
        },
        orderBy: {
            createdAt: 'asc'
        }
    })
}

/**
 * Obtiene los recursos agrupados por negocio (excluye DELETED).
 */
export async function getResourcesByBusinessIdsMap(
    prisma: PrismaClient,
    businessIds: string[]
): Promise<Record<string, Resource[]>> {
    const resources = await getResourcesByBusinessIds(prisma, businessIds)
    return resources.reduce<Record<string, Resource[]>>((acc, resource) => {
        acc[resource.businessId] = acc[resource.businessId] || []
        acc[resource.businessId].push(resource)
        return acc
    }, {})
}

/**
 * Obtiene un recurso por ID (verifica que pertenezca al negocio).
 * Excluye recursos con status DELETED.
 */
export async function getResourceById(
    prisma: PrismaClient,
    businessId: string,
    resourceId: string
): Promise<Resource | null> {
    const client = ensureResourceClient(prisma)
    return client.resource.findFirst({
        where: {
            id: resourceId,
            businessId,
            status: {
                not: 'DELETED'
            }
        }
    })
}

/**
 * Actualiza un recurso.
 */
export async function updateResource(
    prisma: PrismaClient,
    businessId: string,
    resourceId: string,
    input: UpdateResourceInput
): Promise<Resource> {
    const client = ensureResourceClient(prisma)
    const existing = await client.resource.findFirst({
        where: {
            id: resourceId,
            businessId,
            status: { not: 'DELETED' }
        }
    })

    if (!existing) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado.', 404)
    }

    // Si se cambia el nombre, verificar que no exista otro recurso activo/inactivo con ese nombre
    if (input.name && input.name.trim() !== existing.name) {
        const existingWithSameName = await client.resource.findFirst({
            where: {
                businessId,
                name: input.name.trim(),
                status: { not: 'DELETED' },
                id: { not: resourceId }
            }
        })
        if (existingWithSameName) {
            throw new AppError(
                ResourceErrorCodes.RESOURCE_NAME_CONFLICT,
                'Ya existe un recurso activo o inactivo con ese nombre en este negocio.',
                409
            )
        }
    }

    const data: Partial<Resource> = {
        ...(input.name && { name: input.name.trim() }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.status && { status: input.status })
    }

    if (Object.keys(data).length === 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'No hay cambios para aplicar.', 400)
    }

    const result = await client.resource.updateMany({
        where: {
            id: resourceId,
            businessId
        },
        data
    })

    if (result.count === 0) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado.', 404)
    }

    const updated = await client.resource.findUnique({ where: { id: resourceId } })
    if (!updated) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado.', 404)
    }

    return updated
}

/**
 * Elimina un recurso (soft delete: cambia status a DELETED).
 * También elimina todas las asociaciones ServiceResource del recurso.
 */
export async function deleteResource(prisma: PrismaClient, businessId: string, resourceId: string): Promise<void> {
    const client = ensureResourceClient(prisma)

    // Verificar que el recurso existe antes de proceder
    const existing = await client.resource.findFirst({
        where: {
            id: resourceId,
            businessId,
            status: { not: 'DELETED' }
        }
    })

    if (!existing) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado.', 404)
    }

    // Eliminar todas las asociaciones Service-Resource del recurso
    await removeAllServiceLinksForResource(client, businessId, resourceId)

    // Hacer soft delete del recurso
    await client.resource.update({
        where: { id: resourceId },
        data: { status: 'DELETED' }
    })
}
