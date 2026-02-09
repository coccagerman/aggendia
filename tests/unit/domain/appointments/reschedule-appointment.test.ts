/**
 * Unit tests for rescheduleAppointment domain service
 * Tests business logic for rescheduling appointments (US-6.3)
 *
 * @see docs/user-stories.md - US-6.3 Reprogramar turno
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rescheduleAppointment, RescheduleAppointmentDeps } from '@/domain/appointments/appointment.service'
import { AppointmentErrorCodes } from '@/domain/common/errors'
import { AppointmentStatus } from '@/domain/appointments/appointment.types'

describe('rescheduleAppointment', () => {
    const businessId = 'business-123'
    const appointmentId = 'appointment-456'
    const resourceId = 'resource-789'
    const serviceId = 'service-abc'
    const customerId = 'customer-def'
    const timezone = 'America/Argentina/Buenos_Aires'

    // Future time for testing (tomorrow at 10:00)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const newStartAt = tomorrow.toISOString()

    // Mock appointment data
    const mockAppointment = {
        id: appointmentId,
        businessId,
        resourceId,
        serviceId,
        customerId,
        status: 'SCHEDULED' as AppointmentStatus,
        businessTimezone: timezone,
        service: {
            id: serviceId,
            name: 'Test Service',
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            status: 'ACTIVE'
        },
        resource: {
            id: resourceId,
            name: 'Test Resource',
            status: 'ACTIVE'
        }
    }

    // Mock availability rules (all week 9:00-18:00 to avoid day-of-week issues in tests)
    const mockAvailabilityRules = [
        { dayOfWeek: 0 as const, startMinutes: 540, endMinutes: 1080 }, // Sunday
        { dayOfWeek: 1 as const, startMinutes: 540, endMinutes: 1080 }, // Monday
        { dayOfWeek: 2 as const, startMinutes: 540, endMinutes: 1080 }, // Tuesday
        { dayOfWeek: 3 as const, startMinutes: 540, endMinutes: 1080 }, // Wednesday
        { dayOfWeek: 4 as const, startMinutes: 540, endMinutes: 1080 }, // Thursday
        { dayOfWeek: 5 as const, startMinutes: 540, endMinutes: 1080 }, // Friday
        { dayOfWeek: 6 as const, startMinutes: 540, endMinutes: 1080 } // Saturday
    ]

    // Mock reschedule result
    const mockRescheduleResult = {
        newAppointmentId: 'new-appointment-123',
        originalAppointmentId: appointmentId,
        newStartAt: tomorrow,
        newEndAt: new Date(tomorrow.getTime() + 30 * 60 * 1000),
        newSecretToken: 'new-secret-token-uuid'
    }

    // Mock dependencies
    let mockDeps: RescheduleAppointmentDeps

    beforeEach(() => {
        mockDeps = {
            getAppointmentForReschedule: vi.fn(),
            getAvailabilityRules: vi.fn(),
            getBlocksByResourceId: vi.fn(),
            createRescheduledAppointment: vi.fn()
        }
    })

    describe('successful rescheduling', () => {
        it('reschedules a SCHEDULED appointment to a valid slot', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue(mockAvailabilityRules)
            vi.mocked(mockDeps.getBlocksByResourceId).mockResolvedValue([])
            vi.mocked(mockDeps.createRescheduledAppointment).mockResolvedValue(mockRescheduleResult)

            const result = await rescheduleAppointment(mockDeps, {
                businessId,
                appointmentId,
                newStartAt
            })

            expect(result.newAppointmentId).toBe(mockRescheduleResult.newAppointmentId)
            expect(result.originalAppointmentId).toBe(appointmentId)
            expect(mockDeps.getAppointmentForReschedule).toHaveBeenCalledWith(businessId, appointmentId)
            expect(mockDeps.getAvailabilityRules).toHaveBeenCalledWith(resourceId)
            expect(mockDeps.getBlocksByResourceId).toHaveBeenCalled()
            expect(mockDeps.createRescheduledAppointment).toHaveBeenCalled()
        })

        it('reschedules a RESCHEDULED appointment (chained rescheduling)', async () => {
            const rescheduledAppointment = { ...mockAppointment, status: 'RESCHEDULED' as AppointmentStatus }
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(rescheduledAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue(mockAvailabilityRules)
            vi.mocked(mockDeps.getBlocksByResourceId).mockResolvedValue([])
            vi.mocked(mockDeps.createRescheduledAppointment).mockResolvedValue(mockRescheduleResult)

            const result = await rescheduleAppointment(mockDeps, {
                businessId,
                appointmentId,
                newStartAt
            })

            expect(result.newAppointmentId).toBe(mockRescheduleResult.newAppointmentId)
        })

        it('passes correct data to createRescheduledAppointment', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue(mockAvailabilityRules)
            vi.mocked(mockDeps.getBlocksByResourceId).mockResolvedValue([])
            vi.mocked(mockDeps.createRescheduledAppointment).mockResolvedValue(mockRescheduleResult)

            await rescheduleAppointment(mockDeps, {
                businessId,
                appointmentId,
                newStartAt
            })

            expect(mockDeps.createRescheduledAppointment).toHaveBeenCalledWith(
                expect.objectContaining({
                    originalAppointmentId: appointmentId,
                    businessId,
                    resourceId,
                    serviceId,
                    customerId
                })
            )
        })
    })

    describe('validation errors', () => {
        it('throws error when appointment not found', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(null)

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_NOT_FOUND,
                httpStatus: 404
            })
        })

        it('throws error when appointment is CANCELLED', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue({
                ...mockAppointment,
                status: 'CANCELLED'
            })

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })
        })

        it('throws error when appointment is COMPLETED', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue({
                ...mockAppointment,
                status: 'COMPLETED'
            })

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })
        })

        it('throws error when newStartAt is in the past', async () => {
            const pastDate = new Date()
            pastDate.setHours(pastDate.getHours() - 1)

            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt: pastDate.toISOString() })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
                httpStatus: 400
            })
        })

        it('throws error when newStartAt is invalid', async () => {
            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt: 'invalid-date' })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })
        })

        it('throws error when service is INACTIVE', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue({
                ...mockAppointment,
                service: { ...mockAppointment.service, status: 'INACTIVE' }
            })

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })
        })

        it('throws error when resource is INACTIVE', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue({
                ...mockAppointment,
                resource: { ...mockAppointment.resource, status: 'INACTIVE' }
            })

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })
        })

        it('throws error when new slot is outside availability', async () => {
            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue([]) // No availability

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
                httpStatus: 409
            })
        })

        it('throws error when new slot overlaps with a block', async () => {
            const blockStart = new Date(tomorrow)
            blockStart.setMinutes(blockStart.getMinutes() - 15)
            const blockEnd = new Date(tomorrow)
            blockEnd.setMinutes(blockEnd.getMinutes() + 15)

            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue(mockAvailabilityRules)
            vi.mocked(mockDeps.getBlocksByResourceId).mockResolvedValue([{ startAt: blockStart, endAt: blockEnd }])

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
                httpStatus: 409
            })
        })
    })

    describe('slot overlap with blocks', () => {
        it('allows rescheduling when block does not overlap', async () => {
            // Block is before the new slot
            const blockStart = new Date(tomorrow)
            blockStart.setHours(8, 0, 0, 0)
            const blockEnd = new Date(tomorrow)
            blockEnd.setHours(9, 0, 0, 0)

            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue(mockAvailabilityRules)
            vi.mocked(mockDeps.getBlocksByResourceId).mockResolvedValue([{ startAt: blockStart, endAt: blockEnd }])
            vi.mocked(mockDeps.createRescheduledAppointment).mockResolvedValue(mockRescheduleResult)

            const result = await rescheduleAppointment(mockDeps, {
                businessId,
                appointmentId,
                newStartAt
            })

            expect(result.newAppointmentId).toBe(mockRescheduleResult.newAppointmentId)
        })

        it('rejects when block partially overlaps at start', async () => {
            // Block ends during the appointment
            const blockStart = new Date(tomorrow)
            blockStart.setHours(9, 30, 0, 0)
            const blockEnd = new Date(tomorrow)
            blockEnd.setHours(10, 15, 0, 0) // Overlaps with appointment starting at 10:00

            vi.mocked(mockDeps.getAppointmentForReschedule).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.getAvailabilityRules).mockResolvedValue(mockAvailabilityRules)
            vi.mocked(mockDeps.getBlocksByResourceId).mockResolvedValue([{ startAt: blockStart, endAt: blockEnd }])

            await expect(
                rescheduleAppointment(mockDeps, { businessId, appointmentId, newStartAt })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY
            })
        })
    })
})
