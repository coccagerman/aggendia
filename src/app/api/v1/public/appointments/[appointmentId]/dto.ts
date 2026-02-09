import { z } from 'zod'

/**
 * DTO for public appointment cancellation
 * Token-based auth (no user session required)
 */
export const publicCancelAppointmentSchema = z.object({
    token: z.string().min(1, 'token es requerido')
})

/**
 * DTO for public appointment reschedule
 * Token-based auth (no user session required)
 */
export const publicRescheduleAppointmentSchema = z.object({
    token: z.string().min(1, 'token es requerido'),
    newStartAt: z.string().datetime({ message: 'newStartAt debe ser una fecha ISO 8601 válida' })
})
