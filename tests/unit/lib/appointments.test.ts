/**
 * Tests for appointment filtering utilities
 * US-7.6 Filtrar agenda por estado de turnos
 */

import { describe, it, expect } from 'vitest'
import {
    APPOINTMENT_STATUSES,
    DEFAULT_STATUSES,
    isValidStatus,
    parseStatusFilter,
    serializeStatusFilter,
    filterAppointmentsByStatus,
    countAppointmentsByStatus
} from '@/lib/appointments'
import type { AppointmentStatus } from '@prisma/client'

describe('appointments utilities', () => {
    describe('APPOINTMENT_STATUSES', () => {
        it('should contain all valid statuses', () => {
            expect(APPOINTMENT_STATUSES).toEqual(['SCHEDULED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED'])
        })
    })

    describe('isValidStatus', () => {
        it('should return true for valid statuses', () => {
            expect(isValidStatus('SCHEDULED')).toBe(true)
            expect(isValidStatus('CANCELLED')).toBe(true)
            expect(isValidStatus('RESCHEDULED')).toBe(true)
            expect(isValidStatus('COMPLETED')).toBe(true)
        })

        it('should return false for invalid statuses', () => {
            expect(isValidStatus('INVALID')).toBe(false)
            expect(isValidStatus('pending')).toBe(false)
            expect(isValidStatus('')).toBe(false)
            expect(isValidStatus('scheduled')).toBe(false) // case sensitive before toUpperCase
        })
    })

    describe('parseStatusFilter', () => {
        it('should return default statuses (SCHEDULED) when param is undefined', () => {
            expect(parseStatusFilter(undefined)).toEqual(DEFAULT_STATUSES)
        })

        it('should return default statuses (SCHEDULED) when param is empty', () => {
            expect(parseStatusFilter('')).toEqual(DEFAULT_STATUSES)
        })

        it('should parse single status', () => {
            expect(parseStatusFilter('SCHEDULED')).toEqual(['SCHEDULED'])
        })

        it('should parse multiple statuses (comma-separated)', () => {
            expect(parseStatusFilter('SCHEDULED,CANCELLED')).toEqual(['SCHEDULED', 'CANCELLED'])
        })

        it('should handle spaces around statuses', () => {
            expect(parseStatusFilter('SCHEDULED , CANCELLED')).toEqual(['SCHEDULED', 'CANCELLED'])
        })

        it('should handle lowercase (converted to uppercase)', () => {
            expect(parseStatusFilter('scheduled,cancelled')).toEqual(['SCHEDULED', 'CANCELLED'])
        })

        it('should filter out invalid statuses', () => {
            expect(parseStatusFilter('SCHEDULED,INVALID,CANCELLED')).toEqual(['SCHEDULED', 'CANCELLED'])
        })

        it('should return default statuses when all provided statuses are invalid', () => {
            expect(parseStatusFilter('INVALID,WRONG')).toEqual(DEFAULT_STATUSES)
        })

        it('should handle all four statuses', () => {
            expect(parseStatusFilter('SCHEDULED,CANCELLED,RESCHEDULED,COMPLETED')).toEqual([
                'SCHEDULED',
                'CANCELLED',
                'RESCHEDULED',
                'COMPLETED'
            ])
        })
    })

    describe('serializeStatusFilter', () => {
        it('should return undefined when selection matches default (SCHEDULED only)', () => {
            expect(serializeStatusFilter([...DEFAULT_STATUSES])).toBeUndefined()
        })

        it('should serialize all statuses when all are selected', () => {
            expect(serializeStatusFilter([...APPOINTMENT_STATUSES])).toBe('SCHEDULED,CANCELLED,RESCHEDULED,COMPLETED')
        })

        it('should serialize single non-default status', () => {
            expect(serializeStatusFilter(['CANCELLED'])).toBe('CANCELLED')
        })

        it('should serialize multiple statuses (comma-separated)', () => {
            expect(serializeStatusFilter(['SCHEDULED', 'CANCELLED'])).toBe('SCHEDULED,CANCELLED')
        })

        it('should serialize three statuses', () => {
            expect(serializeStatusFilter(['SCHEDULED', 'CANCELLED', 'RESCHEDULED'])).toBe(
                'SCHEDULED,CANCELLED,RESCHEDULED'
            )
        })
    })

    describe('filterAppointmentsByStatus', () => {
        const mockAppointments = [
            { id: '1', status: 'SCHEDULED' as AppointmentStatus },
            { id: '2', status: 'CANCELLED' as AppointmentStatus },
            { id: '3', status: 'RESCHEDULED' as AppointmentStatus },
            { id: '4', status: 'COMPLETED' as AppointmentStatus },
            { id: '5', status: 'SCHEDULED' as AppointmentStatus }
        ]

        it('should return all appointments when all statuses are active', () => {
            const result = filterAppointmentsByStatus(mockAppointments, [...APPOINTMENT_STATUSES])
            expect(result).toEqual(mockAppointments)
        })

        it('should filter by single status', () => {
            const result = filterAppointmentsByStatus(mockAppointments, ['SCHEDULED'])
            expect(result).toHaveLength(2)
            expect(result.every(a => a.status === 'SCHEDULED')).toBe(true)
        })

        it('should filter by multiple statuses', () => {
            const result = filterAppointmentsByStatus(mockAppointments, ['SCHEDULED', 'CANCELLED'])
            expect(result).toHaveLength(3)
            expect(result.every(a => a.status === 'SCHEDULED' || a.status === 'CANCELLED')).toBe(true)
        })

        it('should return empty array when no appointments match', () => {
            const onlyScheduled = [{ id: '1', status: 'SCHEDULED' as AppointmentStatus }]
            const result = filterAppointmentsByStatus(onlyScheduled, ['CANCELLED'])
            expect(result).toHaveLength(0)
        })

        it('should handle empty appointments array', () => {
            const result = filterAppointmentsByStatus([], ['SCHEDULED'])
            expect(result).toHaveLength(0)
        })

        it('should preserve appointment data', () => {
            const appointments = [
                { id: '1', status: 'SCHEDULED' as AppointmentStatus, extra: 'data' },
                { id: '2', status: 'CANCELLED' as AppointmentStatus, extra: 'other' }
            ]
            const result = filterAppointmentsByStatus(appointments, ['SCHEDULED'])
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual({ id: '1', status: 'SCHEDULED', extra: 'data' })
        })
    })

    describe('countAppointmentsByStatus', () => {
        it('should count appointments by status', () => {
            const appointments = [
                { id: '1', status: 'SCHEDULED' as AppointmentStatus },
                { id: '2', status: 'CANCELLED' as AppointmentStatus },
                { id: '3', status: 'SCHEDULED' as AppointmentStatus },
                { id: '4', status: 'COMPLETED' as AppointmentStatus }
            ]

            const counts = countAppointmentsByStatus(appointments)

            expect(counts).toEqual({
                SCHEDULED: 2,
                CANCELLED: 1,
                RESCHEDULED: 0,
                COMPLETED: 1
            })
        })

        it('should return zeros for empty array', () => {
            const counts = countAppointmentsByStatus([])

            expect(counts).toEqual({
                SCHEDULED: 0,
                CANCELLED: 0,
                RESCHEDULED: 0,
                COMPLETED: 0
            })
        })

        it('should count all statuses correctly', () => {
            const appointments = [
                { id: '1', status: 'SCHEDULED' as AppointmentStatus },
                { id: '2', status: 'CANCELLED' as AppointmentStatus },
                { id: '3', status: 'RESCHEDULED' as AppointmentStatus },
                { id: '4', status: 'COMPLETED' as AppointmentStatus },
                { id: '5', status: 'SCHEDULED' as AppointmentStatus },
                { id: '6', status: 'CANCELLED' as AppointmentStatus },
                { id: '7', status: 'RESCHEDULED' as AppointmentStatus }
            ]

            const counts = countAppointmentsByStatus(appointments)

            expect(counts).toEqual({
                SCHEDULED: 2,
                CANCELLED: 2,
                RESCHEDULED: 2,
                COMPLETED: 1
            })
        })
    })
})
