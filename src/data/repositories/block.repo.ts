/**
 * Repository for ResourceBlock data access
 */

import { PrismaClient } from '@prisma/client'
import { ResourceBlock, CreateBlockInput, ListBlocksInput } from '@/domain/blocks/block.types'

/**
 * Get all blocks for a resource, optionally filtered by date range.
 * When from/to are provided, returns blocks that INTERSECT with the range
 * (not just those fully contained within it).
 */
export async function getBlocksByResourceId(prisma: PrismaClient, input: ListBlocksInput): Promise<ResourceBlock[]> {
    const { resourceId, from, to } = input

    // Build where clause for intersection query
    // Intersection condition: block.startAt < to AND block.endAt > from
    interface WhereClause {
        resourceId: string
        startAt?: { lt: Date }
        endAt?: { gt: Date }
    }

    const whereClause: WhereClause = { resourceId }

    // Filter by date range intersection if provided
    if (from && to) {
        // Both from and to: return blocks that intersect [from, to)
        whereClause.startAt = { lt: to }
        whereClause.endAt = { gt: from }
    } else if (from) {
        // Only from: return blocks that end after from (still active at/after from)
        whereClause.endAt = { gt: from }
    } else if (to) {
        // Only to: return blocks that start before to
        whereClause.startAt = { lt: to }
    }

    const blocks = await prisma.resourceBlock.findMany({
        where: whereClause,
        orderBy: { startAt: 'asc' }
    })

    return blocks
}

/**
 * Get blocks that overlap with a given date range (for validation)
 */
export async function getOverlappingBlocks(
    prisma: PrismaClient,
    resourceId: string,
    startAt: Date,
    endAt: Date,
    excludeBlockId?: string
): Promise<ResourceBlock[]> {
    const blocks = await prisma.resourceBlock.findMany({
        where: {
            resourceId,
            // Overlap condition: existing.startAt < new.endAt AND existing.endAt > new.startAt
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            ...(excludeBlockId && { id: { not: excludeBlockId } })
        }
    })

    return blocks
}

/**
 * Get a block by ID
 */
export async function getBlockById(prisma: PrismaClient, blockId: string): Promise<ResourceBlock | null> {
    const block = await prisma.resourceBlock.findUnique({
        where: { id: blockId }
    })

    return block
}

/**
 * Create a new block
 */
export async function createBlock(prisma: PrismaClient, input: CreateBlockInput): Promise<ResourceBlock> {
    const block = await prisma.resourceBlock.create({
        data: {
            resourceId: input.resourceId,
            startAt: input.startAt,
            endAt: input.endAt,
            reason: input.reason ?? null
        }
    })

    return block
}

/**
 * Delete a block by ID
 */
export async function deleteBlock(prisma: PrismaClient, blockId: string): Promise<void> {
    await prisma.resourceBlock.delete({
        where: { id: blockId }
    })
}

/**
 * Get block with resource info (for tenant validation)
 */
export async function getBlockWithResource(
    prisma: PrismaClient,
    blockId: string
): Promise<(ResourceBlock & { resource: { businessId: string } }) | null> {
    const block = await prisma.resourceBlock.findUnique({
        where: { id: blockId },
        include: {
            resource: {
                select: { businessId: true }
            }
        }
    })

    return block
}
