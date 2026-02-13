/**
 * Repository for SubscriptionConfig entity.
 *
 * Simple key-value store for subscription configuration.
 * Values are strings that get parsed by the caller based on context.
 * Uses in-memory cache to avoid DB hits on every request.
 */

import { PrismaClient } from '@prisma/client'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'

// Simple in-memory cache (reset on process restart)
const configCache = new Map<string, { value: string; cachedAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get a config value by key, with caching.
 * Returns the default if no DB entry exists.
 */
export async function getConfigValue(prisma: PrismaClient, key: string, defaultValue: string): Promise<string> {
    // Check cache
    const cached = configCache.get(key)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.value
    }

    const config = await prisma.subscriptionConfig.findUnique({
        where: { key },
        select: { value: true }
    })

    const value = config?.value ?? defaultValue
    configCache.set(key, { value, cachedAt: Date.now() })
    return value
}

/**
 * Set a config value (upsert).
 */
export async function setConfigValue(
    prisma: PrismaClient,
    key: string,
    value: string,
    description?: string
): Promise<void> {
    await prisma.subscriptionConfig.upsert({
        where: { key },
        create: { key, value, description },
        update: { value, description }
    })
    // Invalidate cache
    configCache.delete(key)
}

/**
 * Get the default trial days from config.
 */
export async function getDefaultTrialDays(prisma: PrismaClient): Promise<number> {
    const value = await getConfigValue(prisma, 'default_trial_days', String(SUBSCRIPTION_DEFAULTS.DEFAULT_TRIAL_DAYS))
    return parseInt(value, 10)
}

/**
 * Get the trial warning days from config.
 */
export async function getTrialWarningDays(prisma: PrismaClient): Promise<number[]> {
    const value = await getConfigValue(
        prisma,
        'trial_warning_days',
        JSON.stringify(SUBSCRIPTION_DEFAULTS.TRIAL_WARNING_DAYS)
    )
    return JSON.parse(value) as number[]
}

/**
 * Get the grace period days from config.
 */
export async function getGracePeriodDays(prisma: PrismaClient): Promise<number> {
    const value = await getConfigValue(prisma, 'grace_period_days', String(SUBSCRIPTION_DEFAULTS.GRACE_PERIOD_DAYS))
    return parseInt(value, 10)
}

/**
 * Invalidate all cache entries (useful in tests).
 */
export function clearConfigCache(): void {
    configCache.clear()
}
