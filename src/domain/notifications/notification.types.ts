/**
 * Domain types for notifications
 * @see docs/user-stories.md - US-8.1, US-8.2, US-8.3, US-10.2
 * @see docs/data-model.md - notifications entity
 */

// Re-export Prisma enums for domain use
export type NotificationChannel = 'EMAIL' | 'WHATSAPP'
export type NotificationType = 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'RESCHEDULED'
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED'
export type NotificationRecipient = 'CUSTOMER' | 'BUSINESS'

/**
 * Notification entity (domain representation)
 */
export interface Notification {
    id: string
    businessId: string
    appointmentId: string
    channel: NotificationChannel
    type: NotificationType
    recipient: NotificationRecipient
    to: string
    status: NotificationStatus
    scheduledFor: Date
    sentAt: Date | null
    error: string | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Input for creating a notification record
 */
export interface CreateNotificationInput {
    businessId: string
    appointmentId: string
    channel: NotificationChannel
    type: NotificationType
    recipient: NotificationRecipient
    to: string
    scheduledFor: Date
}

/**
 * Input for sending confirmation email
 * Contains all data needed to compose and send the email
 */
export interface SendConfirmationEmailInput {
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
        phone: string | null
    }
    /** Appointment start time (UTC) */
    startAt: Date
    /** Self-service manage URL for cancel/reschedule (optional) */
    manageUrl?: string | null
}

/**
 * Result of sending a notification
 */
export interface SendNotificationResult {
    success: boolean
    notificationId: string
    error?: string
}

/**
 * Input for sending confirmation WhatsApp message
 * Contains all data needed to compose and send the WhatsApp notification
 * @see docs/user-stories.md - US-10.2
 */
export interface SendConfirmationWhatsAppInput {
    /** Appointment ID for tracking */
    appointmentId: string
    /** Business info */
    business: {
        id: string
        name: string
        timezone: string
        resourceLabel: string
        whatsappNotificationsEnabled: boolean
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
        phoneE164: string | null
    }
    /** Appointment start time (UTC) */
    startAt: Date
    /** Self-service manage URL for cancel/reschedule (optional) */
    manageUrl?: string | null
}

/**
 * Input for sending cancellation email
 * Contains all data needed to compose and send the cancellation notification
 * @see docs/user-stories.md - US-10.4
 */
export interface SendCancellationEmailInput {
    /** Appointment ID for tracking */
    appointmentId: string
    /** When the appointment was cancelled (updatedAt) - used for idempotency */
    cancelledAt: Date
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
    /** Original appointment start time (UTC) - what was cancelled */
    startAt: Date
}

/**
 * Input for sending cancellation WhatsApp message
 * Contains all data needed to compose and send the WhatsApp cancellation
 * @see docs/user-stories.md - US-10.4
 */
export interface SendCancellationWhatsAppInput {
    /** Appointment ID for tracking */
    appointmentId: string
    /** When the appointment was cancelled (updatedAt) - used for idempotency */
    cancelledAt: Date
    /** Business info */
    business: {
        id: string
        name: string
        timezone: string
        resourceLabel: string
        whatsappNotificationsEnabled: boolean
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
        phoneE164: string | null
    }
    /** Original appointment start time (UTC) - what was cancelled */
    startAt: Date
}

/**
 * Input for sending rescheduled email
 * Contains all data needed to compose and send the rescheduled notification
 * @see docs/user-stories.md - US-10.4
 */
export interface SendRescheduledEmailInput {
    /** New appointment ID for tracking */
    appointmentId: string
    /** When the new appointment was created - used for idempotency */
    createdAt: Date
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
    /** Original appointment start time (UTC) - what was rescheduled from */
    originalStartAt: Date
    /** New appointment start time (UTC) - what was rescheduled to */
    newStartAt: Date
}

/**
 * Input for sending rescheduled WhatsApp message
 * Contains all data needed to compose and send the WhatsApp rescheduled notification
 * @see docs/user-stories.md - US-10.4
 */
export interface SendRescheduledWhatsAppInput {
    /** New appointment ID for tracking */
    appointmentId: string
    /** When the new appointment was created - used for idempotency */
    createdAt: Date
    /** Business info */
    business: {
        id: string
        name: string
        timezone: string
        resourceLabel: string
        whatsappNotificationsEnabled: boolean
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
        phoneE164: string | null
    }
    /** Original appointment start time (UTC) - what was rescheduled from */
    originalStartAt: Date
    /** New appointment start time (UTC) - what was rescheduled to */
    newStartAt: Date
}

/**
 * Input for sending reminder WhatsApp message
 * Contains all data needed to compose and send the WhatsApp reminder
 * @see docs/user-stories.md - US-10.3
 */
export interface SendReminderWhatsAppInput {
    /** Appointment ID for tracking */
    appointmentId: string
    /** Business info */
    business: {
        id: string
        name: string
        timezone: string
        resourceLabel: string
        remindersEnabled: boolean
        reminderOffsetsMinutes: number[]
        whatsappNotificationsEnabled: boolean
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
        phoneE164: string | null
    }
    /** Appointment start time (UTC) */
    startAt: Date
    /** Offset in minutes (1440 = 24h, 120 = 2h) */
    offsetMinutes: number
    /** Self-service manage URL for cancel/reschedule (optional) */
    manageUrl?: string | null
}

// ============================================================================
// Business (owner) notification inputs
// ============================================================================

/**
 * Common business owner info needed for sending notifications to the business
 */
export interface BusinessOwnerNotificationConfig {
    id: string
    name: string
    timezone: string
    resourceLabel: string
    address: string | null
    ownerEmail: string | null
    ownerPhoneE164: string | null
    ownerEmailNotificationsEnabled: boolean
    ownerWhatsappNotificationsEnabled: boolean
}

/**
 * Input for sending confirmation email to the business owner
 */
export interface SendBusinessConfirmationEmailInput {
    appointmentId: string
    business: BusinessOwnerNotificationConfig
    service: { id: string; name: string }
    resource: { id: string; name: string }
    customer: { fullName: string; email: string | null; phone: string | null }
    startAt: Date
}

/**
 * Input for sending confirmation WhatsApp to the business owner
 */
export interface SendBusinessConfirmationWhatsAppInput {
    appointmentId: string
    business: BusinessOwnerNotificationConfig
    service: { id: string; name: string }
    resource: { id: string; name: string }
    customer: { fullName: string }
    startAt: Date
}

/**
 * Input for sending cancellation email to the business owner
 */
export interface SendBusinessCancellationEmailInput {
    appointmentId: string
    cancelledAt: Date
    business: BusinessOwnerNotificationConfig
    service: { id: string; name: string }
    resource: { id: string; name: string }
    customer: { fullName: string }
    startAt: Date
}

/**
 * Input for sending cancellation WhatsApp to the business owner
 */
export interface SendBusinessCancellationWhatsAppInput {
    appointmentId: string
    cancelledAt: Date
    business: BusinessOwnerNotificationConfig
    service: { id: string; name: string }
    resource: { id: string; name: string }
    customer: { fullName: string }
    startAt: Date
}

/**
 * Input for sending rescheduled email to the business owner
 */
export interface SendBusinessRescheduledEmailInput {
    appointmentId: string
    createdAt: Date
    business: BusinessOwnerNotificationConfig
    service: { id: string; name: string }
    resource: { id: string; name: string }
    customer: { fullName: string }
    originalStartAt: Date
    newStartAt: Date
}

/**
 * Input for sending rescheduled WhatsApp to the business owner
 */
export interface SendBusinessRescheduledWhatsAppInput {
    appointmentId: string
    createdAt: Date
    business: BusinessOwnerNotificationConfig
    service: { id: string; name: string }
    resource: { id: string; name: string }
    customer: { fullName: string }
    originalStartAt: Date
    newStartAt: Date
}
