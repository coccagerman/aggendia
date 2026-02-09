/**
 * Unit tests for WhatsApp notification domain service
 * Tests sendConfirmationWhatsApp business logic
 *
 * @see docs/user-stories.md - US-10.2 Confirmación de turno por WhatsApp
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendConfirmationWhatsApp } from '@/domain/notifications/notification.service'
import { SendConfirmationWhatsAppInput } from '@/domain/notifications/notification.types'

// Mock the whatsapp client module
vi.mock('@/lib/whatsapp/client', () => ({
    sendTemplateMessage: vi.fn(),
    isWhatsAppEnabled: vi.fn(),
    WHATSAPP_TEMPLATES: {
        CONFIRMATION: 'turnosapp_confirmation',
        CANCELLATION: 'turnosapp_cancellation',
        RESCHEDULED: 'turnosapp_rescheduled',
        REMINDER: 'turnosapp_reminder'
    }
}))

// Mock the notification repository
vi.mock('@/data/repositories/notification.repo', () => ({
    createNotification: vi.fn(),
    updateNotificationStatus: vi.fn()
}))

import { sendTemplateMessage, isWhatsAppEnabled } from '@/lib/whatsapp/client'
import { createNotification, updateNotificationStatus } from '@/data/repositories/notification.repo'
import { PrismaClient, Prisma } from '@prisma/client'

describe('sendConfirmationWhatsApp', () => {
    // Mock Prisma client
    const mockPrisma = {} as PrismaClient

    // Valid test input
    const validInput: SendConfirmationWhatsAppInput = {
        appointmentId: 'appointment-123',
        business: {
            id: 'business-456',
            name: 'Test Business',
            timezone: 'America/Argentina/Buenos_Aires',
            resourceLabel: 'Profesional',
            whatsappNotificationsEnabled: true
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
            phoneE164: '+5491112345678'
        },
        startAt: new Date('2026-01-15T14:00:00.000Z')
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('when customer has no phoneE164', () => {
        it('should skip WhatsApp sending and return failure result', async () => {
            const inputWithoutPhone: SendConfirmationWhatsAppInput = {
                ...validInput,
                customer: {
                    ...validInput.customer,
                    phoneE164: null
                }
            }

            const result = await sendConfirmationWhatsApp(mockPrisma, inputWithoutPhone)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Customer has no valid phone number')
            expect(createNotification).not.toHaveBeenCalled()
            expect(sendTemplateMessage).not.toHaveBeenCalled()
        })
    })

    describe('when WhatsApp is disabled (missing env vars)', () => {
        it('should skip WhatsApp sending and return failure result', async () => {
            vi.mocked(isWhatsAppEnabled).mockReturnValue(false)

            const result = await sendConfirmationWhatsApp(mockPrisma, validInput)

            expect(result.success).toBe(false)
            expect(result.error).toBe('WhatsApp sending is disabled')
            expect(createNotification).not.toHaveBeenCalled()
        })
    })

    describe('when WhatsApp channel is disabled for business', () => {
        it('should skip WhatsApp sending and return failure result', async () => {
            const inputWithWhatsAppDisabled: SendConfirmationWhatsAppInput = {
                ...validInput,
                business: {
                    ...validInput.business,
                    whatsappNotificationsEnabled: false
                }
            }

            const result = await sendConfirmationWhatsApp(mockPrisma, inputWithWhatsAppDisabled)

            expect(result.success).toBe(false)
            expect(result.error).toBe('WhatsApp notifications are disabled')
            expect(createNotification).not.toHaveBeenCalled()
            expect(sendTemplateMessage).not.toHaveBeenCalled()
        })
    })

    describe('when WhatsApp is enabled', () => {
        beforeEach(() => {
            vi.mocked(isWhatsAppEnabled).mockReturnValue(true)
            vi.mocked(createNotification).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'WHATSAPP',
                type: 'CONFIRMATION',
                to: validInput.customer.phoneE164!,
                status: 'PENDING',
                scheduledFor: new Date(),
                sentAt: null,
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })
        })

        it('should send WhatsApp message successfully and update notification to SENT', async () => {
            vi.mocked(sendTemplateMessage).mockResolvedValue({
                success: true,
                messageId: 'wamid.123'
            })
            vi.mocked(updateNotificationStatus).mockResolvedValue({
                id: 'notification-123',
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'WHATSAPP',
                type: 'CONFIRMATION',
                to: validInput.customer.phoneE164!,
                status: 'SENT',
                scheduledFor: new Date(),
                sentAt: new Date(),
                error: null,
                createdAt: new Date(),
                updatedAt: new Date()
            })

            const result = await sendConfirmationWhatsApp(mockPrisma, validInput)

            expect(result.success).toBe(true)
            expect(result.notificationId).toBe('notification-123')

            // Verify notification was created
            expect(createNotification).toHaveBeenCalledWith(mockPrisma, {
                businessId: validInput.business.id,
                appointmentId: validInput.appointmentId,
                channel: 'WHATSAPP',
                type: 'CONFIRMATION',
                to: validInput.customer.phoneE164,
                scheduledFor: expect.any(Date)
            })

            // Verify WhatsApp template message was sent
            expect(sendTemplateMessage).toHaveBeenCalledWith(
                validInput.customer.phoneE164,
                'turnosapp_confirmation',
                expect.stringContaining(validInput.business.name)
            )

            // Verify notification was updated to SENT
            expect(updateNotificationStatus).toHaveBeenCalledWith(
                mockPrisma,
                'notification-123',
                'SENT',
                expect.any(Date)
            )
        })

        it('should include business info in the message', async () => {
            vi.mocked(sendTemplateMessage).mockResolvedValue({
                success: true,
                messageId: 'wamid.123'
            })

            await sendConfirmationWhatsApp(mockPrisma, validInput)

            expect(sendTemplateMessage).toHaveBeenCalledWith(
                validInput.customer.phoneE164,
                'turnosapp_confirmation',
                expect.stringContaining(validInput.business.name)
            )
        })

        it('should include service name in the message', async () => {
            vi.mocked(sendTemplateMessage).mockResolvedValue({
                success: true,
                messageId: 'wamid.123'
            })

            await sendConfirmationWhatsApp(mockPrisma, validInput)

            expect(sendTemplateMessage).toHaveBeenCalledWith(
                validInput.customer.phoneE164,
                'turnosapp_confirmation',
                expect.stringContaining(validInput.service.name)
            )
        })

        it('should include resource info in the message', async () => {
            vi.mocked(sendTemplateMessage).mockResolvedValue({
                success: true,
                messageId: 'wamid.123'
            })

            await sendConfirmationWhatsApp(mockPrisma, validInput)

            const call = vi.mocked(sendTemplateMessage).mock.calls[0]
            const message = call[2]
            expect(message).toContain(validInput.resource.name)
            expect(message).toContain(validInput.business.resourceLabel)
        })

        it('should handle WhatsApp API error and update notification to FAILED', async () => {
            vi.mocked(sendTemplateMessage).mockResolvedValue({
                success: false,
                error: 'Invalid phone number'
            })

            const result = await sendConfirmationWhatsApp(mockPrisma, validInput)

            expect(result.success).toBe(false)
            expect(result.notificationId).toBe('notification-123')
            expect(result.error).toBe('Invalid phone number')

            // Verify notification was updated to FAILED
            expect(updateNotificationStatus).toHaveBeenCalledWith(
                mockPrisma,
                'notification-123',
                'FAILED',
                undefined,
                'Invalid phone number'
            )
        })

        it('should handle duplicate notification gracefully (idempotency)', async () => {
            // Simulate Prisma unique constraint violation
            const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: '5.0.0'
            })
            vi.mocked(createNotification).mockRejectedValue(prismaError)

            const result = await sendConfirmationWhatsApp(mockPrisma, validInput)

            expect(result.success).toBe(false)
            expect(result.error).toBe('Notification already exists')
            expect(sendTemplateMessage).not.toHaveBeenCalled()
        })

        it('should handle unexpected errors and update notification to FAILED', async () => {
            vi.mocked(sendTemplateMessage).mockRejectedValue(new Error('Network error'))

            const result = await sendConfirmationWhatsApp(mockPrisma, validInput)

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
    })
})
