/**
 * Migration script: Backfill ownerEmail for existing businesses
 *
 * Reads the business_members table (role=OWNER), resolves the user's email
 * from Supabase Auth (auth.users), and updates each business's ownerEmail.
 *
 * Usage:
 *   npx tsx scripts/backfill-owner-email.ts
 *
 * Idempotent: skips businesses that already have ownerEmail set.
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
    // 1. Find businesses without ownerEmail
    const businesses = await prisma.business.findMany({
        where: { ownerEmail: null },
        select: { id: true, name: true }
    })

    console.log(`Found ${businesses.length} businesses without ownerEmail`)

    let updated = 0
    let skipped = 0

    for (const biz of businesses) {
        // 2. Find the OWNER member for this business
        const member = await prisma.businessMember.findFirst({
            where: { businessId: biz.id, role: 'OWNER' },
            select: { userId: true }
        })

        if (!member) {
            console.warn(`  [SKIP] ${biz.name} (${biz.id}): no OWNER member found`)
            skipped++
            continue
        }

        // 3. Look up the user's email from Supabase Auth
        const { data, error } = await supabase.auth.admin.getUserById(member.userId)

        if (error || !data?.user?.email) {
            console.warn(
                `  [SKIP] ${biz.name} (${biz.id}): could not resolve email for userId=${member.userId}`,
                error?.message
            )
            skipped++
            continue
        }

        // 4. Update the business
        await prisma.business.update({
            where: { id: biz.id },
            data: { ownerEmail: data.user.email }
        })

        console.log(`  [OK] ${biz.name} → ${data.user.email}`)
        updated++
    }

    console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`)
}

main()
    .catch(err => {
        console.error('Fatal error:', err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
