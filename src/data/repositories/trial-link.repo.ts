/**
 * Repository for TrialLink and TrialLinkUsage entities.
 */

import { PrismaClient, Prisma } from '@prisma/client'
import type {
    TrialLink,
    TrialLinkUsage,
    CreateTrialLinkInput,
    UpdateTrialLinkInput
} from '@/domain/subscriptions/subscription.types'
import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

// Prisma returns JsonValue for metadata; our domain uses Record<string, unknown> | null.
// This helper casts the Prisma result to the domain type.
type PrismaTrialLink = Awaited<ReturnType<PrismaClient['trialLink']['findUnique']>>
function toDomainTrialLink<T extends NonNullable<PrismaTrialLink>>(row: T): T & TrialLink {
    return { ...row, metadata: row.metadata as Record<string, unknown> | null }
}

// ============================================================================
// TrialLink queries
// ============================================================================

export async function getTrialLinkByCode(prisma: PrismaClient, code: string): Promise<TrialLink | null> {
    const row = await prisma.trialLink.findUnique({ where: { code } })
    return row ? toDomainTrialLink(row) : null
}

export async function getTrialLinkById(prisma: PrismaClient, id: string): Promise<TrialLink | null> {
    const row = await prisma.trialLink.findUnique({ where: { id } })
    return row ? toDomainTrialLink(row) : null
}

export async function listTrialLinks(prisma: PrismaClient): Promise<(TrialLink & { _count: { usages: number } })[]> {
    const rows = await prisma.trialLink.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { usages: true }
            }
        }
    })
    return rows.map(row => toDomainTrialLink(row))
}

// ============================================================================
// TrialLink mutations
// ============================================================================

export async function createTrialLink(prisma: PrismaClient, input: CreateTrialLinkInput): Promise<TrialLink> {
    try {
        const result = await prisma.trialLink.create({
            data: {
                code: input.code,
                trialDays: input.trialDays ?? 60,
                maxUses: input.maxUses ?? null,
                expiresAt: input.expiresAt ?? null,
                metadata: (input.metadata ?? undefined) as Parameters<
                    typeof prisma.trialLink.create
                >[0]['data']['metadata'],
                createdBy: input.createdBy ?? null
            }
        })
        return toDomainTrialLink(result)
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
            throw new AppError(
                SubscriptionErrorCodes.TRIAL_LINK_CODE_CONFLICT,
                `Ya existe un link con el código "${input.code}".`,
                409
            )
        }
        throw error
    }
}

export async function updateTrialLink(
    prisma: PrismaClient,
    id: string,
    input: UpdateTrialLinkInput
): Promise<TrialLink> {
    const metadataValue =
        input.metadata !== undefined ? ((input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue) : undefined
    const result = await prisma.trialLink.update({
        where: { id },
        data: {
            ...(input.isActive !== undefined && { isActive: input.isActive }),
            ...(input.maxUses !== undefined && { maxUses: input.maxUses }),
            ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
            ...(metadataValue !== undefined && { metadata: metadataValue })
        }
    })
    return toDomainTrialLink(result)
}

/**
 * Validate a trial link is usable (read-only, no side effects).
 * Returns the link if valid, throws AppError if not.
 */
export async function validateTrialLink(prisma: PrismaClient, code: string): Promise<TrialLink> {
    const link = await prisma.trialLink.findUnique({
        where: { code }
    })

    if (!link) {
        throw new AppError(SubscriptionErrorCodes.TRIAL_LINK_NOT_FOUND, 'Link de prueba no encontrado.', 404)
    }

    if (!link.isActive) {
        throw new AppError(SubscriptionErrorCodes.TRIAL_LINK_INACTIVE, 'Este link de prueba ya no está activo.', 400)
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
        throw new AppError(SubscriptionErrorCodes.TRIAL_LINK_EXPIRED, 'Este link de prueba ha expirado.', 400)
    }

    if (link.maxUses !== null && link.usedCount >= link.maxUses) {
        throw new AppError(
            SubscriptionErrorCodes.TRIAL_LINK_EXHAUSTED,
            'Este link de prueba ya alcanzó el máximo de usos.',
            400
        )
    }

    return toDomainTrialLink(link)
}

/**
 * Validate a trial link is usable and atomically increment usedCount.
 * Returns the link if valid, throws AppError if not.
 */
export async function validateAndUseTrialLink(prisma: PrismaClient, code: string, userId: string): Promise<TrialLink> {
    const link = await validateTrialLink(prisma, code)

    // Atomic increment + usage record in transaction
    const updatedLink = await prisma.$transaction(async tx => {
        const updated = await tx.trialLink.update({
            where: { id: link.id },
            data: { usedCount: { increment: 1 } }
        })

        await tx.trialLinkUsage.create({
            data: {
                trialLinkId: link.id,
                userId
            }
        })

        return updated
    })

    return toDomainTrialLink(updatedLink)
}

// ============================================================================
// TrialLinkUsage queries
// ============================================================================

export async function getTrialLinkUsages(prisma: PrismaClient, trialLinkId: string): Promise<TrialLinkUsage[]> {
    return prisma.trialLinkUsage.findMany({
        where: { trialLinkId },
        orderBy: { usedAt: 'desc' }
    })
}

/**
 * Mark a trial link usage as converted (paid).
 * Used for conversion metrics.
 */
export async function markTrialLinkUsageConverted(prisma: PrismaClient, userId: string): Promise<void> {
    await prisma.trialLinkUsage.updateMany({
        where: {
            userId,
            convertedAt: null
        },
        data: {
            convertedAt: new Date()
        }
    })
}
