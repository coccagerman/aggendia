import { z } from 'zod'
import { DAYS_OF_WEEK, MIN_MINUTES, MAX_MINUTES, MAX_RANGES_PER_DAY } from '@/domain/availability/availability.types'

/**
 * Schema for a single availability range
 */
const availabilityRangeSchema = z
    .object({
        dayOfWeek: z
            .number()
            .int()
            .refine(val => DAYS_OF_WEEK.includes(val as (typeof DAYS_OF_WEEK)[number]), {
                message: 'Día de semana inválido (debe ser 0-6)'
            }),
        startMinutes: z
            .number()
            .int()
            .min(MIN_MINUTES, 'La hora de inicio debe ser >= 00:00')
            .max(MAX_MINUTES - 1, 'La hora de inicio debe ser < 24:00'),
        endMinutes: z
            .number()
            .int()
            .min(1, 'La hora de fin debe ser > 00:00')
            .max(MAX_MINUTES, 'La hora de fin debe ser <= 24:00')
    })
    .refine(data => data.startMinutes < data.endMinutes, {
        message: 'La hora de inicio debe ser menor que la de fin'
    })

/**
 * Schema for setting availability (PUT request)
 * Max 35 ranges total (7 days × 5 max per day)
 */
export const setAvailabilitySchema = z.object({
    ranges: z.array(availabilityRangeSchema).max(7 * MAX_RANGES_PER_DAY, 'Demasiados rangos')
})

export type SetAvailabilityRequest = z.infer<typeof setAvailabilitySchema>
