/**
 * Unit tests for appointment domain service
 * Tests cancelAppointment business logic
 *
 * @see docs/user-stories.md - US-6.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cancelAppointment, CancelAppointmentDeps } from '@/domain/appointments/appointment.service'
import { AppError, AppointmentErrorCodes } from '@/domain/common/errors'
import { AppointmentStatus } from '@/domain/appointments/appointment.types'

describe('cancelAppointment', () => {
    const businessId = 'business-123'
    const appointmentId = 'appointment-456'

    // Mock appointment data (minimal fields needed for cancellation)
    const mockAppointment = {
        id: appointmentId,
        status: 'SCHEDULED' as AppointmentStatus,
        cancellationReason: null as string | null
    }

    // Mock dependencies
    let mockDeps: CancelAppointmentDeps

    beforeEach(() => {
        mockDeps = {
            getAppointmentById: vi.fn(),
            updateAppointmentStatus: vi.fn()
        }
    })

    describe('successful cancellation', () => {
        it('cancels a SCHEDULED appointment', async () => {
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...mockAppointment,
                status: 'CANCELLED',
                cancellationReason: 'Test reason'
            })

            const result = await cancelAppointment(mockDeps, {
                businessId,
                appointmentId,
                cancellationReason: 'Test reason'
            })

            expect(result).toEqual({
                appointmentId,
                status: 'CANCELLED',
                cancellationReason: 'Test reason'
            })

            expect(mockDeps.getAppointmentById).toHaveBeenCalledWith(businessId, appointmentId)
            expect(mockDeps.updateAppointmentStatus).toHaveBeenCalledWith(appointmentId, 'CANCELLED', 'Test reason', [
                'SCHEDULED',
                'RESCHEDULED'
            ])
        })

        it('cancels a RESCHEDULED appointment', async () => {
            const rescheduledAppointment = { ...mockAppointment, status: 'RESCHEDULED' as AppointmentStatus }
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(rescheduledAppointment)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...rescheduledAppointment,
                status: 'CANCELLED',
                cancellationReason: null
            })

            const result = await cancelAppointment(mockDeps, {
                businessId,
                appointmentId
            })

            expect(result.status).toBe('CANCELLED')
            expect(mockDeps.updateAppointmentStatus).toHaveBeenCalledWith(appointmentId, 'CANCELLED', undefined, [
                'SCHEDULED',
                'RESCHEDULED'
            ])
        })

        it('cancels without cancellation reason', async () => {
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(mockAppointment)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...mockAppointment,
                status: 'CANCELLED',
                cancellationReason: null
            })

            const result = await cancelAppointment(mockDeps, {
                businessId,
                appointmentId
            })

            expect(result.status).toBe('CANCELLED')
            expect(result.cancellationReason).toBeNull()
        })
    })

    describe('idempotency', () => {
        it('returns success when appointment is already cancelled', async () => {
            const cancelledAppointment = {
                ...mockAppointment,
                status: 'CANCELLED' as AppointmentStatus,
                cancellationReason: 'Already cancelled'
            }
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(cancelledAppointment)

            const result = await cancelAppointment(mockDeps, {
                businessId,
                appointmentId,
                cancellationReason: 'New reason (ignored)'
            })

            expect(result).toEqual({
                appointmentId,
                status: 'CANCELLED',
                cancellationReason: 'Already cancelled'
            })

            // Should NOT call updateAppointmentStatus (already cancelled)
            expect(mockDeps.updateAppointmentStatus).not.toHaveBeenCalled()
        })

        it('handles race condition - returns success if cancelled by another process', async () => {
            // First call returns SCHEDULED appointment
            vi.mocked(mockDeps.getAppointmentById)
                .mockResolvedValueOnce(mockAppointment)
                // Second call (after race condition detected) returns CANCELLED
                .mockResolvedValueOnce({
                    ...mockAppointment,
                    status: 'CANCELLED',
                    cancellationReason: 'Cancelled by other process'
                })

            // updateAppointmentStatus returns null (race condition - status changed)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue(null)

            const result = await cancelAppointment(mockDeps, {
                businessId,
                appointmentId,
                cancellationReason: 'My reason'
            })

            // Should return success (idempotent)
            expect(result).toEqual({
                appointmentId,
                status: 'CANCELLED',
                cancellationReason: 'Cancelled by other process'
            })
        })
    })

    describe('error cases', () => {
        it('throws APPOINTMENT_NOT_FOUND when appointment does not exist', async () => {
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(null)

            await expect(cancelAppointment(mockDeps, { businessId, appointmentId })).rejects.toThrow(AppError)

            try {
                await cancelAppointment(mockDeps, { businessId, appointmentId })
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).code).toBe(AppointmentErrorCodes.APPOINTMENT_NOT_FOUND)
                expect((error as AppError).httpStatus).toBe(404)
            }
        })

        it('throws APPOINTMENT_NOT_FOUND when appointment belongs to different business', async () => {
            // getAppointmentById returns null because it filters by businessId
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(null)

            await expect(cancelAppointment(mockDeps, { businessId: 'other-business', appointmentId })).rejects.toThrow(
                AppError
            )
        })

        it('throws APPOINTMENT_INVALID_STATUS when trying to cancel COMPLETED appointment', async () => {
            const completedAppointment = { ...mockAppointment, status: 'COMPLETED' as AppointmentStatus }
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(completedAppointment)

            await expect(cancelAppointment(mockDeps, { businessId, appointmentId })).rejects.toThrow(AppError)

            try {
                await cancelAppointment(mockDeps, { businessId, appointmentId })
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).code).toBe(AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS)
                expect((error as AppError).httpStatus).toBe(400)
            }
        })

        it('throws APPOINTMENT_INVALID_STATUS on race condition when status changed to non-cancellable', async () => {
            // First call returns SCHEDULED appointment
            vi.mocked(mockDeps.getAppointmentById)
                .mockResolvedValueOnce(mockAppointment)
                // Second call (after race condition detected) returns COMPLETED
                .mockResolvedValueOnce({
                    ...mockAppointment,
                    status: 'COMPLETED' as AppointmentStatus
                })

            // updateAppointmentStatus returns null (race condition - status changed)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue(null)

            await expect(
                cancelAppointment(mockDeps, { businessId, appointmentId, cancellationReason: 'My reason' })
            ).rejects.toThrow(AppError)

            try {
                // Reset mocks for the second attempt
                vi.mocked(mockDeps.getAppointmentById)
                    .mockResolvedValueOnce(mockAppointment)
                    .mockResolvedValueOnce({ ...mockAppointment, status: 'COMPLETED' as AppointmentStatus })
                vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue(null)

                await cancelAppointment(mockDeps, { businessId, appointmentId, cancellationReason: 'My reason' })
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).code).toBe(AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS)
                expect((error as AppError).httpStatus).toBe(409)
            }
        })
    })
})
