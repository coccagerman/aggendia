/**
 * Unit tests for reminder service
 * Tests sendReminderEmail and processReminders business logic
 *
 * @see docs/user-stories.md - US-8.2, US-8.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    sendReminderEmail,
    SendReminderEmailInput,
    calculateScheduledFor,
    calculateQueryWindow,
    ALLOWED_OFFSETS
} from '@/domain/notifications/reminder.service'

// Mock the resend client module
vi.mock('@/lib/resend/client', () => ({
    resend: {
        emails: {
            send: vi.fn()
        }
    },
    defaultFromEmail: 'test@example.com',
    isEmailEnabled: vi.fn()
}))

// Mock the notification repository
vi.mock('@/data/repositories/notification.repo', () => ({
    createNotification: vi.fn(),
    updateNotificationStatus: vi.fn(),
    notificationExists: vi.fn()
}))

// Mock the appointment repository
vi.mock('@/data/repositories/appointment.repo', () => ({
    findEligibleAppointmentsForReminders: vi.fn()
}))

import { resend, isEmailEnabled } from '@/lib/resend/client'
import { createNotification, updateNotificationStatus } from '@/data/repositories/notification.repo'
import { PrismaClient } from '@prisma/client'

describe('reminder.service', () => {
    // Mock Prisma client
    const mockPrisma = {} as PrismaClient

    // Valid test input for sendReminderEmail
    const validInput: SendReminderEmailInput = {
        appointmentId: 'appointment-123',
        business: {
            id: 'business-456',
            name: 'Test Business',
            timezone: 'America/Argentina/Buenos_Aires',
            resourceLabel: 'Profesional',
            address: 'Av. Test 123',
            emailNotificationsEnabled: true
        },
        service: {
            id: 'service-789',
            name: 'Corte de pelo'
        },
        resource: {
            id: 'resource-abc',
            name: 'Juan García'
        },
        customer: {
            fullName: 'María López',
            email: 'maria@example.com'
        },
        startAt: new Date('2026-01-15T14:00:00.000Z'),
        offsetMinutes: 1440 // 24h
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('sendReminderEmail', () => {
        describe('when customer has no email', () => {
            it('should skip email sending and return failure result', async () => {
                const inputWithoutEmail: SendReminderEmailInput = {
                    ...validInput,
                    customer: {
                        ...validInput.customer,
                        email: null
                    }
                }

                const result = await sendReminderEmail(mockPrisma, inputWithoutEmail)

                expect(result.success).toBe(false)
                expect(result.error).toBe('Customer has no email address')
                expect(createNotification).not.toHaveBeenCalled()
                expect(resend?.emails.send).not.toHaveBeenCalled()
            })
        })

        describe('when email is disabled (no API key)', () => {
            it('should skip email sending and return failure result', async () => {
                vi.mocked(isEmailEnabled).mockReturnValue(false)

                const result = await sendReminderEmail(mockPrisma, validInput)

                expect(result.success).toBe(false)
                expect(result.error).toBe('Email sending is disabled')
                expect(createNotification).not.toHaveBeenCalled()
            })
        })

        describe('when email channel is disabled for business', () => {
            it('should skip email sending and return failure result', async () => {
                const inputWithEmailDisabled: SendReminderEmailInput = {
                    ...validInput,
                    business: {
                        ...validInput.business,
                        emailNotificationsEnabled: false
                    }
                }

                const result = await sendReminderEmail(mockPrisma, inputWithEmailDisabled)

                expect(result.success).toBe(false)
                expect(result.error).toBe('Email notifications are disabled')
                expect(createNotification).not.toHaveBeenCalled()
                expect(resend?.emails.send).not.toHaveBeenCalled()
            })
        })

        describe('when email is enabled and customer has email', () => {
            beforeEach(() => {
                vi.mocked(isEmailEnabled).mockReturnValue(true)
            })

            it('should create notification and send email successfully for 24h reminder', async () => {
                const mockNotification = {
                    id: 'notification-123',
                    businessId: validInput.business.id,
                    appointmentId: validInput.appointmentId,
                    channel: 'EMAIL' as const,
                    type: 'REMINDER' as const,
                    to: validInput.customer.email!,
                    status: 'PENDING' as const,
                    scheduledFor: new Date(),
                    sentAt: null,
                    error: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }

                vi.mocked(createNotification).mockResolvedValue(mockNotification)
                vi.mocked(resend!.emails.send).mockResolvedValue({
                    data: { id: 'email-id' },
                    error: null,
                    headers: null
                })
                vi.mocked(updateNotificationStatus).mockResolvedValue({
                    ...mockNotification,
                    status: 'SENT',
                    sentAt: new Date()
                })

                const result = await sendReminderEmail(mockPrisma, validInput)

                expect(result.success).toBe(true)
                expect(result.notificationId).toBe('notification-123')

                // Check notification was created with correct type
                expect(createNotification).toHaveBeenCalledWith(mockPrisma, {
                    businessId: validInput.business.id,
                    appointmentId: validInput.appointmentId,
                    channel: 'EMAIL',
                    type: 'REMINDER',
                    to: validInput.customer.email,
                    scheduledFor: expect.any(Date)
                })

                // Check email was sent with correct subject for 24h reminder
                expect(resend!.emails.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: expect.stringContaining('mañana')
                    })
                )

                // Check status was updated to SENT
                expect(updateNotificationStatus).toHaveBeenCalledWith(
                    mockPrisma,
                    'notification-123',
                    'SENT',
                    expect.any(Date)
                )
            })

            it('should use correct subject for 2h reminder', async () => {
                const input2h: SendReminderEmailInput = {
                    ...validInput,
                    offsetMinutes: 120 // 2h
                }

                const mockNotification = {
                    id: 'notification-123',
                    businessId: input2h.business.id,
                    appointmentId: input2h.appointmentId,
                    channel: 'EMAIL' as const,
                    type: 'REMINDER' as const,
                    to: input2h.customer.email!,
                    status: 'PENDING' as const,
                    scheduledFor: new Date(),
                    sentAt: null,
                    error: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }

                vi.mocked(createNotification).mockResolvedValue(mockNotification)
                vi.mocked(resend!.emails.send).mockResolvedValue({
                    data: { id: 'email-id' },
                    error: null,
                    headers: null
                })
                vi.mocked(updateNotificationStatus).mockResolvedValue({
                    ...mockNotification,
                    status: 'SENT',
                    sentAt: new Date()
                })

                await sendReminderEmail(mockPrisma, input2h)

                // Check email was sent with correct subject for 2h reminder
                expect(resend!.emails.send).toHaveBeenCalledWith(
                    expect.objectContaining({
                        subject: expect.stringContaining('2 horas')
                    })
                )
            })

            it('should handle email send failure and update status to FAILED', async () => {
                const mockNotification = {
                    id: 'notification-123',
                    businessId: validInput.business.id,
                    appointmentId: validInput.appointmentId,
                    channel: 'EMAIL' as const,
                    type: 'REMINDER' as const,
                    to: validInput.customer.email!,
                    status: 'PENDING' as const,
                    scheduledFor: new Date(),
                    sentAt: null,
                    error: null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }

                vi.mocked(createNotification).mockResolvedValue(mockNotification)
                vi.mocked(resend!.emails.send).mockResolvedValue({
                    data: null,
                    error: { name: 'rate_limit_exceeded' as const, message: 'Rate limit exceeded', statusCode: 429 },
                    headers: null
                })
                vi.mocked(updateNotificationStatus).mockResolvedValue({
                    ...mockNotification,
                    status: 'FAILED',
                    error: 'Rate limit exceeded'
                })

                const result = await sendReminderEmail(mockPrisma, validInput)

                expect(result.success).toBe(false)
                expect(result.notificationId).toBe('notification-123')
                expect(result.error).toBe('Rate limit exceeded')

                // Check status was updated to FAILED
                expect(updateNotificationStatus).toHaveBeenCalledWith(
                    mockPrisma,
                    'notification-123',
                    'FAILED',
                    undefined,
                    'Rate limit exceeded'
                )
            })
        })
    })

    describe('calculateScheduledFor', () => {
        it('should calculate correct scheduledFor for 24h offset', () => {
            // Appointment at 2026-01-15 14:00 UTC
            const appointmentStartAt = new Date('2026-01-15T14:00:00.000Z')
            const timezone = 'America/Argentina/Buenos_Aires' // UTC-3

            const scheduledFor = calculateScheduledFor(appointmentStartAt, 1440, timezone)

            // 24h before appointment should be 2026-01-14 14:00 UTC
            const expected = new Date('2026-01-14T14:00:00.000Z')
            expect(scheduledFor.getTime()).toBe(expected.getTime())
        })

        it('should calculate correct scheduledFor for 2h offset', () => {
            // Appointment at 2026-01-15 14:00 UTC
            const appointmentStartAt = new Date('2026-01-15T14:00:00.000Z')
            const timezone = 'America/Argentina/Buenos_Aires'

            const scheduledFor = calculateScheduledFor(appointmentStartAt, 120, timezone)

            // 2h before appointment should be 2026-01-15 12:00 UTC
            const expected = new Date('2026-01-15T12:00:00.000Z')
            expect(scheduledFor.getTime()).toBe(expected.getTime())
        })
    })

    describe('calculateQueryWindow', () => {
        it('should create 10-minute window around target time', () => {
            const now = new Date('2026-01-14T14:00:00.000Z')
            const timezone = 'America/Argentina/Buenos_Aires'

            const { windowStart, windowEnd } = calculateQueryWindow(now, 1440, timezone)

            // Target would be now + 1440 min = 2026-01-15T14:00:00Z
            // Window should be -5min to +5min
            const expectedStart = new Date('2026-01-15T13:55:00.000Z')
            const expectedEnd = new Date('2026-01-15T14:05:00.000Z')

            expect(windowStart.getTime()).toBe(expectedStart.getTime())
            expect(windowEnd.getTime()).toBe(expectedEnd.getTime())
        })
    })

    describe('ALLOWED_OFFSETS constant', () => {
        it('should contain only 24h and 2h offsets', () => {
            expect(ALLOWED_OFFSETS).toEqual([1440, 120])
        })
    })
})
