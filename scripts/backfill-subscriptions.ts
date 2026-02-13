/**
 * Backfill script: Create TRIALING subscriptions for existing users.
 *
 * After deploying the subscriptions-per-user feature, any user who registered
 * before the migration won't have a Subscription row. This script creates one
 * with a 30-day default trial so existing users aren't locked out.
 *
 * It finds users who own at least one business but have no Subscription row.
 *
 * Usage:
 *   npx tsx scripts/backfill-subscriptions.ts
 *
 * Idempotent: skips users that already have a subscription.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! })
})

const DEFAULT_TRIAL_DAYS = 30

async function main() {
    console.log('🔧 Backfilling subscriptions for existing users...\n')

    // Find distinct OWNER userIds that don't have a subscription
    const ownersWithoutSub = await prisma.$queryRaw<{ userId: string }[]>`
        SELECT DISTINCT bm."userId"
        FROM "BusinessMember" bm
        WHERE bm."role" = 'OWNER'
        AND NOT EXISTS (
            SELECT 1 FROM "Subscription" s WHERE s."userId" = bm."userId"
        )
    `

    if (ownersWithoutSub.length === 0) {
        console.log('✅ All business owners already have a subscription. Nothing to do.')
        return
    }

    console.log(`Found ${ownersWithoutSub.length} user(s) without subscription:\n`)

    let created = 0
    let errors = 0

    for (const { userId } of ownersWithoutSub) {
        try {
            const now = new Date()
            const trialEndsAt = new Date(now.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000)

            await prisma.subscription.create({
                data: {
                    userId,
                    status: 'TRIALING',
                    trialStartsAt: now,
                    trialEndsAt,
                    trialType: 'STANDARD'
                }
            })

            created++
            console.log(
                `  ✅ User ${userId} → TRIALING until ${trialEndsAt.toISOString().split('T')[0]}`
            )
        } catch (error) {
            errors++
            console.error(`  ❌ User ${userId}:`, error instanceof Error ? error.message : 'UNKNOWN')
        }
    }

    console.log(`\n📊 Results: ${created} created, ${errors} errors`)
}

main()
    .catch(error => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
