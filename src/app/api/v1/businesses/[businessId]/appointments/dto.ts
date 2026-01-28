/**
 * DTO schema for Manual Appointment Creation endpoint
 * POST /api/v1/businesses/:businessId/appointments
 *
 * @see docs/user-stories.md - US-7.3 Crear turnos manualmente desde la agenda
 */

import { z } from 'zod'

/**
 * Strip HTML tags from input to prevent XSS
 */
function stripHtmlTags(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}

/**
 * Request DTO schema for creating a manual appointment
 * Similar to public booking but without slug (uses businessId from URL)
 * Does NOT enforce minimum booking notice
 * Does NOT allow creating appointments in the past
 */
export const createManualAppointmentSchema = z.object({
    serviceId: z.string().uuid('serviceId debe ser un UUID válido'),
    resourceId: z.string().uuid('resourceId debe ser un UUID válido'),
    startAt: z.string().datetime({ message: 'startAt debe ser una fecha ISO 8601 válida' }),
    customer: z
        .object({
            fullName: z
                .string()
                .min(1, 'El nombre es requerido')
                .max(100, 'El nombre es muy largo')
                .transform(stripHtmlTags),
            email: z.string().email('Email inválido').optional().or(z.literal('')),
            phone: z.string().min(6, 'Teléfono muy corto').max(20, 'Teléfono muy largo').optional().or(z.literal(''))
        })
        .refine(c => (c.email && c.email.length > 0) || (c.phone && c.phone.length > 0), {
            message: 'Debe proporcionar email o teléfono'
        }),
    notes: z.string().max(500, 'Las notas son muy largas').transform(stripHtmlTags).optional()
})

export type CreateManualAppointmentDto = z.infer<typeof createManualAppointmentSchema>
