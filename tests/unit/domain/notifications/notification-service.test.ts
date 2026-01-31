/**
 * Unit tests for notification domain service
 * Tests sendConfirmationEmail business logic
 *
 * @see docs/user-stories.md - US-8.1 Confirmación de reserva por email
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendConfirmationEmail } from '@/domain/notifications/notification.service'
import { SendConfirmationEmailInput } from '@/domain/notifications/notification.types'

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
    updateNotificationStatus: vi.fn()
}))

import { resend, isEmailEnabled } from '@/lib/resend/client'
import { createNotification, updateNotificationStatus } from '@/data/repositories/notification.repo'
import { PrismaClient } from '@prisma/client'

describe('sendConfirmationEmail', () => {
    // Mock Prisma client
    const mockPrisma = {} as PrismaClient

    // Valid test input
    const validInput: SendConfirmationEmailInput = {
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
            email: 'maria@example.com',
            phone: '+54 11 1234-5678'
        },
        startAt: new Date('2026-01-15T14:00:00.000Z')
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('when customer has no email', () => {
        it('should skip email sending and return failure result', async () => {
            const inputWithoutEmail: SendConfirmationEmailInput = {
                ...validInput,
                customer: {
                    ...validInput.customer,
                    email: null
                }
            }

            const result = await sendConfirmationEmail(mockPrisma, inputWithoutEmail)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Customer has no email address')
            expect(createNotification).not.toHaveBeenCalled()
            expect(resend?.emails.send).not.toHaveBeenCalled()
        })
    })

    describe('when email is disabled (no API key)', () => {
        it('should skip email sending and return failure result', async () => {
            vi.mocked(isEmailEnabled).mockReturnValue(false)

            const result = await sendConfirmationEmail(mockPrisma, validInput)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Email sending is disabled')
            expect(createNotification).not.toHaveBeenCalled()
        })
    })

    describe('when email channel is disabled for business', () => {
        it('should skip email sending and return failure result', async () => {
            const inputWithEmailDisabled: SendConfirmationEmailInput = {
                ...validInput,
                business: {
                    ...validInput.business,
                    emailNotificationsEnabled: false
                }
            }

            const result = await sendConfirmationEmail(mockPrisma, inputWithEmailDisabled)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Email notifications are disabled')
            expect(createNotification).not.toHaveBeenCalled()
            expect(resend?.emails.send).not.toHaveBeenCalled()
        })
    })

    describe('when email is enabled', () => {
        beforeEach(() => {
            vi.mocked(isEmailEnabled).mockReturnValue(true)
            vi.mocked(createNotification).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'PENDING',
                scheduledFor: new Date(),
                sentAt: null,
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })
        })

        it('should send email successfully and update notification to SENT', async () => {
            vi.mocked(resend!.emails.send).mockResolvedValue({
                data: { id: 'resend-msg-123' },
                error: null,
                headers: null
            })
            vi.mocked(updateNotificationStatus).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'SENT',
                scheduledFor: new Date(),
                sentAt: new Date(),
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            const result = await sendConfirmationEmail(mockPrisma, validInput)

            expect(result.success).toBe(true)
            expect(result.notificationId).toBe('notification-123')

            // Verify notification was created
            expect(createNotification).toHaveBeenCalledWith(mockPrisma, {
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email,
                scheduledFor: expect.any(Date)
            })

            // Verify email was sent with correct data
            expect(resend!.emails.send).toHaveBeenCalledWith({
                from: 'test@example.com',
                to: validInput.customer.email,
                subject: `Turno confirmado - ${validInput.business.name}`,
                html: expect.stringContaining('Turno confirmado'),
                text: expect.stringContaining('TURNO CONFIRMADO')
            })

            // Verify notification was updated to SENT
            expect(updateNotificationStatus).toHaveBeenCalledWith(
                mockPrisma,
                'notification-123',
                'SENT',
                expect.any(Date)
            )
        })

        it('should handle Resend API error and update notification to FAILED', async () => {
            const resendError = { message: 'Invalid API key', name: 'validation_error' as const, statusCode: 401 }
            vi.mocked(resend!.emails.send).mockResolvedValue({
                data: null,
                error: resendError,
                headers: null
            })
            vi.mocked(updateNotificationStatus).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'FAILED',
                scheduledFor: new Date(),
                sentAt: null,
                error: resendError.message,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            const result = await sendConfirmationEmail(mockPrisma, validInput)

            expect(result.success).toBe(false)
            expect(result.notificationId).toBe('notification-123')
            expect(result.error).toBe('Invalid API key')

            // Verify notification was updated to FAILED
            expect(updateNotificationStatus).toHaveBeenCalledWith(
                mockPrisma,
                'notification-123',
                'FAILED',
                undefined,
                'Invalid API key'
            )
        })

        it('should handle unexpected errors gracefully', async () => {
            vi.mocked(resend!.emails.send).mockRejectedValue(new Error('Network error'))
            vi.mocked(updateNotificationStatus).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'FAILED',
                scheduledFor: new Date(),
                sentAt: null,
                error: 'Network error',
                createdAt: new Date(),
                updatedAt: new Date()
            })

            const result = await sendConfirmationEmail(mockPrisma, validInput)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Network error')

            // Verify notification was updated to FAILED
            expect(updateNotificationStatus).toHaveBeenCalledWith(
                mockPrisma,
                'notification-123',
                'FAILED',
                undefined,
                'Network error'
            )
        })

        it('should include all appointment details in email', async () => {
            vi.mocked(resend!.emails.send).mockResolvedValue({
                data: { id: 'resend-msg-123' },
                error: null,
                headers: null
            })
            vi.mocked(updateNotificationStatus).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'SENT',
                scheduledFor: new Date(),
                sentAt: new Date(),
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            await sendConfirmationEmail(mockPrisma, validInput)

            const sendCall = vi.mocked(resend!.emails.send).mock.calls[0][0]

            // Verify HTML contains all required info
            expect(sendCall.html).toContain(validInput.business.name)
            expect(sendCall.html).toContain(validInput.service.name)
            expect(sendCall.html).toContain(validInput.resource.name)
            expect(sendCall.html).toContain(validInput.customer.fullName)
            expect(sendCall.html).toContain(validInput.business.address)

            // Verify plain text contains all required info
            expect(sendCall.text).toContain(validInput.business.name)
            expect(sendCall.text).toContain(validInput.service.name)
            expect(sendCall.text).toContain(validInput.resource.name)
        })
    })

    describe('email content', () => {
        beforeEach(() => {
            vi.mocked(isEmailEnabled).mockReturnValue(true)
            vi.mocked(createNotification).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'PENDING',
                scheduledFor: new Date(),
                sentAt: null,
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            vi.mocked(resend!.emails.send).mockResolvedValue({
                data: { id: 'resend-msg-123' },
                error: null,
                headers: null
            })
            vi.mocked(updateNotificationStatus).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'EMAIL',
                type: 'CONFIRMATION',
                to: validInput.customer.email!,
                status: 'SENT',
                scheduledFor: new Date(),
                sentAt: new Date(),
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })
        })

        it('should handle business without address', async () => {
            const inputWithoutAddress: SendConfirmationEmailInput = {
                ...validInput,
                business: {
                    ...validInput.business,
                    address: null
                }
            }

            await sendConfirmationEmail(mockPrisma, inputWithoutAddress)

            const sendCall = vi.mocked(resend!.emails.send).mock.calls[0][0]
            // Address should not appear in text version
            expect(sendCall.text).not.toContain('Dirección:')
        })
    })
})
