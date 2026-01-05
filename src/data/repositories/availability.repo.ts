import { PrismaClient } from '@prisma/client'
import { AvailabilityRule, AvailabilityRangeInput, DayOfWeek } from '@/domain/availability/availability.types'

/**
 * Get all availability rules for a resource
 */
export async function getAvailabilityByResourceId(
    prisma: PrismaClient,
    resourceId: string
): Promise<AvailabilityRule[]> {
    const rules = await prisma.availabilityRule.findMany({
        where: { resourceId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }]
    })

    return rules.map(rule => ({
        ...rule,
        dayOfWeek: rule.dayOfWeek as DayOfWeek
    }))
}

/**
 * Replace all availability rules for a resource (delete + create in transaction)
 */
export async function setAvailability(
    prisma: PrismaClient,
    resourceId: string,
    ranges: AvailabilityRangeInput[]
): Promise<AvailabilityRule[]> {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async tx => {
        // Delete existing rules
        await tx.availabilityRule.deleteMany({
            where: { resourceId }
        })

        // Create new rules
        if (ranges.length === 0) {
            return []
        }

        await tx.availabilityRule.createMany({
            data: ranges.map(range => ({
                resourceId,
                dayOfWeek: range.dayOfWeek,
                startMinutes: range.startMinutes,
                endMinutes: range.endMinutes
            }))
        })

        // Fetch and return the created rules
        return tx.availabilityRule.findMany({
            where: { resourceId },
            orderBy: [{ dayOfWeek: 'asc' }, { startMinutes: 'asc' }]
        })
    })

    return result.map(rule => ({
        ...rule,
        dayOfWeek: rule.dayOfWeek as DayOfWeek
    }))
}

/**
 * Delete all availability rules for a resource
 */
export async function deleteAvailabilityByResourceId(prisma: PrismaClient, resourceId: string): Promise<void> {
    await prisma.availabilityRule.deleteMany({
        where: { resourceId }
    })
}
