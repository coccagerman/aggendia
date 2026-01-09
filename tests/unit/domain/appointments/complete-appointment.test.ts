/**
 * Unit tests for markAppointmentAsCompleted domain service
 * Tests US-6.4 business logic: marking appointments as completed
 *
 * @see docs/user-stories.md - US-6.4 Marcar completado
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { markAppointmentAsCompleted, CompleteAppointmentDeps } from '@/domain/appointments/appointment.service'
import { AppointmentErrorCodes } from '@/domain/common/errors'
import { AppointmentStatus } from '@/domain/appointments/appointment.types'

describe('markAppointmentAsCompleted', () => {
    const businessId = 'business-123'
    const appointmentId = 'appointment-456'

    // Mock appointment data (minimal fields needed for completion)
    const createMockAppointment = (
        status: AppointmentStatus = 'SCHEDULED',
        /** occupiedEndAt - when the slot ends (determines if appointment can be completed) */
        occupiedEndAt: Date = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago (finished)
    ) => ({
        id: appointmentId,
        status,
        startAt: new Date(occupiedEndAt.getTime() - 60 * 60 * 1000), // 1 hour before occupiedEndAt
        occupiedEndAt
    })

    // Mock dependencies
    let mockDeps: CompleteAppointmentDeps

    beforeEach(() => {
        mockDeps = {
            getAppointmentById: vi.fn(),
            updateAppointmentStatus: vi.fn()
        }
    })

    describe('successful completion', () => {
        it('marks a past SCHEDULED appointment as completed', async () => {
            const pastAppointment = createMockAppointment('SCHEDULED')
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(pastAppointment)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...pastAppointment,
                status: 'COMPLETED'
            })

            const result = await markAppointmentAsCompleted(mockDeps, {
                businessId,
                appointmentId,
                currentTime: new Date()
            })

            expect(result).toEqual({
                appointmentId,
                status: 'COMPLETED'
            })

            expect(mockDeps.getAppointmentById).toHaveBeenCalledWith(businessId, appointmentId)
            expect(mockDeps.updateAppointmentStatus).toHaveBeenCalledWith(appointmentId, 'COMPLETED', undefined, [
                'SCHEDULED',
                'RESCHEDULED'
            ])
        })

        it('marks a past RESCHEDULED appointment as completed', async () => {
            const rescheduledAppointment = createMockAppointment('RESCHEDULED')
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(rescheduledAppointment)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...rescheduledAppointment,
                status: 'COMPLETED'
            })

            const result = await markAppointmentAsCompleted(mockDeps, {
                businessId,
                appointmentId,
                currentTime: new Date()
            })

            expect(result.status).toBe('COMPLETED')
            expect(mockDeps.updateAppointmentStatus).toHaveBeenCalledWith(appointmentId, 'COMPLETED', undefined, [
                'SCHEDULED',
                'RESCHEDULED'
            ])
        })

        it('marks an appointment that just finished as completed', async () => {
            // Appointment finished 1 minute ago
            const justFinished = createMockAppointment('SCHEDULED', new Date(Date.now() - 60 * 1000))
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(justFinished)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...justFinished,
                status: 'COMPLETED'
            })

            const result = await markAppointmentAsCompleted(mockDeps, {
                businessId,
                appointmentId,
                currentTime: new Date()
            })

            expect(result.status).toBe('COMPLETED')
        })
    })

    describe('idempotency', () => {
        it('returns success when appointment is already completed', async () => {
            const completedAppointment = createMockAppointment('COMPLETED')
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(completedAppointment)

            const result = await markAppointmentAsCompleted(mockDeps, {
                businessId,
                appointmentId,
                currentTime: new Date()
            })

            expect(result).toEqual({
                appointmentId,
                status: 'COMPLETED'
            })

            // Should NOT call updateAppointmentStatus (already completed)
            expect(mockDeps.updateAppointmentStatus).not.toHaveBeenCalled()
        })

        it('handles race condition - returns success if completed by another process', async () => {
            const pastAppointment = createMockAppointment('SCHEDULED')
            // First call returns SCHEDULED appointment
            vi.mocked(mockDeps.getAppointmentById)
                .mockResolvedValueOnce(pastAppointment)
                // Second call (after race condition detected) returns COMPLETED
                .mockResolvedValueOnce({
                    ...pastAppointment,
                    status: 'COMPLETED'
                })

            // updateAppointmentStatus returns null (race condition - status changed)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue(null)

            const result = await markAppointmentAsCompleted(mockDeps, {
                businessId,
                appointmentId,
                currentTime: new Date()
            })

            // Should return success (idempotent)
            expect(result).toEqual({
                appointmentId,
                status: 'COMPLETED'
            })
        })
    })

    describe('error cases - appointment not found', () => {
        it('throws 404 when appointment does not exist', async () => {
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(null)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: new Date()
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_NOT_FOUND,
                httpStatus: 404
            })
        })
    })

    describe('error cases - invalid status', () => {
        it('throws 400 when trying to complete a CANCELLED appointment', async () => {
            const cancelledAppointment = createMockAppointment('CANCELLED')
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(cancelledAppointment)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: new Date()
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })

            expect(mockDeps.updateAppointmentStatus).not.toHaveBeenCalled()
        })
    })

    describe('error cases - not finished appointments', () => {
        it('throws 400 when trying to complete a future SCHEDULED appointment', async () => {
            // Appointment finishes 2 hours from now
            const futureAppointment = createMockAppointment('SCHEDULED', new Date(Date.now() + 2 * 60 * 60 * 1000))
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(futureAppointment)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: new Date()
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400,
                message: expect.stringContaining('aún no ha finalizado')
            })

            expect(mockDeps.updateAppointmentStatus).not.toHaveBeenCalled()
        })

        it('throws 400 when trying to complete a future RESCHEDULED appointment', async () => {
            // Appointment finishes 24 hours from now
            const futureAppointment = createMockAppointment('RESCHEDULED', new Date(Date.now() + 24 * 60 * 60 * 1000))
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(futureAppointment)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: new Date()
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400,
                message: expect.stringContaining('aún no ha finalizado')
            })
        })

        it('throws 400 when trying to complete an in-progress appointment', async () => {
            const now = new Date()
            // Appointment started but occupiedEndAt is 30 min in the future (in-progress)
            const inProgressAppointment = createMockAppointment('SCHEDULED', new Date(now.getTime() + 30 * 60 * 1000))
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(inProgressAppointment)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: now
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400,
                message: expect.stringContaining('aún no ha finalizado')
            })
        })

        it('throws 400 for an appointment finishing exactly at currentTime + 1ms (boundary)', async () => {
            const now = new Date()
            // Appointment finishes 1ms in the future
            const futureAppointment = createMockAppointment('SCHEDULED', new Date(now.getTime() + 1))
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(futureAppointment)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: now
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 400
            })
        })

        it('allows completion when occupiedEndAt equals currentTime (boundary - inclusive)', async () => {
            const now = new Date()
            // Appointment finishes exactly at currentTime
            const boundaryAppointment = createMockAppointment('SCHEDULED', now)
            vi.mocked(mockDeps.getAppointmentById).mockResolvedValue(boundaryAppointment)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue({
                ...boundaryAppointment,
                status: 'COMPLETED'
            })

            const result = await markAppointmentAsCompleted(mockDeps, {
                businessId,
                appointmentId,
                currentTime: now
            })

            expect(result.status).toBe('COMPLETED')
        })
    })

    describe('race condition handling', () => {
        it('throws 409 when status changed to something other than COMPLETED during update', async () => {
            const pastAppointment = createMockAppointment('SCHEDULED')
            // First call returns SCHEDULED
            vi.mocked(mockDeps.getAppointmentById)
                .mockResolvedValueOnce(pastAppointment)
                // Second call returns CANCELLED (changed by another process)
                .mockResolvedValueOnce({
                    ...pastAppointment,
                    status: 'CANCELLED'
                })

            // updateAppointmentStatus returns null (race condition)
            vi.mocked(mockDeps.updateAppointmentStatus).mockResolvedValue(null)

            await expect(
                markAppointmentAsCompleted(mockDeps, {
                    businessId,
                    appointmentId,
                    currentTime: new Date()
                })
            ).rejects.toMatchObject({
                code: AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                httpStatus: 409,
                message: expect.stringContaining('cambió durante la operación')
            })
        })
    })
})
