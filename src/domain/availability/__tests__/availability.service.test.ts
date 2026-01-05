import { describe, it, expect } from 'vitest'
import { validateAndNormalizeRanges, validateRange } from '../availability.service'
import { AvailabilityRangeInput, DayOfWeek } from '../availability.types'
import { AppError } from '@/domain/common/errors'

describe('availability.service', () => {
    describe('validateRange', () => {
        it('accepts valid range', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 540,
                endMinutes: 1080
            }
            expect(validateRange(range).valid).toBe(true)
        })

        it('rejects dayOfWeek < 0', () => {
            const range = {
                dayOfWeek: -1 as DayOfWeek,
                startMinutes: 540,
                endMinutes: 1080
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('Día de semana inválido')
        })

        it('rejects dayOfWeek > 6', () => {
            const range = {
                dayOfWeek: 7 as DayOfWeek,
                startMinutes: 540,
                endMinutes: 1080
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('Día de semana inválido')
        })

        it('rejects startMinutes < 0', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: -1,
                endMinutes: 1080
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('Hora de inicio inválida')
        })

        it('rejects startMinutes >= 1440', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 1440,
                endMinutes: 1500
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('Hora de inicio inválida')
        })

        it('rejects endMinutes <= 0', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 0,
                endMinutes: 0
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('Hora de fin inválida')
        })

        it('rejects endMinutes > 1440', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 540,
                endMinutes: 1441
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('Hora de fin inválida')
        })

        it('rejects startMinutes >= endMinutes', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 1080,
                endMinutes: 540
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('La hora de inicio debe ser menor que la de fin')
        })

        it('rejects startMinutes == endMinutes', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 540,
                endMinutes: 540
            }
            const result = validateRange(range)
            expect(result.valid).toBe(false)
            expect(result.error).toBe('La hora de inicio debe ser menor que la de fin')
        })

        it('accepts edge case: 00:00 to 24:00', () => {
            const range: AvailabilityRangeInput = {
                dayOfWeek: 1 as DayOfWeek,
                startMinutes: 0,
                endMinutes: 1440
            }
            expect(validateRange(range).valid).toBe(true)
        })
    })

    describe('validateAndNormalizeRanges', () => {
        it('accepts empty array', () => {
            const result = validateAndNormalizeRanges([])
            expect(result).toEqual([])
        })

        it('accepts single valid range', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 1080 }
            ]
            const result = validateAndNormalizeRanges(ranges)
            expect(result).toHaveLength(1)
            expect(result[0]).toEqual(ranges[0])
        })

        it('accepts multiple ranges on same day without overlap', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 720 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 840, endMinutes: 1080 }
            ]
            const result = validateAndNormalizeRanges(ranges)
            expect(result).toHaveLength(2)
        })

        it('allows contiguous ranges (e.g., 09:00-12:00 and 12:00-15:00)', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 720 }, // 09:00-12:00
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 720, endMinutes: 900 } // 12:00-15:00
            ]
            const result = validateAndNormalizeRanges(ranges)
            expect(result).toHaveLength(2)
        })

        it('rejects overlapping ranges on same day', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 720 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 600, endMinutes: 900 }
            ]
            expect(() => validateAndNormalizeRanges(ranges)).toThrow(AppError)
            expect(() => validateAndNormalizeRanges(ranges)).toThrow('Los rangos no pueden solaparse')
        })

        it('rejects contained ranges', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 1080 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 600, endMinutes: 720 }
            ]
            expect(() => validateAndNormalizeRanges(ranges)).toThrow('Los rangos no pueden solaparse')
        })

        it('rejects more than 5 ranges per day', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 60, endMinutes: 120 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 180, endMinutes: 240 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 300, endMinutes: 360 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 420, endMinutes: 480 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 600 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 660, endMinutes: 720 }
            ]
            expect(() => validateAndNormalizeRanges(ranges)).toThrow(AppError)
            expect(() => validateAndNormalizeRanges(ranges)).toThrow('Máximo 5 rangos por día')
        })

        it('allows 5 ranges per day (max limit)', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 60, endMinutes: 120 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 180, endMinutes: 240 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 300, endMinutes: 360 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 420, endMinutes: 480 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 600 }
            ]
            const result = validateAndNormalizeRanges(ranges)
            expect(result).toHaveLength(5)
        })

        it('allows ranges on different days even if times overlap', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 720 },
                { dayOfWeek: 2 as DayOfWeek, startMinutes: 540, endMinutes: 720 }
            ]
            const result = validateAndNormalizeRanges(ranges)
            expect(result).toHaveLength(2)
        })

        it('normalizes by sorting by day then start time', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 2 as DayOfWeek, startMinutes: 540, endMinutes: 720 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 840, endMinutes: 1080 },
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 540, endMinutes: 720 }
            ]
            const result = validateAndNormalizeRanges(ranges)
            expect(result).toEqual([
                { dayOfWeek: 1, startMinutes: 540, endMinutes: 720 },
                { dayOfWeek: 1, startMinutes: 840, endMinutes: 1080 },
                { dayOfWeek: 2, startMinutes: 540, endMinutes: 720 }
            ])
        })

        it('throws AppError with correct code for invalid range', () => {
            const ranges: AvailabilityRangeInput[] = [
                { dayOfWeek: 1 as DayOfWeek, startMinutes: 1080, endMinutes: 540 }
            ]
            try {
                validateAndNormalizeRanges(ranges)
                expect.fail('Should have thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).code).toBe('AVAILABILITY_INVALID_RANGE')
                expect((error as AppError).httpStatus).toBe(400)
            }
        })
    })
})
