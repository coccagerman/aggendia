import { PrismaClient } from '@prisma/client'
import { Business, BusinessMember, BusinessWithRole, CreateBusinessInput } from '@/domain/businesses/business.types'

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
