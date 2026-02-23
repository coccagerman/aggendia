/**
 * Domain service for notifications
 * Handles email and WhatsApp sending logic for appointment confirmations
 *
 * @see docs/user-stories.md - US-8.1 Confirmación de reserva por email
 * @see docs/user-stories.md - US-10.2 Confirmación de turno por WhatsApp
 *
 * Key design decisions:
 * - Non-blocking: errors are caught and logged, never propagated
 * - Persistent: all attempts are recorded in notifications table
 * - Idempotent: duplicate notifications are prevented by DB constraint
 */

import { PrismaClient, Prisma } from '@prisma/client'
import {
    SendConfirmationEmailInput,
    SendConfirmationWhatsAppInput,
    SendNotificationResult,
    SendCancellationEmailInput,
    SendCancellationWhatsAppInput,
    SendRescheduledEmailInput,
    SendRescheduledWhatsAppInput,
    SendBusinessConfirmationEmailInput,
    SendBusinessConfirmationWhatsAppInput,
    SendBusinessCancellationEmailInput,
    SendBusinessCancellationWhatsAppInput,
    SendBusinessRescheduledEmailInput,
    SendBusinessRescheduledWhatsAppInput
} from './notification.types'
import { createNotification, updateNotificationStatus } from '@/data/repositories/notification.repo'
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
import {
    renderBusinessConfirmationEmail,
    renderBusinessConfirmationEmailText,
    BusinessConfirmationEmailData
} from '@/lib/resend/templates/business-confirmation.template'
import {
    renderBusinessCancellationEmail,
    renderBusinessCancellationEmailText,
    BusinessCancellationEmailData
} from '@/lib/resend/templates/business-cancellation.template'
import {
    renderBusinessRescheduledEmail,
    renderBusinessRescheduledEmailText,
    BusinessRescheduledEmailData
} from '@/lib/resend/templates/business-rescheduled.template'

/**
 * Format date for notification display (email and WhatsApp)
 * Output: "Lunes 15 de enero, 14:00"
 */
function formatDateTimeForNotification(date: Date, timezone: string): string {
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
    const { appointmentId, business, service, resource, customer, startAt, manageUrl } = input

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

    // 2. Skip if email notifications are disabled for business
    if (!business.emailNotificationsEnabled) {
        console.info(`[Notification] Skipping confirmation email: email channel disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Email notifications are disabled'
        }
    }

    // 3. Skip if email is not enabled (missing API key)
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
            recipient: 'CUSTOMER',
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
            formattedDateTime: formatDateTimeForNotification(startAt, business.timezone),
            address: business.address,
            manageUrl
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
// ============================================================================
// WhatsApp Confirmation - US-10.2
// ============================================================================

/**
 * Data needed to compose the confirmation message
 */
interface ConfirmationMessageData {
    businessName: string
    serviceName: string
    resourceLabel: string
    resourceName: string
    formattedDateTime: string
    timezone: string
    manageUrl?: string | null
}

/**
 * Compose confirmation message text for WhatsApp
 *
 * Isolated function to allow future migration to template-based messages.
 * In DEV/sandbox: returns plain text message
 * In PROD (future): will return template parameters instead
 *
 * @param data - Message composition data
 * @returns Formatted text message
 */
function composeConfirmationMessage(data: ConfirmationMessageData): string {
    const lines = [
        `📍 ${data.businessName}`,
        `📋 Servicio: ${data.serviceName}`,
        `👤 ${data.resourceLabel}: ${data.resourceName}`,
        `📅 ${data.formattedDateTime}`,
        `🕐 Zona horaria: ${data.timezone}`,
        `¡Te esperamos!`
    ]
    if (data.manageUrl) {
        lines.push(`🔗 Cancelar o reprogramar: ${data.manageUrl}`)
    }
    return lines.join(' | ')
}

/**
 * Send confirmation WhatsApp message for a newly created appointment
 *
 * This function:
 * 1. Validates customer has phoneE164 (skips if not)
 * 2. Validates WhatsApp is enabled for business
 * 3. Creates notification record with PENDING status
 * 4. Attempts to send message via WhatsApp Cloud API
 * 5. Updates notification status to SENT or FAILED
 *
 * IMPORTANT: This function NEVER throws exceptions.
 * All errors are caught, logged, and persisted for later retry.
 *
 * @param prisma - Prisma client
 * @param input - Appointment and customer data
 * @returns Result with success status and notification ID
 */
export async function sendConfirmationWhatsApp(
    prisma: PrismaClient,
    input: SendConfirmationWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, business, service, resource, customer, startAt, manageUrl } = input

    // 1. Skip if customer has no phoneE164
    if (!customer.phoneE164) {
        console.info(`[Notification] Skipping WhatsApp confirmation: no valid phone`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Customer has no valid phone number'
        }
    }

    // 2. Skip if WhatsApp notifications are disabled for business
    if (!business.whatsappNotificationsEnabled) {
        console.info(`[Notification] Skipping WhatsApp confirmation: channel disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp notifications are disabled'
        }
    }

    // 3. Skip if WhatsApp is not enabled (missing env vars)
    if (!isWhatsAppEnabled()) {
        console.warn(`[Notification] WhatsApp sending disabled: missing configuration`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp sending is disabled'
        }
    }

    let notificationId = ''

    try {
        // 4. Create notification record with PENDING status
        // Use startAt as scheduledFor for idempotency (same as email)
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'WHATSAPP',
            type: 'CONFIRMATION',
            recipient: 'CUSTOMER',
            to: customer.phoneE164,
            scheduledFor: startAt
        })
        notificationId = notification.id

        // 5. Compose and send message
        const messageData: ConfirmationMessageData = {
            businessName: business.name,
            serviceName: service.name,
            resourceLabel: business.resourceLabel,
            resourceName: resource.name,
            formattedDateTime: formatDateTimeForNotification(startAt, business.timezone),
            timezone: getTimezoneDisplayName(business.timezone),
            manageUrl
        }

        const messageText = composeConfirmationMessage(messageData)
        const result = await sendTemplateMessage(customer.phoneE164, WHATSAPP_TEMPLATES.CONFIRMATION, messageText)

        if (!result.success) {
            // 6a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, result.error)

            // Log without PII - no phone number
            console.error(`[Notification] Failed to send WhatsApp confirmation`, {
                appointmentId,
                businessId: business.id,
                notificationId
                // Avoid logging phone or error message which may contain PII
            })

            return {
                success: false,
                notificationId,
                error: result.error
            }
        }

        // 6b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        // Log without PII
        console.info(`[Notification] WhatsApp confirmation sent`, {
            appointmentId,
            businessId: business.id,
            notificationId,
            messageId: result.messageId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // Handle duplicate notification (idempotency)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Notification] WhatsApp confirmation already exists (idempotent)`, {
                appointmentId,
                businessId: business.id
            })
            return {
                success: false,
                notificationId: '',
                error: 'Notification already exists'
            }
        }

        // 7. Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Notification] Unexpected error sending WhatsApp confirmation`, {
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

// ============================================================================
// Cancellation Email - US-10.4
// ============================================================================

/**
 * Send cancellation email when an appointment is cancelled
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
export async function sendCancellationEmail(
    prisma: PrismaClient,
    input: SendCancellationEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, cancelledAt, business, service, resource, customer, startAt } = input

    // 1. Skip if customer has no email
    if (!customer.email) {
        console.info(`[Notification] Skipping cancellation email: no customer email`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Customer has no email address'
        }
    }

    // 2. Skip if email notifications are disabled for business
    if (!business.emailNotificationsEnabled) {
        console.info(`[Notification] Skipping cancellation email: email channel disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Email notifications are disabled'
        }
    }

    // 3. Skip if email is not enabled (missing API key)
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
        // 4. Create notification record with PENDING status
        // Use cancelledAt (updatedAt) as scheduledFor for idempotency
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'EMAIL',
            type: 'CANCELLATION',
            recipient: 'CUSTOMER',
            to: customer.email,
            scheduledFor: cancelledAt
        })
        notificationId = notification.id

        // 5. Prepare email data
        const emailData: CancellationEmailData = {
            customerName: customer.fullName,
            businessName: business.name,
            serviceName: service.name,
            resourceName: resource.name,
            resourceLabel: business.resourceLabel,
            formattedDateTime: formatDateTimeForNotification(startAt, business.timezone),
            address: business.address
        }

        // 6. Send email via Resend
        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: customer.email,
            subject: `Turno cancelado - ${business.name}`,
            html: renderCancellationEmail(emailData),
            text: renderCancellationEmailText(emailData)
        })

        if (sendError) {
            // 7a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, sendError.message)

            console.error(`[Notification] Failed to send cancellation email`, {
                appointmentId,
                businessId: business.id,
                notificationId,
                errorName: sendError.name
            })

            return {
                success: false,
                notificationId,
                error: sendError.message
            }
        }

        // 7b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        console.info(`[Notification] Cancellation email sent`, {
            appointmentId,
            businessId: business.id,
            notificationId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // Handle duplicate notification (idempotency)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Notification] Cancellation email already exists (idempotent)`, {
                appointmentId,
                businessId: business.id
            })
            return {
                success: false,
                notificationId: '',
                error: 'Notification already exists'
            }
        }

        // 8. Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Notification] Unexpected error sending cancellation email`, {
            appointmentId,
            businessId: business.id,
            notificationId: notificationId || 'not-created',
            errorType: error instanceof Error ? error.name : 'Unknown'
        })

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

// ============================================================================
// Cancellation WhatsApp - US-10.4
// ============================================================================

/**
 * Data needed to compose the cancellation message
 */
interface CancellationMessageData {
    businessName: string
    serviceName: string
    resourceLabel: string
    resourceName: string
    formattedDateTime: string
    timezone: string
}

/**
 * Compose cancellation message text for WhatsApp
 */
function composeCancellationMessage(data: CancellationMessageData): string {
    return [
        `📍 ${data.businessName}`,
        `📋 Servicio: ${data.serviceName}`,
        `👤 ${data.resourceLabel}: ${data.resourceName}`,
        `📅 ${data.formattedDateTime} (cancelado)`,
        `🕐 Zona horaria: ${data.timezone}`,
        `Si deseas reservar un nuevo turno, visitá la página del negocio.`
    ].join(' | ')
}

/**
 * Send cancellation WhatsApp message when an appointment is cancelled
 *
 * IMPORTANT: This function NEVER throws exceptions.
 *
 * @param prisma - Prisma client
 * @param input - Appointment and customer data
 * @returns Result with success status and notification ID
 */
export async function sendCancellationWhatsApp(
    prisma: PrismaClient,
    input: SendCancellationWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, cancelledAt, business, service, resource, customer, startAt } = input

    // 1. Skip if customer has no phoneE164
    if (!customer.phoneE164) {
        console.info(`[Notification] Skipping WhatsApp cancellation: no valid phone`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Customer has no valid phone number'
        }
    }

    // 2. Skip if WhatsApp notifications are disabled for business
    if (!business.whatsappNotificationsEnabled) {
        console.info(`[Notification] Skipping WhatsApp cancellation: channel disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp notifications are disabled'
        }
    }

    // 3. Skip if WhatsApp is not enabled (missing env vars)
    if (!isWhatsAppEnabled()) {
        console.warn(`[Notification] WhatsApp sending disabled: missing configuration`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp sending is disabled'
        }
    }

    let notificationId = ''

    try {
        // 4. Create notification record with PENDING status
        // Use cancelledAt (updatedAt) as scheduledFor for idempotency
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'WHATSAPP',
            type: 'CANCELLATION',
            recipient: 'CUSTOMER',
            to: customer.phoneE164,
            scheduledFor: cancelledAt
        })
        notificationId = notification.id

        // 5. Compose and send message
        const messageData: CancellationMessageData = {
            businessName: business.name,
            serviceName: service.name,
            resourceLabel: business.resourceLabel,
            resourceName: resource.name,
            formattedDateTime: formatDateTimeForNotification(startAt, business.timezone),
            timezone: getTimezoneDisplayName(business.timezone)
        }

        const messageText = composeCancellationMessage(messageData)
        const result = await sendTemplateMessage(customer.phoneE164, WHATSAPP_TEMPLATES.CANCELLATION, messageText)

        if (!result.success) {
            // 6a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, result.error)

            console.error(`[Notification] Failed to send WhatsApp cancellation`, {
                appointmentId,
                businessId: business.id,
                notificationId
            })

            return {
                success: false,
                notificationId,
                error: result.error
            }
        }

        // 6b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        console.info(`[Notification] WhatsApp cancellation sent`, {
            appointmentId,
            businessId: business.id,
            notificationId,
            messageId: result.messageId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // Handle duplicate notification (idempotency)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Notification] WhatsApp cancellation already exists (idempotent)`, {
                appointmentId,
                businessId: business.id
            })
            return {
                success: false,
                notificationId: '',
                error: 'Notification already exists'
            }
        }

        // 7. Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Notification] Unexpected error sending WhatsApp cancellation`, {
            appointmentId,
            businessId: business.id,
            notificationId: notificationId || 'not-created',
            errorType: error instanceof Error ? error.name : 'Unknown'
        })

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

// ============================================================================
// Rescheduled Email - US-10.4
// ============================================================================

/**
 * Send rescheduled email when an appointment is reprogrammed
 *
 * IMPORTANT: This function NEVER throws exceptions.
 *
 * @param prisma - Prisma client
 * @param input - Appointment and customer data
 * @returns Result with success status and notification ID
 */
export async function sendRescheduledEmail(
    prisma: PrismaClient,
    input: SendRescheduledEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, createdAt, business, service, resource, customer, originalStartAt, newStartAt } = input

    // 1. Skip if customer has no email
    if (!customer.email) {
        console.info(`[Notification] Skipping rescheduled email: no customer email`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Customer has no email address'
        }
    }

    // 2. Skip if email notifications are disabled for business
    if (!business.emailNotificationsEnabled) {
        console.info(`[Notification] Skipping rescheduled email: email channel disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Email notifications are disabled'
        }
    }

    // 3. Skip if email is not enabled (missing API key)
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
        // 4. Create notification record with PENDING status
        // Use createdAt as scheduledFor for idempotency (new appointment creation time)
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'EMAIL',
            type: 'RESCHEDULED',
            recipient: 'CUSTOMER',
            to: customer.email,
            scheduledFor: createdAt
        })
        notificationId = notification.id

        // 5. Prepare email data
        const emailData: RescheduledEmailData = {
            customerName: customer.fullName,
            businessName: business.name,
            serviceName: service.name,
            resourceName: resource.name,
            resourceLabel: business.resourceLabel,
            originalFormattedDateTime: formatDateTimeForNotification(originalStartAt, business.timezone),
            newFormattedDateTime: formatDateTimeForNotification(newStartAt, business.timezone),
            address: business.address
        }

        // 6. Send email via Resend
        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: customer.email,
            subject: `Turno reprogramado - ${business.name}`,
            html: renderRescheduledEmail(emailData),
            text: renderRescheduledEmailText(emailData)
        })

        if (sendError) {
            // 7a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, sendError.message)

            console.error(`[Notification] Failed to send rescheduled email`, {
                appointmentId,
                businessId: business.id,
                notificationId,
                errorName: sendError.name
            })

            return {
                success: false,
                notificationId,
                error: sendError.message
            }
        }

        // 7b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        console.info(`[Notification] Rescheduled email sent`, {
            appointmentId,
            businessId: business.id,
            notificationId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // Handle duplicate notification (idempotency)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Notification] Rescheduled email already exists (idempotent)`, {
                appointmentId,
                businessId: business.id
            })
            return {
                success: false,
                notificationId: '',
                error: 'Notification already exists'
            }
        }

        // 8. Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Notification] Unexpected error sending rescheduled email`, {
            appointmentId,
            businessId: business.id,
            notificationId: notificationId || 'not-created',
            errorType: error instanceof Error ? error.name : 'Unknown'
        })

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

// ============================================================================
// Rescheduled WhatsApp - US-10.4
// ============================================================================

/**
 * Data needed to compose the rescheduled message
 */
interface RescheduledMessageData {
    businessName: string
    serviceName: string
    resourceLabel: string
    resourceName: string
    originalFormattedDateTime: string
    newFormattedDateTime: string
    timezone: string
}

/**
 * Compose rescheduled message text for WhatsApp
 */
function composeRescheduledMessage(data: RescheduledMessageData): string {
    return [
        `📍 ${data.businessName}`,
        `📋 Servicio: ${data.serviceName}`,
        `👤 ${data.resourceLabel}: ${data.resourceName}`,
        `📅 Fecha anterior: ${data.originalFormattedDateTime}`,
        `✅ Nueva fecha: ${data.newFormattedDateTime}`,
        `🕐 Zona horaria: ${data.timezone}`,
        `¡Te esperamos!`
    ].join(' | ')
}

/**
 * Send rescheduled WhatsApp message when an appointment is reprogrammed
 *
 * IMPORTANT: This function NEVER throws exceptions.
 *
 * @param prisma - Prisma client
 * @param input - Appointment and customer data
 * @returns Result with success status and notification ID
 */
export async function sendRescheduledWhatsApp(
    prisma: PrismaClient,
    input: SendRescheduledWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, createdAt, business, service, resource, customer, originalStartAt, newStartAt } = input

    // 1. Skip if customer has no phoneE164
    if (!customer.phoneE164) {
        console.info(`[Notification] Skipping WhatsApp rescheduled: no valid phone`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Customer has no valid phone number'
        }
    }

    // 2. Skip if WhatsApp notifications are disabled for business
    if (!business.whatsappNotificationsEnabled) {
        console.info(`[Notification] Skipping WhatsApp rescheduled: channel disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp notifications are disabled'
        }
    }

    // 3. Skip if WhatsApp is not enabled (missing env vars)
    if (!isWhatsAppEnabled()) {
        console.warn(`[Notification] WhatsApp sending disabled: missing configuration`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp sending is disabled'
        }
    }

    let notificationId = ''

    try {
        // 4. Create notification record with PENDING status
        // Use createdAt as scheduledFor for idempotency (new appointment creation time)
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'WHATSAPP',
            type: 'RESCHEDULED',
            recipient: 'CUSTOMER',
            to: customer.phoneE164,
            scheduledFor: createdAt
        })
        notificationId = notification.id

        // 5. Compose and send message
        const messageData: RescheduledMessageData = {
            businessName: business.name,
            serviceName: service.name,
            resourceLabel: business.resourceLabel,
            resourceName: resource.name,
            originalFormattedDateTime: formatDateTimeForNotification(originalStartAt, business.timezone),
            newFormattedDateTime: formatDateTimeForNotification(newStartAt, business.timezone),
            timezone: getTimezoneDisplayName(business.timezone)
        }

        const messageText = composeRescheduledMessage(messageData)
        const result = await sendTemplateMessage(customer.phoneE164, WHATSAPP_TEMPLATES.RESCHEDULED, messageText)

        if (!result.success) {
            // 6a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, result.error)

            console.error(`[Notification] Failed to send WhatsApp rescheduled`, {
                appointmentId,
                businessId: business.id,
                notificationId
            })

            return {
                success: false,
                notificationId,
                error: result.error
            }
        }

        // 6b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        console.info(`[Notification] WhatsApp rescheduled sent`, {
            appointmentId,
            businessId: business.id,
            notificationId,
            messageId: result.messageId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // Handle duplicate notification (idempotency)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Notification] WhatsApp rescheduled already exists (idempotent)`, {
                appointmentId,
                businessId: business.id
            })
            return {
                success: false,
                notificationId: '',
                error: 'Notification already exists'
            }
        }

        // 7. Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Notification] Unexpected error sending WhatsApp rescheduled`, {
            appointmentId,
            businessId: business.id,
            notificationId: notificationId || 'not-created',
            errorType: error instanceof Error ? error.name : 'Unknown'
        })

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

// ============================================================================
// Business Owner Notifications
// ============================================================================

/**
 * Helper to handle the common try/catch + status update pattern for business notifications.
 * Reduces boilerplate across the 6 sendBusiness* functions.
 */
async function withBusinessNotification(
    prisma: PrismaClient,
    context: {
        appointmentId: string
        businessId: string
        channel: 'EMAIL' | 'WHATSAPP'
        type: 'CONFIRMATION' | 'CANCELLATION' | 'RESCHEDULED'
        to: string
        scheduledFor: Date
    },
    sendFn: (notificationId: string) => Promise<{ success: boolean; error?: string }>
): Promise<SendNotificationResult> {
    let notificationId = ''
    try {
        const notification = await createNotification(prisma, {
            businessId: context.businessId,
            appointmentId: context.appointmentId,
            channel: context.channel,
            type: context.type,
            recipient: 'BUSINESS',
            to: context.to,
            scheduledFor: context.scheduledFor
        })
        notificationId = notification.id

        const result = await sendFn(notificationId)

        if (!result.success) {
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, result.error)
            console.error(`[Notification] Failed to send business ${context.type} ${context.channel}`, {
                appointmentId: context.appointmentId,
                businessId: context.businessId,
                notificationId
            })
            return { success: false, notificationId, error: result.error }
        }

        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())
        console.info(`[Notification] Business ${context.type} ${context.channel} sent`, {
            appointmentId: context.appointmentId,
            businessId: context.businessId,
            notificationId
        })
        return { success: true, notificationId }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Notification] Business ${context.type} ${context.channel} already exists (idempotent)`, {
                appointmentId: context.appointmentId,
                businessId: context.businessId
            })
            return { success: false, notificationId: '', error: 'Notification already exists' }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Notification] Unexpected error sending business ${context.type} ${context.channel}`, {
            appointmentId: context.appointmentId,
            businessId: context.businessId,
            notificationId: notificationId || 'not-created',
            errorType: error instanceof Error ? error.name : 'Unknown'
        })

        if (notificationId) {
            try {
                await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, errorMessage)
            } catch {
                // ignore update error
            }
        }
        return { success: false, notificationId, error: errorMessage }
    }
}

// ---- Business Confirmation Email ----

export async function sendBusinessConfirmationEmail(
    prisma: PrismaClient,
    input: SendBusinessConfirmationEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, business, service, resource, customer, startAt } = input

    if (!business.ownerEmail) {
        return { success: false, notificationId: '', error: 'Business has no owner email' }
    }
    if (!business.ownerEmailNotificationsEnabled) {
        return { success: false, notificationId: '', error: 'Owner email notifications are disabled' }
    }
    if (!isEmailEnabled()) {
        return { success: false, notificationId: '', error: 'Email sending is disabled' }
    }

    return withBusinessNotification(
        prisma,
        {
            appointmentId,
            businessId: business.id,
            channel: 'EMAIL',
            type: 'CONFIRMATION',
            to: business.ownerEmail,
            scheduledFor: startAt
        },
        async () => {
            const emailData: BusinessConfirmationEmailData = {
                businessName: business.name,
                customerName: customer.fullName,
                customerEmail: customer.email ?? null,
                customerPhone: customer.phone ?? null,
                serviceName: service.name,
                resourceName: resource.name,
                resourceLabel: business.resourceLabel,
                formattedDateTime: formatDateTimeForNotification(startAt, business.timezone),
                address: business.address
            }

            const { error: sendError } = await resend!.emails.send({
                from: defaultFromEmail,
                to: business.ownerEmail!,
                subject: `Nuevo turno reservado - ${business.name}`,
                html: renderBusinessConfirmationEmail(emailData),
                text: renderBusinessConfirmationEmailText(emailData)
            })

            if (sendError) {
                return { success: false, error: sendError.message }
            }
            return { success: true }
        }
    )
}

// ---- Business Confirmation WhatsApp ----

export async function sendBusinessConfirmationWhatsApp(
    prisma: PrismaClient,
    input: SendBusinessConfirmationWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, business, service, resource, customer, startAt } = input

    if (!business.ownerPhoneE164) {
        return { success: false, notificationId: '', error: 'Business has no owner phone' }
    }
    if (!business.ownerWhatsappNotificationsEnabled) {
        return { success: false, notificationId: '', error: 'Owner WhatsApp notifications are disabled' }
    }
    if (!isWhatsAppEnabled()) {
        return { success: false, notificationId: '', error: 'WhatsApp sending is disabled' }
    }

    return withBusinessNotification(
        prisma,
        {
            appointmentId,
            businessId: business.id,
            channel: 'WHATSAPP',
            type: 'CONFIRMATION',
            to: business.ownerPhoneE164,
            scheduledFor: startAt
        },
        async () => {
            const formattedDateTime = formatDateTimeForNotification(startAt, business.timezone)
            const timezone = getTimezoneDisplayName(business.timezone)

            const messageText = [
                `📅 Nuevo turno`,
                `👤 Cliente: ${customer.fullName}`,
                `📋 Servicio: ${service.name}`,
                `${business.resourceLabel}: ${resource.name}`,
                `📅 ${formattedDateTime}`,
                `🕐 ${timezone}`
            ].join(' | ')

            const result = await sendTemplateMessage(
                business.ownerPhoneE164!,
                WHATSAPP_TEMPLATES.BUSINESS_CONFIRMATION,
                messageText
            )
            if (!result.success) {
                return { success: false, error: result.error }
            }
            return { success: true }
        }
    )
}

// ---- Business Cancellation Email ----

export async function sendBusinessCancellationEmail(
    prisma: PrismaClient,
    input: SendBusinessCancellationEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, cancelledAt, business, service, resource, customer, startAt } = input

    if (!business.ownerEmail) {
        return { success: false, notificationId: '', error: 'Business has no owner email' }
    }
    if (!business.ownerEmailNotificationsEnabled) {
        return { success: false, notificationId: '', error: 'Owner email notifications are disabled' }
    }
    if (!isEmailEnabled()) {
        return { success: false, notificationId: '', error: 'Email sending is disabled' }
    }

    return withBusinessNotification(
        prisma,
        {
            appointmentId,
            businessId: business.id,
            channel: 'EMAIL',
            type: 'CANCELLATION',
            to: business.ownerEmail,
            scheduledFor: cancelledAt
        },
        async () => {
            const emailData: BusinessCancellationEmailData = {
                businessName: business.name,
                customerName: customer.fullName,
                customerEmail: null,
                customerPhone: null,
                serviceName: service.name,
                resourceName: resource.name,
                resourceLabel: business.resourceLabel,
                formattedDateTime: formatDateTimeForNotification(startAt, business.timezone),
                address: business.address
            }

            const { error: sendError } = await resend!.emails.send({
                from: defaultFromEmail,
                to: business.ownerEmail!,
                subject: `Turno cancelado - ${business.name}`,
                html: renderBusinessCancellationEmail(emailData),
                text: renderBusinessCancellationEmailText(emailData)
            })

            if (sendError) {
                return { success: false, error: sendError.message }
            }
            return { success: true }
        }
    )
}

// ---- Business Cancellation WhatsApp ----

export async function sendBusinessCancellationWhatsApp(
    prisma: PrismaClient,
    input: SendBusinessCancellationWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, cancelledAt, business, service, resource, customer, startAt } = input

    if (!business.ownerPhoneE164) {
        return { success: false, notificationId: '', error: 'Business has no owner phone' }
    }
    if (!business.ownerWhatsappNotificationsEnabled) {
        return { success: false, notificationId: '', error: 'Owner WhatsApp notifications are disabled' }
    }
    if (!isWhatsAppEnabled()) {
        return { success: false, notificationId: '', error: 'WhatsApp sending is disabled' }
    }

    return withBusinessNotification(
        prisma,
        {
            appointmentId,
            businessId: business.id,
            channel: 'WHATSAPP',
            type: 'CANCELLATION',
            to: business.ownerPhoneE164,
            scheduledFor: cancelledAt
        },
        async () => {
            const formattedDateTime = formatDateTimeForNotification(startAt, business.timezone)
            const timezone = getTimezoneDisplayName(business.timezone)

            const messageText = [
                `❌ Turno cancelado`,
                `👤 Cliente: ${customer.fullName}`,
                `📋 Servicio: ${service.name}`,
                `${business.resourceLabel}: ${resource.name}`,
                `📅 ${formattedDateTime}`,
                `🕐 ${timezone}`
            ].join(' | ')

            const result = await sendTemplateMessage(
                business.ownerPhoneE164!,
                WHATSAPP_TEMPLATES.BUSINESS_CANCELLATION,
                messageText
            )
            if (!result.success) {
                return { success: false, error: result.error }
            }
            return { success: true }
        }
    )
}

// ---- Business Rescheduled Email ----

export async function sendBusinessRescheduledEmail(
    prisma: PrismaClient,
    input: SendBusinessRescheduledEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, createdAt, business, service, resource, customer, originalStartAt, newStartAt } = input

    if (!business.ownerEmail) {
        return { success: false, notificationId: '', error: 'Business has no owner email' }
    }
    if (!business.ownerEmailNotificationsEnabled) {
        return { success: false, notificationId: '', error: 'Owner email notifications are disabled' }
    }
    if (!isEmailEnabled()) {
        return { success: false, notificationId: '', error: 'Email sending is disabled' }
    }

    return withBusinessNotification(
        prisma,
        {
            appointmentId,
            businessId: business.id,
            channel: 'EMAIL',
            type: 'RESCHEDULED',
            to: business.ownerEmail,
            scheduledFor: createdAt
        },
        async () => {
            const emailData: BusinessRescheduledEmailData = {
                businessName: business.name,
                customerName: customer.fullName,
                customerEmail: null,
                customerPhone: null,
                serviceName: service.name,
                resourceName: resource.name,
                resourceLabel: business.resourceLabel,
                previousFormattedDateTime: formatDateTimeForNotification(originalStartAt, business.timezone),
                newFormattedDateTime: formatDateTimeForNotification(newStartAt, business.timezone),
                address: business.address
            }

            const { error: sendError } = await resend!.emails.send({
                from: defaultFromEmail,
                to: business.ownerEmail!,
                subject: `Turno reprogramado - ${business.name}`,
                html: renderBusinessRescheduledEmail(emailData),
                text: renderBusinessRescheduledEmailText(emailData)
            })

            if (sendError) {
                return { success: false, error: sendError.message }
            }
            return { success: true }
        }
    )
}

// ---- Business Rescheduled WhatsApp ----

export async function sendBusinessRescheduledWhatsApp(
    prisma: PrismaClient,
    input: SendBusinessRescheduledWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, createdAt, business, service, resource, customer, originalStartAt, newStartAt } = input

    if (!business.ownerPhoneE164) {
        return { success: false, notificationId: '', error: 'Business has no owner phone' }
    }
    if (!business.ownerWhatsappNotificationsEnabled) {
        return { success: false, notificationId: '', error: 'Owner WhatsApp notifications are disabled' }
    }
    if (!isWhatsAppEnabled()) {
        return { success: false, notificationId: '', error: 'WhatsApp sending is disabled' }
    }

    return withBusinessNotification(
        prisma,
        {
            appointmentId,
            businessId: business.id,
            channel: 'WHATSAPP',
            type: 'RESCHEDULED',
            to: business.ownerPhoneE164,
            scheduledFor: createdAt
        },
        async () => {
            const originalFmt = formatDateTimeForNotification(originalStartAt, business.timezone)
            const newFmt = formatDateTimeForNotification(newStartAt, business.timezone)
            const timezone = getTimezoneDisplayName(business.timezone)

            const messageText = [
                `🔄 Turno reprogramado`,
                `👤 Cliente: ${customer.fullName}`,
                `📋 Servicio: ${service.name}`,
                `${business.resourceLabel}: ${resource.name}`,
                `📅 Antes: ${originalFmt}`,
                `✅ Ahora: ${newFmt}`,
                `🕐 ${timezone}`
            ].join(' | ')

            const result = await sendTemplateMessage(
                business.ownerPhoneE164!,
                WHATSAPP_TEMPLATES.BUSINESS_RESCHEDULED,
                messageText
            )
            if (!result.success) {
                return { success: false, error: result.error }
            }
            return { success: true }
        }
    )
}
