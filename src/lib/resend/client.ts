/**
 * Resend email client configuration
 * @see https://resend.com/docs/send-with-nodejs
 *
 * Environment variables:
 * - RESEND_API_KEY: API key for Resend
 * - EMAIL_FROM: Default sender address (e.g., onboarding@resend.dev for dev)
 */

import { Resend } from 'resend'

// Validate required environment variables at module load time
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM

if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY not configured - email sending will be disabled')
}

if (!EMAIL_FROM) {
    console.warn('[Resend] EMAIL_FROM not configured - using default sender')
}

/**
 * Singleton Resend client instance
 * Returns null if API key is not configured (graceful degradation)
 */
export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

/**
 * Default sender email address
 */
export const defaultFromEmail = EMAIL_FROM || 'onboarding@resend.dev'

/**
 * Check if email sending is enabled
 */
export function isEmailEnabled(): boolean {
    return resend !== null
}
