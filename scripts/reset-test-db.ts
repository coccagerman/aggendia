#!/usr/bin/env tsx
/**
 * Reset Test Database
 *
 * Este script limpia la base de datos de tests entre ejecuciones
 * para garantizar tests determinísticos.
 */

import { prisma } from '../src/data/prisma/prisma'

async function resetTestDatabase() {
    console.log('🧹 Resetting test database...\n')

    try {
        // Disable foreign key checks temporarily
        await prisma.$executeRawUnsafe('SET session_replication_role = replica;')

        // Get all table names from public schema (excluding Prisma migrations)
        const query =
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'"
        const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(query)

        console.log(`Found ${tables.length} tables to truncate`)

        // Truncate each table
        for (const { tablename } of tables) {
            console.log(`  Truncating ${tablename}...`)
            const truncateQuery = `TRUNCATE TABLE "${tablename}" CASCADE;`
            await prisma.$executeRawUnsafe(truncateQuery)
        }

        // Re-enable foreign key checks
        await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;')

        console.log('\n✅ Test database reset complete')
    } catch (error) {
        console.error('❌ Error resetting database:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

resetTestDatabase().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
