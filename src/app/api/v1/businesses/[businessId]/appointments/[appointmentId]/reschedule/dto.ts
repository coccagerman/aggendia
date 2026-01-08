/**
 * DTO schema for Reschedule Appointment endpoint
 *
 * @see docs/user-stories.md - US-6.3 Reprogramar turno
 */

import { z } from 'zod'

/**
 * Request DTO schema for rescheduling an appointment
 * - newStartAt: required ISO 8601 UTC timestamp for the new slot
 */
export const rescheduleAppointmentSchema = z.object({
    newStartAt: z
        .string()
        .min(1, 'La nueva fecha es requerida')
        .refine(val => !isNaN(Date.parse(val)), {
            message: 'Formato de fecha inválido. Usar ISO 8601 (ej: 2026-01-15T10:00:00.000Z)'
        })
})

export type RescheduleAppointmentDto = z.infer<typeof rescheduleAppointmentSchema>
