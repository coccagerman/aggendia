/**
 * Service repository - Data access layer
 */

import { PrismaClient } from '@prisma/client'
import { Service, CreateServiceInput, UpdateServiceInput } from '@/domain/services/service.types'
import { validateCreateServiceInput, validateUpdateServiceInput } from '@/domain/services/service.service'
import { AppError, ServiceErrorCodes } from '@/domain/common/errors'

/**
 * Obtiene servicios activos de un negocio (para página pública)
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @returns Lista de servicios activos ordenados por nombre
 */
export async function getActiveServicesByBusinessId(prisma: PrismaClient, businessId: string): Promise<Service[]> {
    return prisma.service.findMany({
        where: {
            businessId,
            status: 'ACTIVE'
        },
        orderBy: { name: 'asc' }
    })
}

/**
 * Obtiene todos los servicios de un negocio (admin view)
 * Excluye servicios DELETED
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @returns Lista de todos los servicios (activos e inactivos, no eliminados)
 */
export async function getServicesByBusinessId(prisma: PrismaClient, businessId: string): Promise<Service[]> {
    return prisma.service.findMany({
        where: {
            businessId,
            status: { not: 'DELETED' }
        },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Obtiene servicios de múltiples negocios en una sola query (batch)
 * Excluye servicios DELETED
 * @param prisma - Prisma client
 * @param businessIds - IDs de los negocios
 * @returns Lista de servicios de todos los negocios
 */
export async function getServicesByBusinessIds(prisma: PrismaClient, businessIds: string[]): Promise<Service[]> {
    if (businessIds.length === 0) return []
    return prisma.service.findMany({
        where: {
            businessId: { in: businessIds },
            status: { not: 'DELETED' }
        },
        orderBy: { name: 'asc' }
    })
}

/**
 * Obtiene servicios agrupados por negocio (batch)
 * @param prisma - Prisma client
 * @param businessIds - IDs de los negocios
 * @returns Mapa de businessId a lista de servicios
 */
export async function getServicesByBusinessIdsMap(
    prisma: PrismaClient,
    businessIds: string[]
): Promise<Record<string, Service[]>> {
    const services = await getServicesByBusinessIds(prisma, businessIds)
    return services.reduce<Record<string, Service[]>>((acc, service) => {
        acc[service.businessId] = acc[service.businessId] || []
        acc[service.businessId].push(service)
        return acc
    }, {})
}

/**
 * Obtiene un servicio por ID
 * Excluye servicios DELETED
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @returns Servicio o null si no existe
 */
export async function getServiceById(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string
): Promise<Service | null> {
    return prisma.service.findFirst({
        where: {
            id: serviceId,
            businessId,
            status: { not: 'DELETED' }
        }
    })
}

/**
 * Obtiene un servicio activo por ID (para uso público/booking)
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param serviceId - ID del servicio
 * @returns Servicio activo o null si no existe o está inactivo/eliminado
 */
export async function getActiveServiceById(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string
): Promise<Service | null> {
    return prisma.service.findFirst({
        where: { id: serviceId, businessId, status: 'ACTIVE' }
    })
}

/**
 * Crea un nuevo servicio
 * @param prisma - Prisma client
 * @param businessId - ID del negocio
 * @param input - Datos del servicio a crear
 * @returns Servicio creado
 */
export async function createService(
    prisma: PrismaClient,
    businessId: string,
    input: CreateServiceInput
): Promise<Service> {
    validateCreateServiceInput(input)

    const trimmedName = input.name.trim()

    // Verificar que no exista un servicio activo/inactivo con el mismo nombre
    const existingWithSameName = await prisma.service.findFirst({
        where: {
            businessId,
            name: trimmedName,
            status: { not: 'DELETED' }
        }
    })
    if (existingWithSameName) {
        throw new AppError(
            ServiceErrorCodes.SERVICE_NAME_CONFLICT,
            'Ya existe un servicio activo o inactivo con ese nombre en este negocio.',
            409
        )
    }

    // Si no se especifica slotIntervalMinutes, usa durationMinutes por defecto
    const slotInterval = input.slotIntervalMinutes ?? input.durationMinutes

    return prisma.service.create({
        data: {
            businessId,
            name: trimmedName,
            description: input.description ?? null,
            durationMinutes: input.durationMinutes,
            slotIntervalMinutes: slotInterval,
            minBookingNoticeMinutes: input.minBookingNoticeMinutes ?? 0,
            priceCents: input.priceCents ?? null,
            currency: input.currency ?? 'ARS'
        }
    })
}

/**
 * Actualiza un servicio existente
 * @param prisma - Prisma client
 * @param serviceId - ID del servicio a actualizar
 * @param input - Datos a actualizar
 * @returns Servicio actualizado
 */
export async function updateService(
    prisma: PrismaClient,
    businessId: string,
    serviceId: string,
    input: UpdateServiceInput
): Promise<Service> {
    // Primero obtener el servicio existente para validación de slotInterval vs duration
    const existing = await prisma.service.findFirst({
        where: { id: serviceId, businessId, status: { not: 'DELETED' } }
    })
    if (!existing) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado para este negocio', 404)
    }

    // Si se cambia el nombre, verificar que no exista otro servicio activo/inactivo con ese nombre
    if (input.name !== undefined && input.name.trim() !== existing.name) {
        const trimmedName = input.name.trim()
        const existingWithSameName = await prisma.service.findFirst({
            where: {
                businessId,
                name: trimmedName,
                status: { not: 'DELETED' },
                id: { not: serviceId }
            }
        })
        if (existingWithSameName) {
            throw new AppError(
                ServiceErrorCodes.SERVICE_NAME_CONFLICT,
                'Ya existe un servicio activo o inactivo con ese nombre en este negocio.',
                409
            )
        }
    }

    // Validar con la duración existente para el caso de actualizar solo slotInterval
    validateUpdateServiceInput(input, existing.durationMinutes)

    const updateData: Partial<UpdateServiceInput> = {}

    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.description !== undefined) updateData.description = input.description
    if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes
    if (input.slotIntervalMinutes !== undefined) updateData.slotIntervalMinutes = input.slotIntervalMinutes
    if (input.minBookingNoticeMinutes !== undefined) updateData.minBookingNoticeMinutes = input.minBookingNoticeMinutes
    if (input.priceCents !== undefined) updateData.priceCents = input.priceCents
    if (input.currency !== undefined) updateData.currency = input.currency
    if (input.status !== undefined) updateData.status = input.status

    // Auto-ajustar slotIntervalMinutes si la nueva duración supera el intervalo actual/nuevo
    // Esto previene violación del CHECK constraint en DB (slotInterval >= duration)
    const finalDuration = updateData.durationMinutes ?? existing.durationMinutes
    const finalSlotInterval = updateData.slotIntervalMinutes ?? existing.slotIntervalMinutes
    if (finalSlotInterval < finalDuration) {
        updateData.slotIntervalMinutes = finalDuration
    }

    return prisma.service.update({
        where: { id: serviceId },
        data: updateData
    })
}

/**
 * Elimina un servicio (soft delete - marca como DELETED)
 * @param prisma - Prisma client
 * @param serviceId - ID del servicio a eliminar
 * @returns Servicio eliminado
 */
export async function deleteService(prisma: PrismaClient, businessId: string, serviceId: string): Promise<Service> {
    const existing = await prisma.service.findFirst({
        where: { id: serviceId, businessId, status: { not: 'DELETED' } }
    })
    if (!existing) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado para este negocio', 404)
    }

    return prisma.service.update({
        where: { id: serviceId },
        data: { status: 'DELETED' }
    })
}
