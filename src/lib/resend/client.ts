/**
 * Resend email client configuration
 * @see https://resend.com/docs/send-with-nodejs
 *
 * Environment variables:
 * - RESEND_API_KEY: API key for Resend
 * - EMAIL_FROM: Default sender address (e.g., notificaciones@send.aggendia.com)
 */

import { Resend } from 'resend'
import type { CreateEmailOptions } from 'resend'

// Validate required environment variables at module load time
const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM?.trim()

if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY not configured - email sending will be disabled')
}

if (!EMAIL_FROM) {
    console.warn('[Resend] EMAIL_FROM not configured - using default sender')
} else {
    console.info(`[Resend] Configured sender: "${EMAIL_FROM}"`)
}

/**
 * Singleton Resend client instance
 * Returns null if API key is not configured (graceful degradation)
 */
const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

/**
 * Default sender email address
 */
export const defaultFromEmail = EMAIL_FROM || 'onboarding@resend.dev'

/**
 * Check if email sending is enabled
 */
export function isEmailEnabled(): boolean {
    return resendClient !== null
}

/**
 * Send an email via Resend with structured logging.
 *
 * Returns `{ data, error }` just like `resend.emails.send()`.
 * Logs both success (with email ID for tracing) and failure.
 */
export async function sendEmail(options: CreateEmailOptions) {
    if (!resendClient) {
        console.warn('[Resend] Attempted to send email but client is not configured')
        return { data: null, error: { name: 'configuration_error', message: 'Resend client not configured' } }
    }

    const { data, error } = await resendClient.emails.send(options)

    if (error) {
        console.error('[Resend] Send failed', {
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            from: options.from,
            subject: options.subject,
            errorName: error.name,
            errorMessage: error.message
        })
    } else if (data) {
        console.info('[Resend] Send succeeded', {
            emailId: data.id,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            from: options.from,
            subject: options.subject
        })
    }

    return { data, error }
}

/**
 * @deprecated Use `sendEmail()` instead for better logging. Kept temporarily for migration.
 */
export const resend = resendClient
