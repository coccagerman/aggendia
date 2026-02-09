/**
 * Domain service for reminder notifications
 * Handles automatic reminder email and WhatsApp sending for appointments
 *
 * @see docs/user-stories.md - US-8.2, US-8.3, US-10.3
 *
 * Key design decisions:
 * - Non-blocking: errors are caught and logged, never propagated
 * - Persistent: all attempts are recorded in notifications table
 * - Idempotent: duplicate reminders are prevented by DB constraint
 * - Timezone-aware: uses Luxon for precise DST handling
 * - Channel isolation: email and WhatsApp failures don't affect each other
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { DateTime } from 'luxon'
import { SendNotificationResult, SendReminderWhatsAppInput } from './notification.types'
import { createNotification, updateNotificationStatus, notificationExists } from '@/data/repositories/notification.repo'
import { findEligibleAppointmentsForReminders } from '@/data/repositories/appointment.repo'
import { getBusinessesForReminderOffset } from '@/data/repositories/business.repo'
import { resend, defaultFromEmail, isEmailEnabled } from '@/lib/resend/client'
import { sendTemplateMessage, isWhatsAppEnabled, WHATSAPP_TEMPLATES } from '@/lib/whatsapp/client'
import { formatDateTimeForNotification, getTimezoneDisplayName } from '@/lib/notifications/notification-time'
import { buildAppointmentManageUrl } from '@/lib/notifications/manage-url'
import {
    renderReminderEmail,
    renderReminderEmailText,
    ReminderEmailData
} from '@/lib/resend/templates/reminder.template'

/**
 * Input for sending a reminder email
 */
export interface SendReminderEmailInput {
    /** Appointment ID for tracking */
    appointmentId: string
    /** Business info */
    business: {
        id: string
        name: string
        timezone: string
        resourceLabel: string
        address?: string | null
        emailNotificationsEnabled: boolean
    }
    /** Service info */
    service: {
        id: string
        name: string
    }
    /** Resource info */
    resource: {
        id: string
        name: string
    }
    /** Customer info */
    customer: {
        fullName: string
        email: string | null
    }
    /** Appointment start time (UTC) */
    startAt: Date
    /** Offset in minutes (1440 = 24h, 120 = 2h) */
    offsetMinutes: number
    /** Self-service manage URL for cancel/reschedule (optional) */
    manageUrl?: string | null
}

/**
 * Result of processing reminders
 */
export interface ProcessRemindersResult {
    totalProcessed: number
    sent: number
    failed: number
    skipped: number
    errors: string[]
}

/**
 * Options for processing reminders
 */
export interface ProcessRemindersOptions {
    /** Filter by business ID (for testing) */
    businessId?: string
    /** Dry run mode - don't actually send emails */
    dryRun?: boolean
    /** Custom "now" for testing */
    now?: Date
}

/**
 * Allowed reminder offsets in minutes
 */
export const ALLOWED_OFFSETS = [1440, 120] as const
export type ReminderOffset = (typeof ALLOWED_OFFSETS)[number]

/**
 * Window margin in minutes for querying eligible appointments
 * This accounts for cron execution interval (10 min) with safety margin
 */
const QUERY_WINDOW_MINUTES = 5

/**
 * Get reminder type label based on offset
 */
function getReminderType(offsetMinutes: number): '24h' | '2h' {
    return offsetMinutes === 1440 ? '24h' : '2h'
}

/**
 * Data needed to compose the reminder message for WhatsApp
 */
interface ReminderMessageData {
    businessName: string
    serviceName: string
    resourceLabel: string
    resourceName: string
    formattedDateTime: string
    timezone: string
    reminderType: '24h' | '2h'
    manageUrl?: string | null
}

/**
 * Compose reminder message text for WhatsApp
 *
 * Isolated function to allow future migration to template-based messages.
 * In DEV/sandbox: returns plain text message
 * In PROD (future): will return template parameters instead
 *
 * @param data - Message composition data
 * @returns Formatted text message
 */
function composeReminderMessage(data: ReminderMessageData): string {
    const header = data.reminderType === '24h' ? 'Tu turno es mañana' : 'Tu turno es en 2 horas'

    const lines = [
        header,
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
 * Calculate scheduledFor time for a reminder
 * Uses Luxon for precise timezone/DST handling
 *
 * @param appointmentStartAt - Appointment start time (UTC)
 * @param offsetMinutes - Offset before appointment (1440 or 120)
 * @param businessTimezone - Business timezone (IANA)
 * @returns scheduledFor time in UTC
 */
export function calculateScheduledFor(appointmentStartAt: Date, offsetMinutes: number, businessTimezone: string): Date {
    // Convert appointment start to business timezone
    const startInTz = DateTime.fromJSDate(appointmentStartAt, { zone: businessTimezone })

    // Subtract offset (respecting DST)
    const scheduledForInTz = startInTz.minus({ minutes: offsetMinutes })

    // Return as UTC Date
    return scheduledForInTz.toUTC().toJSDate()
}

/**
 * Calculate time window for querying eligible appointments
 * Uses Luxon for precise timezone handling
 *
 * @param now - Current time
 * @param offsetMinutes - Offset to look for (1440 or 120)
 * @param businessTimezone - Business timezone
 * @returns Object with start and end of query window (UTC)
 */
export function calculateQueryWindow(
    now: Date,
    offsetMinutes: number,
    businessTimezone: string
): { windowStart: Date; windowEnd: Date } {
    // Convert now to business timezone
    const nowInTz = DateTime.fromJSDate(now, { zone: businessTimezone })

    // Target time is now + offset (appointment time we're looking for)
    const targetInTz = nowInTz.plus({ minutes: offsetMinutes })

    // Create window with margin to account for cron execution interval
    const windowStartInTz = targetInTz.minus({ minutes: QUERY_WINDOW_MINUTES })
    const windowEndInTz = targetInTz.plus({ minutes: QUERY_WINDOW_MINUTES })

    return {
        windowStart: windowStartInTz.toUTC().toJSDate(),
        windowEnd: windowEndInTz.toUTC().toJSDate()
    }
}

/**
 * Send reminder email for an appointment
 *
 * This function:
 * 1. Validates customer has email (skips if not)
 * 2. Creates notification record with PENDING status
 * 3. Attempts to send email via Resend
 * 4. Updates notification status to SENT or FAILED
 *
 * IMPORTANT: This function NEVER throws exceptions.
 * All errors are caught, logged, and persisted for later retry.
 */
export async function sendReminderEmail(
    prisma: PrismaClient,
    input: SendReminderEmailInput
): Promise<SendNotificationResult> {
    const { appointmentId, business, service, resource, customer, startAt, offsetMinutes } = input

    // Calculate scheduledFor time
    const scheduledFor = calculateScheduledFor(startAt, offsetMinutes, business.timezone)

    // 1. Skip if customer has no email
    if (!customer.email) {
        console.info(`[Reminder] Skipping reminder email: no customer email`, {
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
        console.info(`[Reminder] Skipping reminder email: email channel disabled`, {
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
        console.warn(`[Reminder] Email sending disabled: RESEND_API_KEY not configured`, {
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
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'EMAIL',
            type: 'REMINDER',
            to: customer.email,
            scheduledFor
        })
        notificationId = notification.id

        // 4. Prepare email data
        const emailData: ReminderEmailData = {
            customerName: customer.fullName,
            businessName: business.name,
            serviceName: service.name,
            resourceName: resource.name,
            resourceLabel: business.resourceLabel,
            formattedDateTime: formatDateTimeForNotification(startAt, business.timezone, 'reminder'),
            timezone: getTimezoneDisplayName(business.timezone),
            address: business.address,
            reminderType: getReminderType(offsetMinutes),
            manageUrl: input.manageUrl
        }

        // 5. Send email via Resend
        const subject =
            offsetMinutes === 1440
                ? `Recordatorio: tu turno es mañana - ${business.name}`
                : `Recordatorio: tu turno es en 2 horas - ${business.name}`

        const { error: sendError } = await resend!.emails.send({
            from: defaultFromEmail,
            to: customer.email,
            subject,
            html: renderReminderEmail(emailData),
            text: renderReminderEmailText(emailData)
        })

        if (sendError) {
            // 6a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, sendError.message)

            console.error(`[Reminder] Failed to send reminder email`, {
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

        // 6b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        console.info(`[Reminder] Reminder email sent`, {
            appointmentId,
            businessId: business.id,
            notificationId,
            offsetMinutes
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Reminder] Unexpected error sending reminder`, {
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
                console.error(`[Reminder] Failed to update notification status`, {
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

/**
 * Send reminder WhatsApp message for an appointment
 *
 * This function:
 * 1. Validates customer has phoneE164 (skips if not)
 * 2. Validates WhatsApp is enabled for business
 * 3. Revalidates reminders configuration (defensive)
 * 4. Creates notification record with PENDING status
 * 5. Attempts to send message via WhatsApp Cloud API
 * 6. Updates notification status to SENT or FAILED
 *
 * IMPORTANT: This function NEVER throws exceptions.
 * All errors are caught, logged, and persisted for later retry.
 *
 * @see docs/user-stories.md - US-10.3
 */
export async function sendReminderWhatsApp(
    prisma: PrismaClient,
    input: SendReminderWhatsAppInput
): Promise<SendNotificationResult> {
    const { appointmentId, business, service, resource, customer, startAt, offsetMinutes, manageUrl } = input

    // Calculate scheduledFor time
    const scheduledFor = calculateScheduledFor(startAt, offsetMinutes, business.timezone)

    // 1. Skip if customer has no phoneE164
    if (!customer.phoneE164) {
        console.info(`[Reminder] Skipping WhatsApp reminder: no valid phone`, {
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
        console.info(`[Reminder] Skipping WhatsApp reminder: channel disabled`, {
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
        console.warn(`[Reminder] WhatsApp sending disabled: missing configuration`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'WhatsApp sending is disabled'
        }
    }

    // 4. Revalidate reminders are enabled (defensive - config may have changed)
    if (!business.remindersEnabled) {
        console.info(`[Reminder] Skipping WhatsApp reminder: reminders disabled`, {
            appointmentId,
            businessId: business.id
        })
        return {
            success: false,
            notificationId: '',
            error: 'Reminders are disabled'
        }
    }

    // 5. Revalidate offset is configured (defensive)
    if (!business.reminderOffsetsMinutes.includes(offsetMinutes)) {
        console.info(`[Reminder] Skipping WhatsApp reminder: offset not configured`, {
            appointmentId,
            businessId: business.id,
            offsetMinutes
        })
        return {
            success: false,
            notificationId: '',
            error: 'Offset not configured'
        }
    }

    let notificationId = ''

    try {
        // 6. Create notification record with PENDING status
        const notification = await createNotification(prisma, {
            businessId: business.id,
            appointmentId,
            channel: 'WHATSAPP',
            type: 'REMINDER',
            to: customer.phoneE164,
            scheduledFor
        })
        notificationId = notification.id

        // 7. Compose and send message
        const messageData: ReminderMessageData = {
            businessName: business.name,
            serviceName: service.name,
            resourceLabel: business.resourceLabel,
            resourceName: resource.name,
            formattedDateTime: formatDateTimeForNotification(startAt, business.timezone, 'reminder'),
            timezone: getTimezoneDisplayName(business.timezone),
            reminderType: getReminderType(offsetMinutes),
            manageUrl
        }

        const messageText = composeReminderMessage(messageData)
        const result = await sendTemplateMessage(customer.phoneE164, WHATSAPP_TEMPLATES.REMINDER, messageText)

        if (!result.success) {
            // 8a. Update notification status to FAILED
            await updateNotificationStatus(prisma, notificationId, 'FAILED', undefined, result.error)

            // Log without PII
            console.error(`[Reminder] Failed to send WhatsApp reminder`, {
                appointmentId,
                businessId: business.id,
                notificationId,
                offsetMinutes
            })

            return {
                success: false,
                notificationId,
                error: result.error
            }
        }

        // 8b. Update notification status to SENT
        await updateNotificationStatus(prisma, notificationId, 'SENT', new Date())

        // Log without PII
        console.info(`[Reminder] WhatsApp reminder sent`, {
            appointmentId,
            businessId: business.id,
            notificationId,
            offsetMinutes,
            messageId: result.messageId
        })

        return {
            success: true,
            notificationId
        }
    } catch (error) {
        // Handle duplicate notification (idempotency)
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            console.info(`[Reminder] WhatsApp reminder already exists (idempotent)`, {
                appointmentId,
                businessId: business.id
            })
            return {
                success: false,
                notificationId: '',
                error: 'Notification already exists'
            }
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        console.error(`[Reminder] Unexpected error sending WhatsApp reminder`, {
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
                console.error(`[Reminder] Failed to update WhatsApp notification status`, {
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

/**
 * Process all eligible reminders
 *
 * This is the main orchestrator function that:
 * 1. Finds all businesses with reminders enabled
 * 2. For each configured offset, queries eligible appointments
 * 3. Attempts to send reminder for each appointment (both email and WhatsApp)
 * 4. Returns aggregate metrics
 *
 * IMPORTANT: This function catches all errors internally and never throws.
 * Errors are logged and included in the result.
 * Each channel (email/WhatsApp) is processed in isolation - failures don't affect other channels.
 */
export async function processReminders(
    prisma: PrismaClient,
    options: ProcessRemindersOptions = {}
): Promise<ProcessRemindersResult> {
    const { businessId, dryRun = false, now = new Date() } = options

    const result: ProcessRemindersResult = {
        totalProcessed: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        errors: []
    }

    console.info(`[Reminder] Starting reminder processing`, {
        dryRun,
        businessId: businessId || 'all',
        now: now.toISOString()
    })

    try {
        // Process each allowed offset
        for (const offset of ALLOWED_OFFSETS) {
            console.info(`[Reminder] Processing offset ${offset} minutes (${offset === 1440 ? '24h' : '2h'})`)

            const businesses = await getBusinessesForReminderOffset(prisma, offset, businessId)

            if (businesses.length === 0) {
                console.info(`[Reminder] No businesses configured for offset ${offset}`)
                continue
            }

            const businessesByTimezone = new Map<string, string[]>()
            for (const business of businesses) {
                const existing = businessesByTimezone.get(business.timezone)
                if (existing) {
                    existing.push(business.id)
                } else {
                    businessesByTimezone.set(business.timezone, [business.id])
                }
            }

            for (const [timezone, businessIds] of businessesByTimezone) {
                const { windowStart, windowEnd } = calculateQueryWindow(now, offset, timezone)

                // Find eligible appointments for this offset and business
                const appointments = await findEligibleAppointmentsForReminders(prisma, {
                    offsetMinutes: offset,
                    windowStart,
                    windowEnd,
                    businessIds
                })

                console.info(`[Reminder] Found ${appointments.length} eligible appointments`, {
                    businessIdsCount: businessIds.length,
                    timezone,
                    offsetMinutes: offset
                })

                // Process each appointment
                for (const appointment of appointments) {
                    result.totalProcessed++

                    // Calculate scheduledFor for idempotency check
                    const scheduledFor = calculateScheduledFor(
                        appointment.startAt,
                        offset,
                        appointment.business.timezone
                    )

                    // Check if appointment is still SCHEDULED (in case status changed)
                    if (appointment.status !== 'SCHEDULED') {
                        console.info(`[Reminder] Skipping: appointment not SCHEDULED`, {
                            appointmentId: appointment.id,
                            status: appointment.status
                        })
                        result.skipped++
                        continue
                    }

                    // Check if business still has reminders enabled
                    if (!appointment.business.remindersEnabled) {
                        console.info(`[Reminder] Skipping: business reminders disabled`, {
                            appointmentId: appointment.id,
                            businessId: appointment.business.id
                        })
                        result.skipped++
                        continue
                    }

                    // Check if this offset is in the business configuration
                    if (!appointment.business.reminderOffsetsMinutes.includes(offset)) {
                        console.info(`[Reminder] Skipping: offset not configured for business`, {
                            appointmentId: appointment.id,
                            businessId: appointment.business.id,
                            offsetMinutes: offset,
                            configuredOffsets: appointment.business.reminderOffsetsMinutes
                        })
                        result.skipped++
                        continue
                    }

                    // =========================================================
                    // CHANNEL: EMAIL (isolated block)
                    // =========================================================
                    try {
                        // Check if email reminder already exists (idempotency)
                        const emailExists = await notificationExists(
                            prisma,
                            appointment.id,
                            'EMAIL',
                            'REMINDER',
                            scheduledFor
                        )

                        if (emailExists) {
                            console.info(`[Reminder] Skipping EMAIL: reminder already exists`, {
                                appointmentId: appointment.id,
                                offsetMinutes: offset
                            })
                            result.skipped++
                        } else if (!appointment.customer.email) {
                            console.info(`[Reminder] Skipping EMAIL: no customer email`, {
                                appointmentId: appointment.id
                            })
                            result.skipped++
                        } else if (dryRun) {
                            console.info(`[Reminder] DRY RUN: would send EMAIL reminder`, {
                                appointmentId: appointment.id,
                                businessId: appointment.business.id,
                                offsetMinutes: offset
                            })
                            result.sent++
                        } else {
                            // Send the email reminder
                            const manageUrl = buildAppointmentManageUrl(
                                appointment.business.slug,
                                appointment.id,
                                appointment.secretToken
                            )
                            const emailResult = await sendReminderEmail(prisma, {
                                appointmentId: appointment.id,
                                business: appointment.business,
                                service: appointment.service,
                                resource: appointment.resource,
                                customer: appointment.customer,
                                startAt: appointment.startAt,
                                offsetMinutes: offset,
                                manageUrl
                            })

                            if (emailResult.success) {
                                result.sent++
                            } else {
                                result.failed++
                                if (emailResult.error) {
                                    result.errors.push(`${appointment.id} (EMAIL): send_failed`)
                                }
                            }
                        }
                    } catch (emailError) {
                        // Log without PII, never re-throw - continue to WhatsApp
                        console.error(`[Reminder] Unexpected error processing EMAIL`, {
                            appointmentId: appointment.id,
                            errorType: emailError instanceof Error ? emailError.name : 'Unknown'
                        })
                        result.failed++
                    }

                    // =========================================================
                    // CHANNEL: WHATSAPP (isolated block)
                    // =========================================================
                    try {
                        // Check if WhatsApp reminder already exists (idempotency)
                        const whatsappExists = await notificationExists(
                            prisma,
                            appointment.id,
                            'WHATSAPP',
                            'REMINDER',
                            scheduledFor
                        )

                        if (whatsappExists) {
                            console.info(`[Reminder] Skipping WHATSAPP: reminder already exists`, {
                                appointmentId: appointment.id,
                                offsetMinutes: offset
                            })
                            result.skipped++
                        } else if (!appointment.customer.phoneE164) {
                            console.info(`[Reminder] Skipping WHATSAPP: no customer phone`, {
                                appointmentId: appointment.id
                            })
                            result.skipped++
                        } else if (!appointment.business.whatsappNotificationsEnabled) {
                            console.info(`[Reminder] Skipping WHATSAPP: channel disabled for business`, {
                                appointmentId: appointment.id,
                                businessId: appointment.business.id
                            })
                            result.skipped++
                        } else if (dryRun) {
                            console.info(`[Reminder] DRY RUN: would send WHATSAPP reminder`, {
                                appointmentId: appointment.id,
                                businessId: appointment.business.id,
                                offsetMinutes: offset
                            })
                            result.sent++
                        } else {
                            // Send the WhatsApp reminder
                            const reminderManageUrl = buildAppointmentManageUrl(
                                appointment.business.slug,
                                appointment.id,
                                appointment.secretToken
                            )
                            const whatsappResult = await sendReminderWhatsApp(prisma, {
                                appointmentId: appointment.id,
                                business: appointment.business,
                                service: appointment.service,
                                resource: appointment.resource,
                                customer: appointment.customer,
                                startAt: appointment.startAt,
                                offsetMinutes: offset,
                                manageUrl: reminderManageUrl
                            })

                            if (whatsappResult.success) {
                                result.sent++
                            } else {
                                result.failed++
                                if (whatsappResult.error) {
                                    result.errors.push(`${appointment.id} (WHATSAPP): send_failed`)
                                }
                            }
                        }
                    } catch (whatsappError) {
                        // Log without PII, never re-throw - continue to next appointment
                        console.error(`[Reminder] Unexpected error processing WHATSAPP`, {
                            appointmentId: appointment.id,
                            errorType: whatsappError instanceof Error ? whatsappError.name : 'Unknown'
                        })
                        result.failed++
                    }
                }
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Reminder] Critical error during processing`, {
            errorType: error instanceof Error ? error.name : 'Unknown',
            errorMessage
        })
        result.errors.push(`Critical error: ${errorMessage}`)
    }

    console.info(`[Reminder] Processing complete`, {
        totalProcessed: result.totalProcessed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        errorCount: result.errors.length
    })

    return result
}
