/**
 * Repository for SubscriptionPlan entity.
 */

import { PrismaClient } from '@prisma/client'
import type { SubscriptionPlan } from '@/domain/subscriptions/subscription.types'

export async function getActivePlans(prisma: PrismaClient): Promise<SubscriptionPlan[]> {
    return prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { priceCents: 'asc' }
    })
}

export async function getPlanById(prisma: PrismaClient, planId: string): Promise<SubscriptionPlan | null> {
    return prisma.subscriptionPlan.findUnique({
        where: { id: planId }
    })
}

export async function getPlanBySlug(prisma: PrismaClient, slug: string): Promise<SubscriptionPlan | null> {
    return prisma.subscriptionPlan.findUnique({
        where: { slug }
    })
}
