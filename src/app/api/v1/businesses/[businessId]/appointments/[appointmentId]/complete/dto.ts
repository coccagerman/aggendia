/**
 * DTO schema for Complete Appointment endpoint
 *
 * This endpoint does not require a request body, but we define an empty strict
 * schema to reject unexpected payloads and document the contract explicitly.
 *
 * @see docs/user-stories.md - US-6.4 Marcar completado
 * @see docs/conventions.md - Section 4: DTOs
 */

import { z } from 'zod'

/**
 * Request DTO schema for marking an appointment as completed
 * Body must be empty or omitted - no fields are accepted
 */
export const completeAppointmentSchema = z.object({}).strict()

export type CompleteAppointmentDto = z.infer<typeof completeAppointmentSchema>
