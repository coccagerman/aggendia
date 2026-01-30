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
 * Returns true if a notification with same appointment, type, and scheduledFor exists
 */
export async function notificationExists(
    prisma: PrismaClient,
    appointmentId: string,
    type: NotificationType,
    scheduledFor: Date
): Promise<boolean> {
    const existing = await prisma.notification.findUnique({
        where: {
            appointmentId_type_scheduledFor: {
                appointmentId,
                type,
                scheduledFor
            }
        },
        select: { id: true }
    })

    return existing !== null
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
