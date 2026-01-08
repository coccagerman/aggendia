/**
 * DTO schema for Cancel Appointment endpoint
 *
 * @see docs/user-stories.md - US-6.2 Cancelar turno
 */

import { z } from 'zod'

/**
 * Strip HTML tags from input to prevent XSS
 */
function stripHtmlTags(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}

/**
 * Request DTO schema for cancelling an appointment
 * - cancellationReason: optional string, max 500 characters, HTML stripped
 */
export const cancelAppointmentSchema = z.object({
    cancellationReason: z.string().max(500, 'El motivo es muy largo').transform(stripHtmlTags).optional()
})

export type CancelAppointmentDto = z.infer<typeof cancelAppointmentSchema>
