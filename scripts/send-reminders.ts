/**
 * Script to manually run reminder processing
 * For DEV/testing and debugging
 *
 * Usage:
 *   yarn reminders:run
 *   yarn reminders:run --dry-run
 *   yarn reminders:run --business-id=<uuid>
 *
 * @see docs/user-stories.md - US-8.3
 */

import { PrismaClient } from '@prisma/client'
import { processReminders, ProcessRemindersOptions } from '@/domain/notifications/reminder.service'

const prisma = new PrismaClient()

async function main() {
    console.log('='.repeat(60))
    console.log('Reminder Processing Script')
    console.log('='.repeat(60))
    console.log(`Started at: ${new Date().toISOString()}`)
    console.log('')

    // Parse CLI arguments
    const args = process.argv.slice(2)
    const options: ProcessRemindersOptions = {}

    for (const arg of args) {
        if (arg === '--dry-run') {
            options.dryRun = true
            console.log('Mode: DRY RUN (no emails will be sent)')
        } else if (arg.startsWith('--business-id=')) {
            options.businessId = arg.replace('--business-id=', '')
            console.log(`Filtering by business ID: ${options.businessId}`)
        } else if (arg === '--help') {
            console.log(`
Usage: yarn reminders:run [options]

Options:
  --dry-run              Don't actually send emails, just log what would be sent
  --business-id=<uuid>   Only process reminders for a specific business
  --help                 Show this help message
`)
            process.exit(0)
        }
    }

    console.log('')

    try {
        const result = await processReminders(prisma, options)

        console.log('')
        console.log('='.repeat(60))
        console.log('Results:')
        console.log('='.repeat(60))
        console.log(`Total processed: ${result.totalProcessed}`)
        console.log(`Sent:            ${result.sent}`)
        console.log(`Failed:          ${result.failed}`)
        console.log(`Skipped:         ${result.skipped}`)

        if (result.errors.length > 0) {
            console.log('')
            console.log('Errors:')
            result.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`)
            })
        }

        console.log('')
        console.log(`Finished at: ${new Date().toISOString()}`)

        // Exit with error code if there were failures
        if (result.failed > 0) {
            process.exit(1)
        }
    } catch (error) {
        console.error('Fatal error:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
