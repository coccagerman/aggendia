/**
 * Service for processing pending notifications
 * Processes PENDING notifications from the queue and attempts to send them
 *
 * @see docs/user-stories.md - US-10.4
 * @see docs/conventions.md - Section 2 (Arquitectura: separación api/domain/data)
 *
 * This service is called by cron jobs, not directly from Route Handlers.
 * Route Handlers only create PENDING notification records.
 */

import { PrismaClient } from '@prisma/client'
import {
    getPendingNotifications,
    updateNotificationStatus,
    PendingNotificationWithAppointment
} from '@/data/repositories/notification.repo'
import { resend, defaultFromEmail, isEmailEnabled } from '@/lib/resend/client'
import { sendTemplateMessage, isWhatsAppEnabled, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/client'
import {
    renderConfirmationEmail,
    renderConfirmationEmailText,
    ConfirmationEmailData
} from '@/lib/resend/templates/confirmation.template'
import {
    renderCancellationEmail,
    renderCancellationEmailText,
    CancellationEmailData
} from '@/lib/resend/templates/cancellation.template'
import {
    renderRescheduledEmail,
    renderRescheduledEmailText,
    RescheduledEmailData
} from '@/lib/resend/templates/rescheduled.template'
import { formatDateTimeForNotification, getTimezoneDisplayName } from '@/lib/notifications/notification-time'

/**
 * Result of processing notifications
 */
export interface ProcessNotificationsResult {
    totalProcessed: number
    sent: number
    failed: number
    skipped: number
}

/**
 * Error messages that indicate a "skip" rather than a real failure.
 * These are expected conditions (config disabled, no contact info) not real errors.
 */
const SKIPPABLE_ERROR_PATTERNS = [
    'Customer has no email address',
    'Customer has no valid phone number',
    'Email notifications are disabled',
    'WhatsApp notifications are disabled',
    'Email sending is disabled',
    'WhatsApp sending is disabled',
    'Cannot find original appointment startAt'
]

/**
 * Check if an error message indicates a skippable condition (not a real failure)
 */
function isSkippableError(error: string | undefined): boolean {
    if (!error) return false
    return SKIPPABLE_ERROR_PATTERNS.some(pattern => error.includes(pattern))
}

/**
 * Process a single CONFIRMATION email notification
 */
async function processConfirmationEmail(
    prisma: PrismaClient,
    notification: PendingNotificationWithAppointment
): Promise<{ success: boolean; error?: string }> {
    const { appointment } = notification

    if (!appointment.customer.email) {
        return { success: false, error: 'Customer has no email address' }
    }

    if (!appointment.business.emailNotificationsEnabled) {
        return { success: false, error: 'Email notifications are disabled' }
    }

    if (!isEmailEnabled()) {
        return { success: false, error: 'Email sending is disabled' }
    }

    try {
        const emailData: ConfirmationEmailData = {
            customerName: appointment.customer.fullName,
            businessName: appointment.business.name,
            serviceName: appointment.service.name,
            resourceName: appointment.resource.name,
            resourceLabel: appointment.business.resourceLabel,
            formattedDateTime: formatDateTimeForNotification(appointment.startAt, appointment.business.timezone),
            timezone: getTimezoneDisplayName(appointment.business.timezone),
            address: appointment.business.address
        }

        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: appointment.customer.email,
            subject: `Confirmación de turno - ${appointment.business.name}`,
            html: renderConfirmationEmail(emailData),
            text: renderConfirmationEmailText(emailData)
        })

        if (sendError) {
            return { success: false, error: sendError.message }
        }

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
    }
}

/**
 * Process a single CONFIRMATION WhatsApp notification
 */
async function processConfirmationWhatsApp(
    prisma: PrismaClient,
    notification: PendingNotificationWithAppointment
): Promise<{ success: boolean; error?: string }> {
    const { appointment } = notification

    if (!appointment.customer.phoneE164) {
        return { success: false, error: 'Customer has no valid phone number' }
    }

    if (!appointment.business.whatsappNotificationsEnabled) {
        return { success: false, error: 'WhatsApp notifications are disabled' }
    }

    if (!isWhatsAppEnabled()) {
        return { success: false, error: 'WhatsApp sending is disabled' }
    }

    try {
        const formattedDateTime = formatDateTimeForNotification(appointment.startAt, appointment.business.timezone)
        const timezone = getTimezoneDisplayName(appointment.business.timezone)

        const messageText = `✅ Turno confirmado

📍 ${appointment.business.name}
📋 Servicio: ${appointment.service.name}
👤 ${appointment.business.resourceLabel}: ${appointment.resource.name}
📅 ${formattedDateTime}
🕐 Zona horaria: ${timezone}

¡Te esperamos!`

        const result = await sendTemplateMessage(
            appointment.customer.phoneE164,
            WHATSAPP_TEMPLATES.CONFIRMATION,
            messageText
        )

        if (!result.success) {
            return { success: false, error: result.error }
        }

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
    }
}

/**
 * Process a single CANCELLATION email notification
 */
async function processCancellationEmail(
    prisma: PrismaClient,
    notification: PendingNotificationWithAppointment
): Promise<{ success: boolean; error?: string }> {
    const { appointment } = notification

    if (!appointment.customer.email) {
        return { success: false, error: 'Customer has no email address' }
    }

    if (!appointment.business.emailNotificationsEnabled) {
        return { success: false, error: 'Email notifications are disabled' }
    }

    if (!isEmailEnabled()) {
        return { success: false, error: 'Email sending is disabled' }
    }

    try {
        const emailData: CancellationEmailData = {
            customerName: appointment.customer.fullName,
            businessName: appointment.business.name,
            serviceName: appointment.service.name,
            resourceName: appointment.resource.name,
            resourceLabel: appointment.business.resourceLabel,
            formattedDateTime: formatDateTimeForNotification(appointment.startAt, appointment.business.timezone),
            timezone: getTimezoneDisplayName(appointment.business.timezone)
        }

        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: appointment.customer.email,
            subject: `Turno cancelado - ${appointment.business.name}`,
            html: renderCancellationEmail(emailData),
            text: renderCancellationEmailText(emailData)
        })

        if (sendError) {
            return { success: false, error: sendError.message }
        }

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
    }
}

/**
 * Process a single CANCELLATION WhatsApp notification
 */
async function processCancellationWhatsApp(
    prisma: PrismaClient,
    notification: PendingNotificationWithAppointment
): Promise<{ success: boolean; error?: string }> {
    const { appointment } = notification

    if (!appointment.customer.phoneE164) {
        return { success: false, error: 'Customer has no valid phone number' }
    }

    if (!appointment.business.whatsappNotificationsEnabled) {
        return { success: false, error: 'WhatsApp notifications are disabled' }
    }

    if (!isWhatsAppEnabled()) {
        return { success: false, error: 'WhatsApp sending is disabled' }
    }

    try {
        const formattedDateTime = formatDateTimeForNotification(appointment.startAt, appointment.business.timezone)
        const timezone = getTimezoneDisplayName(appointment.business.timezone)

        const messageText = `❌ Turno cancelado

📍 ${appointment.business.name}
📋 Servicio: ${appointment.service.name}
👤 ${appointment.business.resourceLabel}: ${appointment.resource.name}
📅 ${formattedDateTime} (cancelado)
🕐 Zona horaria: ${timezone}

Si deseas reservar un nuevo turno, visitá la página del negocio.`

        const result = await sendTemplateMessage(
            appointment.customer.phoneE164,
            WHATSAPP_TEMPLATES.CANCELLATION,
            messageText
        )

        if (!result.success) {
            return { success: false, error: result.error }
        }

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
    }
}

/**
 * Process a single RESCHEDULED email notification
 */
async function processRescheduledEmail(
    prisma: PrismaClient,
    notification: PendingNotificationWithAppointment
): Promise<{ success: boolean; error?: string }> {
    const { appointment } = notification

    if (!appointment.customer.email) {
        return { success: false, error: 'Customer has no email address' }
    }

    if (!appointment.business.emailNotificationsEnabled) {
        return { success: false, error: 'Email notifications are disabled' }
    }

    if (!isEmailEnabled()) {
        return { success: false, error: 'Email sending is disabled' }
    }

    const originalStartAt = appointment.rescheduledFrom?.startAt
    if (!originalStartAt) {
        return { success: false, error: 'Cannot find original appointment startAt' }
    }

    try {
        const emailData: RescheduledEmailData = {
            customerName: appointment.customer.fullName,
            businessName: appointment.business.name,
            serviceName: appointment.service.name,
            resourceName: appointment.resource.name,
            resourceLabel: appointment.business.resourceLabel,
            originalFormattedDateTime: formatDateTimeForNotification(originalStartAt, appointment.business.timezone),
            newFormattedDateTime: formatDateTimeForNotification(appointment.startAt, appointment.business.timezone),
            timezone: getTimezoneDisplayName(appointment.business.timezone),
            address: appointment.business.address
        }

        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: appointment.customer.email,
            subject: `Turno reprogramado - ${appointment.business.name}`,
            html: renderRescheduledEmail(emailData),
            text: renderRescheduledEmailText(emailData)
        })

        if (sendError) {
            return { success: false, error: sendError.message }
        }

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
    }
}

/**
 * Process a single RESCHEDULED WhatsApp notification
 */
async function processRescheduledWhatsApp(
    prisma: PrismaClient,
    notification: PendingNotificationWithAppointment
): Promise<{ success: boolean; error?: string }> {
    const { appointment } = notification

    if (!appointment.customer.phoneE164) {
        return { success: false, error: 'Customer has no valid phone number' }
    }

    if (!appointment.business.whatsappNotificationsEnabled) {
        return { success: false, error: 'WhatsApp notifications are disabled' }
    }

    if (!isWhatsAppEnabled()) {
        return { success: false, error: 'WhatsApp sending is disabled' }
    }

    const originalStartAt = appointment.rescheduledFrom?.startAt
    if (!originalStartAt) {
        return { success: false, error: 'Cannot find original appointment startAt' }
    }

    try {
        const originalFormattedDateTime = formatDateTimeForNotification(originalStartAt, appointment.business.timezone)
        const newFormattedDateTime = formatDateTimeForNotification(appointment.startAt, appointment.business.timezone)
        const timezone = getTimezoneDisplayName(appointment.business.timezone)

        const messageText = `🔄 Turno reprogramado

📍 ${appointment.business.name}
📋 Servicio: ${appointment.service.name}
👤 ${appointment.business.resourceLabel}: ${appointment.resource.name}

📅 Fecha anterior: ${originalFormattedDateTime}
✅ Nueva fecha: ${newFormattedDateTime}
🕐 Zona horaria: ${timezone}

¡Te esperamos!`

        const result = await sendTemplateMessage(
            appointment.customer.phoneE164,
            WHATSAPP_TEMPLATES.RESCHEDULED,
            messageText
        )

        if (!result.success) {
            return { success: false, error: result.error }
        }

        return { success: true }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: errorMessage }
    }
}

/**
 * Process pending notifications
 * Called by cron job to send queued notifications
 */
export async function processNotifications(
    prisma: PrismaClient,
    limit: number = 100
): Promise<ProcessNotificationsResult> {
    const result: ProcessNotificationsResult = {
        totalProcessed: 0,
        sent: 0,
        failed: 0,
        skipped: 0
    }

    const notifications = await getPendingNotifications(prisma, limit)

    console.info('[NotificationProcessor] Found pending notifications', {
        count: notifications.length
    })

    for (const notification of notifications) {
        result.totalProcessed++

        let sendResult: { success: boolean; error?: string }

        try {
            if (notification.type === 'CONFIRMATION') {
                if (notification.channel === 'EMAIL') {
                    sendResult = await processConfirmationEmail(prisma, notification)
                } else if (notification.channel === 'WHATSAPP') {
                    sendResult = await processConfirmationWhatsApp(prisma, notification)
                } else {
                    sendResult = { success: false, error: `Unknown channel: ${notification.channel}` }
                }
            } else if (notification.type === 'CANCELLATION') {
                if (notification.channel === 'EMAIL') {
                    sendResult = await processCancellationEmail(prisma, notification)
                } else if (notification.channel === 'WHATSAPP') {
                    sendResult = await processCancellationWhatsApp(prisma, notification)
                } else {
                    sendResult = { success: false, error: `Unknown channel: ${notification.channel}` }
                }
            } else if (notification.type === 'RESCHEDULED') {
                if (notification.channel === 'EMAIL') {
                    sendResult = await processRescheduledEmail(prisma, notification)
                } else if (notification.channel === 'WHATSAPP') {
                    sendResult = await processRescheduledWhatsApp(prisma, notification)
                } else {
                    sendResult = { success: false, error: `Unknown channel: ${notification.channel}` }
                }
            } else {
                sendResult = { success: false, error: `Unsupported notification type: ${notification.type}` }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            sendResult = { success: false, error: errorMessage }
        }

        if (sendResult.success) {
            await updateNotificationStatus(prisma, notification.id, 'SENT', new Date())
            result.sent++

            console.info('[NotificationProcessor] Notification sent', {
                notificationId: notification.id,
                type: notification.type,
                channel: notification.channel,
                appointmentId: notification.appointmentId,
                businessId: notification.businessId
            })
        } else {
            // Differentiate between "skipped" (expected config issues) and "failed" (real errors)
            // Skipped: channel disabled, no contact info, or missing config
            // Failed: actual send errors (API failures, timeouts, etc.)
            const isSkipped = isSkippableError(sendResult.error)

            await updateNotificationStatus(prisma, notification.id, 'FAILED', undefined, sendResult.error)

            if (isSkipped) {
                result.skipped++
                console.info('[NotificationProcessor] Notification skipped', {
                    notificationId: notification.id,
                    type: notification.type,
                    channel: notification.channel,
                    appointmentId: notification.appointmentId,
                    businessId: notification.businessId,
                    reason: sendResult.error
                })
            } else {
                result.failed++
                console.error('[NotificationProcessor] Notification failed', {
                    notificationId: notification.id,
                    type: notification.type,
                    channel: notification.channel,
                    appointmentId: notification.appointmentId,
                    businessId: notification.businessId,
                    error: sendResult.error
                })
            }
        }
    }

    return result
}
