/**
 * Cron endpoint for processing appointment reminders
 * Called by Vercel Cron Jobs every 10 minutes
 *
 * @see docs/user-stories.md - US-8.3
 *
 * Security:
 * - Protected by CRON_SECRET header validation
 * - Only Vercel can call this endpoint in production
 *
 * Usage:
 * - Production: Automatically called by Vercel Cron
 * - Testing: POST with x-cron-secret header
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { processReminders } from '@/domain/notifications/reminder.service'

const CRON_SECRET = process.env.CRON_SECRET
const IS_DEV = process.env.NODE_ENV === 'development'

/**
 * Validate cron request authentication
 * In production, only Vercel can call this endpoint
 */
function isAuthorized(request: NextRequest): boolean {
    // In development without CRON_SECRET, allow all requests
    if (!CRON_SECRET) {
        if (IS_DEV) {
            console.warn('[Cron] CRON_SECRET not configured - allowing request in development')
            return true
        }
        return false
    }

    // Check Vercel's cron secret header
    const authHeader = request.headers.get('authorization')
    if (authHeader === `Bearer ${CRON_SECRET}`) {
        return true
    }

    // Also check x-cron-secret for manual testing
    const cronSecretHeader = request.headers.get('x-cron-secret')
    if (cronSecretHeader === CRON_SECRET) {
        return true
    }

    return false
}

/**
 * GET /api/cron/reminders
 *
 * Process reminder emails for appointments.
 * Called by Vercel Cron Jobs.
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now()

    if (!CRON_SECRET && !IS_DEV) {
        console.error('[Cron] CRON_SECRET not configured')
        return NextResponse.json(
            { error: { code: 'CONFIG_ERROR', message: 'CRON_SECRET is not configured' } },
            { status: 500 }
        )
    }

    // Validate authorization
    if (!isAuthorized(request)) {
        console.warn('[Cron] Unauthorized request to reminders endpoint')
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authorization' } },
            { status: 401 }
        )
    }

    console.info('[Cron] Starting reminder processing', {
        timestamp: new Date().toISOString()
    })

    try {
        const result = await processReminders(prisma)

        const duration = Date.now() - startTime

        console.info('[Cron] Reminder processing completed', {
            duration: `${duration}ms`,
            ...result
        })

        return NextResponse.json({
            success: true,
            data: {
                totalProcessed: result.totalProcessed,
                sent: result.sent,
                failed: result.failed,
                skipped: result.skipped,
                durationMs: duration,
                timestamp: new Date().toISOString()
            }
        })
    } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error('[Cron] Critical error during reminder processing', {
            errorType: error instanceof Error ? error.name : 'Unknown',
            errorMessage,
            duration: `${duration}ms`
        })

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error processing reminders'
                },
                durationMs: duration,
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        )
    }
}

// Also allow POST for manual testing
export { GET as POST }
