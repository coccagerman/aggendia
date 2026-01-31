/**
 * Domain types for notifications
 * @see docs/user-stories.md - US-8.1, US-8.2, US-8.3
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
