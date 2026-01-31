import { PrismaClient } from '@prisma/client'
import { Business, BusinessMember, BusinessWithRole, CreateBusinessInput } from '@/domain/businesses/business.types'

/**
 * Input para actualizar configuración del negocio
 */
export interface UpdateBusinessSettingsInput {
    resourceLabel?: string
    remindersEnabled?: boolean
    reminderOffsetsMinutes?: number[]
    emailNotificationsEnabled?: boolean
    whatsappNotificationsEnabled?: boolean
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
 */
export async function createBusinessWithOwner(
    prisma: PrismaClient,
    input: CreateBusinessInput,
    slug: string,
    userId: string
): Promise<{ business: Business; member: BusinessMember }> {
    const result = await prisma.$transaction(async tx => {
        const business = await tx.business.create({
            data: {
                name: input.name,
                slug,
                timezone: input.timezone,
                resourceLabel: input.resourceLabel ?? 'Recurso',
                address: input.address ?? null,
                area: input.area ?? null
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
        where: { userId },
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
 * Busca un negocio por slug (para validar colisiones).
 */
export async function findBusinessBySlug(prisma: PrismaClient, slug: string): Promise<Business | null> {
    return prisma.business.findUnique({
        where: { slug }
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
            })
        }
    })
}

/**
 * Get businesses that should be processed for a reminder offset.
 * Filters by remindersEnabled and configured offsets.
 */
export async function getBusinessesForReminderOffset(
    prisma: PrismaClient,
    offsetMinutes: number,
    businessId?: string
): Promise<ReminderBusinessConfig[]> {
    return prisma.business.findMany({
        where: {
            remindersEnabled: true,
            reminderOffsetsMinutes: {
                has: offsetMinutes
            },
            ...(businessId ? { id: businessId } : {})
        },
        select: {
            id: true,
            timezone: true,
            reminderOffsetsMinutes: true
        }
    })
}
