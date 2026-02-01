/**
 * Cron endpoint for processing pending notifications
 * Called by Vercel Cron Jobs every minute to send queued notifications
 *
 * @see docs/user-stories.md - US-10.4
 * @see docs/conventions.md - Section 2 (Arquitectura: separación api/domain/data)
 *
 * Security:
 * - Protected by CRON_SECRET header validation
 * - Only Vercel can call this endpoint in production
 *
 * Usage:
 * - Production: Automatically called by Vercel Cron
 * - Testing: POST with x-cron-secret header
 *
 * Architecture:
 * Route Handlers create PENDING notification records.
 * This cron job processes them asynchronously.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { processNotifications } from '@/data/notifications/notification-processor.service'

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
 * GET /api/cron/notifications
 *
 * Process pending notifications (confirmations, cancellations, rescheduled).
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
        console.warn('[Cron] Unauthorized request to notifications endpoint')
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authorization' } },
            { status: 401 }
        )
    }

    console.info('[Cron] Starting notification processing', {
        timestamp: new Date().toISOString()
    })

    try {
        const result = await processNotifications(prisma)

        const duration = Date.now() - startTime

        console.info('[Cron] Notification processing completed', {
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

        console.error('[Cron] Critical error during notification processing', {
            errorType: error instanceof Error ? error.name : 'Unknown',
            errorMessage,
            duration: `${duration}ms`
        })

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error processing notifications'
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
