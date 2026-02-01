/**
 * Repository for notifications table
 * Handles notification persistence (CRUD) operations
 *
 * @see docs/user-stories.md - US-8.1
 * @see docs/data-model.md - notifications entity
 */

import { PrismaClient, Prisma } from '@prisma/client'
import {
    Notification,
    NotificationStatus,
    NotificationType,
    NotificationChannel,
    CreateNotificationInput
} from '@/domain/notifications/notification.types'

/**
 * Create a notification record
 * Initial status is always PENDING
 *
 * @throws Prisma.PrismaClientKnownRequestError with code P2002 if duplicate
 *         (same appointment_id, type, scheduled_for)
 */
export async function createNotification(prisma: PrismaClient, input: CreateNotificationInput): Promise<Notification> {
    const notification = await prisma.notification.create({
        data: {
            businessId: input.businessId,
            appointmentId: input.appointmentId,
            channel: input.channel,
            type: input.type,
            to: input.to,
            status: 'PENDING',
            scheduledFor: input.scheduledFor
        }
    })

    return mapToNotification(notification)
}

/**
 * Update notification status after send attempt
 */
export async function updateNotificationStatus(
    prisma: PrismaClient,
    notificationId: string,
    status: NotificationStatus,
    sentAt?: Date,
    error?: string
): Promise<Notification> {
    const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: {
            status,
            sentAt: sentAt || null,
            error: error || null
        }
    })

    return mapToNotification(notification)
}

/**
 * Get notification by ID
 */
export async function getNotificationById(prisma: PrismaClient, notificationId: string): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
    })

    return notification ? mapToNotification(notification) : null
}

/**
 * Get notifications by appointment ID
 * Requires businessId for multi-tenant security
 */
export async function getNotificationsByAppointmentId(
    prisma: PrismaClient,
    businessId: string,
    appointmentId: string
): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
        where: { businessId, appointmentId },
        orderBy: { createdAt: 'desc' }
    })

    return notifications.map(mapToNotification)
}

/**
 * Get failed notifications for retry
 * Used by future retry job
 */
export async function getFailedNotifications(
    prisma: PrismaClient,
    businessId: string,
    type?: NotificationType,
    limit: number = 100
): Promise<Notification[]> {
    const notifications = await prisma.notification.findMany({
        where: {
            businessId,
            status: 'FAILED',
            ...(type ? { type } : {})
        },
        orderBy: { createdAt: 'asc' },
        take: limit
    })

    return notifications.map(mapToNotification)
}

/**
 * Check if a notification already exists (idempotency check)
 * Returns true if a notification with same appointment, channel, type, and scheduledFor exists
 *
 * Note: The unique constraint includes channel to allow independent notifications
 * per channel (EMAIL and WHATSAPP) for the same appointment and type.
 */
export async function notificationExists(
    prisma: PrismaClient,
    appointmentId: string,
    channel: NotificationChannel,
    type: NotificationType,
    scheduledFor: Date
): Promise<boolean> {
    const existing = await prisma.notification.findUnique({
        where: {
            appointmentId_channel_type_scheduledFor: {
                appointmentId,
                channel,
                type,
                scheduledFor
            }
        },
        select: { id: true }
    })

    return existing !== null
}

/**
 * Get pending notifications ready to be sent
 * Returns notifications with PENDING status up to the specified limit
 * Used by cron job to process queued notifications
 */
export type PendingNotificationWithAppointment = Notification & {
    appointment: {
        customer: { fullName: string; email: string | null; phoneE164: string | null }
        service: { id: string; name: string }
        resource: { id: string; name: string }
        business: {
            id: string
            name: string
            timezone: string
            resourceLabel: string
            address: string | null
            emailNotificationsEnabled: boolean
            whatsappNotificationsEnabled: boolean
        }
        startAt: Date
        rescheduledFrom: { startAt: Date } | null
    }
}

export async function getPendingNotifications(
    prisma: PrismaClient,
    limit: number = 100,
    now: Date = new Date()
): Promise<PendingNotificationWithAppointment[]> {
    const notifications = await prisma.notification.findMany({
        where: {
            status: 'PENDING',
            scheduledFor: { lte: now }
        },
        include: {
            appointment: {
                include: {
                    customer: {
                        select: {
                            fullName: true,
                            email: true,
                            phoneE164: true
                        }
                    },
                    service: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    resource: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    business: {
                        select: {
                            id: true,
                            name: true,
                            timezone: true,
                            resourceLabel: true,
                            address: true,
                            emailNotificationsEnabled: true,
                            whatsappNotificationsEnabled: true
                        }
                    },
                    rescheduledFrom: {
                        select: {
                            startAt: true
                        }
                    }
                }
            }
        },
        orderBy: { scheduledFor: 'asc' },
        take: limit
    })

    return notifications.map(n => ({
        ...mapToNotification(n),
        appointment: {
            customer: n.appointment.customer,
            service: n.appointment.service,
            resource: n.appointment.resource,
            business: n.appointment.business,
            startAt: n.appointment.startAt,
            rescheduledFrom: n.appointment.rescheduledFrom
        }
    }))
}

/**
 * Map Prisma model to domain type
 */
function mapToNotification(prismaNotification: Prisma.NotificationGetPayload<object>): Notification {
    return {
        id: prismaNotification.id,
        businessId: prismaNotification.businessId,
        appointmentId: prismaNotification.appointmentId,
        channel: prismaNotification.channel as NotificationChannel,
        type: prismaNotification.type as NotificationType,
        to: prismaNotification.to,
        status: prismaNotification.status as NotificationStatus,
        scheduledFor: prismaNotification.scheduledFor,
        sentAt: prismaNotification.sentAt,
        error: prismaNotification.error,
        createdAt: prismaNotification.createdAt,
        updatedAt: prismaNotification.updatedAt
    }
}
