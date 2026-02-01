/**
 * Domain types for notifications
 * @see docs/user-stories.md - US-8.1, US-8.2, US-8.3, US-10.2
 * @see docs/data-model.md - notifications entity
 */

// Re-export Prisma enums for domain use
export type NotificationChannel = 'EMAIL' | 'WHATSAPP'
export type NotificationType = 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION' | 'RESCHEDULED'
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED'

/**
 * Notification entity (domain representation)
 */
export interface Notification {
    id: string
    businessId: string
    appointmentId: string
    channel: NotificationChannel
    type: NotificationType
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
}
