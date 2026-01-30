/**
 * Domain service for notifications
 * Handles email sending logic for appointment confirmations
 *
 * @see docs/user-stories.md - US-8.1 Confirmación de reserva por email
 *
 * Key design decisions:
 * - Non-blocking: errors are caught and logged, never propagated
 * - Persistent: all attempts are recorded in notifications table
 * - Idempotent: duplicate notifications are prevented by DB constraint
 */

import { PrismaClient } from '@prisma/client'
import { SendConfirmationEmailInput, SendNotificationResult } from './notification.types'
import { createNotification, updateNotificationStatus } from '@/data/repositories/notification.repo'
import { resend, defaultFromEmail, isEmailEnabled } from '@/lib/resend/client'
import {
    renderConfirmationEmail,
    renderConfirmationEmailText,
    ConfirmationEmailData
} from '@/lib/resend/templates/confirmation.template'

/**
 * Format date for email display
 * Output: "Lunes 15 de enero, 14:00"
 */
function formatDateTimeForEmail(date: Date, timezone: string): string {
    const dateOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    }

    const timeOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }

    const formattedDate = date.toLocaleDateString('es-AR', dateOptions)
    const formattedTime = date.toLocaleTimeString('es-AR', timeOptions)

    // Capitalize first letter
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)

    return `${capitalizedDate}, ${formattedTime}`
}

/**
 * Get friendly timezone name
 * Maps IANA timezone to user-friendly display name
 */
function getTimezoneDisplayName(timezone: string): string {
    // Common Argentina/Latin America timezones
    const timezoneMap: Record<string, string> = {
        'America/Argentina/Buenos_Aires': 'Argentina',
        'America/Buenos_Aires': 'Argentina',
        'America/Sao_Paulo': 'Brasil',
        'America/Santiago': 'Chile',
        'America/Lima': 'Perú',
        'America/Bogota': 'Colombia',
        'America/Mexico_City': 'México',
        'America/New_York': 'Nueva York',
        'America/Los_Angeles': 'Los Ángeles',
        'Europe/Madrid': 'España',
        UTC: 'UTC'
    }

    return timezoneMap[timezone] || timezone
}

/**
 * Send confirmation email for a newly created appointment
 *
 * This function:
 * 1. Validates customer has email (skips if not)
 * 2. Creates notification record with PENDING status
 * 3. Attempts to send email via Resend
 * 4. Updates notification status to SENT or FAILED
 *
 * IMPORTANT: This function NEVER throws exceptions.
 * All errors are caught, logged, and persisted for later retry.
 *
 * @param prisma - Prisma client
 * @param input - Appointment and customer data
 * @returns Result with success status and notification ID
 */
export async function sendConfirmationEmail(
    prisma: PrismaClient,
    input: SendConfirmationEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, business, service, resource, customer, startAt } = input

    // 1. Skip if customer has no email
    if (!customer.email) {
        console.info(`[Notification] Skipping confirmation email: no customer email`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Customer has no email address'
        }
    }

    // 2. Skip if email is not enabled (missing API key)
    if (!isEmailEnabled()) {
        console.warn(`[Notification] Email sending disabled: RESEND_API_KEY not configured`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Email sending is disabled'
        }
    }

    let notificationId = ''

    try {
        // 3. Create notification record with PENDING status
        // Use startAt as scheduledFor for idempotency: same (appointmentId, type, startAt) = same notification
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'EMAIL',
            type: 'CONFIRMATION',
            to: customer.email,
            scheduledFor: startAt // Deterministic for idempotency
        })
        notificationId = notification.id

        // 4. Prepare email data
        const emailData: ConfirmationEmailData = {
            customerName: customer.fullName,
            businessName: business.name,
            serviceName: service.name,
            resourceName: resource.name,
            resourceLabel: business.resourceLabel,
            formattedDateTime: formatDateTimeForEmail(startAt, business.timezone),
            timezone: getTimezoneDisplayName(business.timezone),
            address: business.address
        }

        // 5. Send email via Resend
        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: customer.email,
            subject: `Turno confirmado - ${business.name}`,
            html: renderConfirmationEmail(emailData),
            text: renderConfirmationEmailText(emailData)
        })

        if (sendError) {
            // 6a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, sendError.message)

            // Log without PII - only error code and name, not full message
            console.error(`[Notification] Failed to send confirmation email`, {
                appointmentId,
                businessId: business.id,
                notificationId,
                errorName: sendError.name
                // Avoid logging sendError.message which may contain PII
            })

            return {
                success: false,
                notificationId,
                error: sendError.message
            }
        }

        // 6b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        // Log without PII - no email address
        console.info(`[Notification] Confirmation email sent`, {
            appointmentId,
            businessId: business.id,
            notificationId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // 7. Handle unexpected errors (DB errors, network issues, etc.)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Log without full error object which may contain PII
        console.error(`[Notification] Unexpected error sending confirmation`, {
            appointmentId,
            businessId: business.id,
            notificationId: notificationId || 'not-created',
            errorType: error instanceof Error ? error.name : 'Unknown'
        })

        // Try to update notification status if we have an ID
        if (notificationId) {
            try {
                await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, errorMessage)
            } catch (updateError) {
                console.error(`[Notification] Failed to update notification status`, {
                    notificationId,
                    errorType: updateError instanceof Error ? updateError.name : 'Unknown'
                })
            }
        }

        return {
            success: false,
            notificationId,
            error: errorMessage
        }
    }
}
