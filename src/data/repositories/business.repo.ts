import { PrismaClient } from '@prisma/client'
import {
    Business,
    BusinessMember,
    BusinessWithRole,
    CreateBusinessInput,
    UpdateBusinessInput
} from '@/domain/businesses/business.types'
import { AppError, BusinessErrorCodes, ValidationErrorCodes } from '@/domain/common/errors'

/**
 * Input para actualizar configuración del negocio
 */
export interface UpdateBusinessSettingsInput {
    resourceLabel?: string
    remindersEnabled?: boolean
    reminderOffsetsMinutes?: number[]
    emailNotificationsEnabled?: boolean
    whatsappNotificationsEnabled?: boolean
    ownerEmailNotificationsEnabled?: boolean
    ownerWhatsappNotificationsEnabled?: boolean
    ownerRemindersEnabled?: boolean
    ownerReminderOffsetsMinutes?: number[]
    ownerPhoneE164?: string | null
}

/**
 * Minimal business data needed to compute reminder windows
 */
export interface ReminderBusinessConfig {
    id: string
    timezone: string
    reminderOffsetsMinutes: number[]
}

/**
 * Crea un negocio y asocia al usuario como OWNER en una transacción atómica.
 * Note: Subscription is NOT created here — it's per-user, created at signup.
 */
export async function createBusinessWithOwner(
    prisma: PrismaClient,
    input: CreateBusinessInput,
    slug: string,
    userId: string,
    ownerEmail?: string
): Promise<{ business: Business; member: BusinessMember }> {
    const result = await prisma.$transaction(async tx => {
        const business = await tx.business.create({
            data: {
                name: input.name,
                slug,
                timezone: input.timezone,
                resourceLabel: input.resourceLabel ?? 'Recurso',
                address: input.address ?? null,
                area: input.area ?? null,
                ownerEmail: ownerEmail ?? null
            }
        })

        const member = await tx.businessMember.create({
            data: {
                businessId: business.id,
                userId,
                role: 'OWNER'
            }
        })

        return { business, member }
    })

    return result
}

/**
 * Obtiene todos los negocios del usuario autenticado (donde es miembro).
 */
export async function getBusinessesByUserId(prisma: PrismaClient, userId: string): Promise<BusinessWithRole[]> {
    const members = await prisma.businessMember.findMany({
        where: {
            userId,
            business: {
                status: { not: 'DELETED' }
            }
        },
        include: {
            business: true
        }
    })

    return members.map(m => ({
        ...m.business,
        role: m.role
    }))
}

/**
 * Cuenta negocios activos de un usuario (según membresías).
 */
export async function countActiveBusinessesByUserId(prisma: PrismaClient, userId: string): Promise<number> {
    return prisma.businessMember.count({
        where: {
            userId,
            business: {
                status: 'ACTIVE'
            }
        }
    })
}

/**
 * Desactiva todos los negocios activos de un usuario y devuelve cuántos fueron modificados.
 */
export async function deactivateAllActiveBusinessesByUserId(prisma: PrismaClient, userId: string): Promise<number> {
    const activeBusinessMembers = await prisma.businessMember.findMany({
        where: {
            userId,
            business: {
                status: 'ACTIVE'
            }
        },
        select: {
            businessId: true
        }
    })

    const businessIds = activeBusinessMembers.map(member => member.businessId)
    if (businessIds.length === 0) {
        return 0
    }

    const result = await prisma.business.updateMany({
        where: {
            id: {
                in: businessIds
            },
            status: 'ACTIVE'
        },
        data: {
            status: 'INACTIVE'
        }
    })

    return result.count
}

/**
 * Busca un negocio por slug (para validar colisiones).
 */
export async function findBusinessBySlug(prisma: PrismaClient, slug: string): Promise<Business | null> {
    return prisma.business.findUnique({
        where: { slug }
    })
}

/**
 * Busca un negocio ACTIVO por slug (para páginas públicas).
 * Retorna null si el negocio no existe, está INACTIVE o DELETED.
 */
export async function findActiveBusinessBySlug(prisma: PrismaClient, slug: string): Promise<Business | null> {
    return prisma.business.findFirst({
        where: {
            slug,
            status: 'ACTIVE'
        }
    })
}

/**
 * Obtiene un negocio por ID.
 */
export async function getBusinessById(prisma: PrismaClient, businessId: string): Promise<Business | null> {
    return prisma.business.findUnique({
        where: { id: businessId }
    })
}

/**
 * Get the owner's userId for a given businessId.
 * Used by public routes to check subscription access.
 */
export async function getBusinessOwnerUserId(prisma: PrismaClient, businessId: string): Promise<string | null> {
    const member = await prisma.businessMember.findFirst({
        where: { businessId, role: 'OWNER' },
        select: { userId: true }
    })
    return member?.userId ?? null
}

/**
 * Actualiza el resourceLabel de un negocio.
 * @deprecated Usar updateBusinessSettings en su lugar
 */
export async function updateBusinessResourceLabel(
    prisma: PrismaClient,
    businessId: string,
    resourceLabel: string
): Promise<Business> {
    return prisma.business.update({
        where: { id: businessId },
        data: { resourceLabel }
    })
}

/**
 * Actualiza la configuración del negocio.
 * Soporta: resourceLabel, remindersEnabled, reminderOffsetsMinutes,
 *          emailNotificationsEnabled, whatsappNotificationsEnabled
 */
export async function updateBusinessSettings(
    prisma: PrismaClient,
    businessId: string,
    input: UpdateBusinessSettingsInput
): Promise<Business> {
    return prisma.business.update({
        where: { id: businessId },
        data: {
            ...(input.resourceLabel !== undefined && { resourceLabel: input.resourceLabel }),
            ...(input.remindersEnabled !== undefined && { remindersEnabled: input.remindersEnabled }),
            ...(input.reminderOffsetsMinutes !== undefined && { reminderOffsetsMinutes: input.reminderOffsetsMinutes }),
            ...(input.emailNotificationsEnabled !== undefined && {
                emailNotificationsEnabled: input.emailNotificationsEnabled
            }),
            ...(input.whatsappNotificationsEnabled !== undefined && {
                whatsappNotificationsEnabled: input.whatsappNotificationsEnabled
            }),
            ...(input.ownerEmailNotificationsEnabled !== undefined && {
                ownerEmailNotificationsEnabled: input.ownerEmailNotificationsEnabled
            }),
            ...(input.ownerWhatsappNotificationsEnabled !== undefined && {
                ownerWhatsappNotificationsEnabled: input.ownerWhatsappNotificationsEnabled
            }),
            ...(input.ownerRemindersEnabled !== undefined && {
                ownerRemindersEnabled: input.ownerRemindersEnabled
            }),
            ...(input.ownerReminderOffsetsMinutes !== undefined && {
                ownerReminderOffsetsMinutes: input.ownerReminderOffsetsMinutes
            }),
            ...(input.ownerPhoneE164 !== undefined && {
                ownerPhoneE164: input.ownerPhoneE164
            })
        }
    })
}

/**
 * Actualiza los campos core de un negocio (name, timezone, address, area, status).
 */
export async function updateBusiness(
    prisma: PrismaClient,
    businessId: string,
    input: UpdateBusinessInput
): Promise<Business> {
    const existing = await prisma.business.findFirst({
        where: {
            id: businessId,
            status: { not: 'DELETED' }
        }
    })

    if (!existing) {
        throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado.', 404)
    }

    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.timezone !== undefined) data.timezone = input.timezone.trim()
    if (input.address !== undefined) data.address = input.address
    if (input.area !== undefined) data.area = input.area
    if (input.status !== undefined) data.status = input.status

    if (Object.keys(data).length === 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'No hay cambios para aplicar.', 400)
    }

    return prisma.business.update({
        where: { id: businessId },
        data
    })
}

/**
 * Cuenta turnos futuros activos (SCHEDULED o RESCHEDULED) de un negocio.
 */
export async function countFutureAppointments(prisma: PrismaClient, businessId: string): Promise<number> {
    return prisma.appointment.count({
        where: {
            businessId,
            status: { in: ['SCHEDULED', 'RESCHEDULED'] },
            startAt: { gt: new Date() }
        }
    })
}

/**
 * Elimina un negocio (soft delete: cambia status a DELETED).
 * Verifica que no tenga turnos futuros activos antes de eliminar.
 */
export async function deleteBusiness(prisma: PrismaClient, businessId: string): Promise<void> {
    const existing = await prisma.business.findFirst({
        where: {
            id: businessId,
            status: { not: 'DELETED' }
        }
    })

    if (!existing) {
        throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado.', 404)
    }

    await prisma.business.update({
        where: { id: businessId },
        data: { status: 'DELETED' }
    })
}

/**
 * Get businesses that should be processed for a reminder offset.
 * Includes businesses with customer reminders OR owner reminders configured for this offset.
 */
export async function getBusinessesForReminderOffset(
    prisma: PrismaClient,
    offsetMinutes: number,
    businessId?: string
): Promise<ReminderBusinessConfig[]> {
    return prisma.business.findMany({
        where: {
            OR: [
                {
                    remindersEnabled: true,
                    reminderOffsetsMinutes: { has: offsetMinutes }
                },
                {
                    ownerRemindersEnabled: true,
                    ownerReminderOffsetsMinutes: { has: offsetMinutes }
                }
            ],
            ...(businessId ? { id: businessId } : {})
        },
        select: {
            id: true,
            timezone: true,
            reminderOffsetsMinutes: true
        }
    })
}
