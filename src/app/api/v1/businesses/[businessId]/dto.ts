import { z } from 'zod'

/**
 * Offsets permitidos para recordatorios (en minutos)
 * 1440 = 24 horas, 120 = 2 horas
 */
const ALLOWED_REMINDER_OFFSETS = [1440, 120] as const

/**
 * Schema para actualizar configuración del negocio (PATCH)
 */
export const updateBusinessSettingsSchema = z
    .object({
        resourceLabel: z
            .string()
            .trim()
            .min(1, 'La etiqueta de recurso no puede estar vacía')
            .max(50, 'La etiqueta de recurso no puede exceder 50 caracteres')
            .optional(),
        remindersEnabled: z.boolean().optional(),
        reminderOffsetsMinutes: z
            .array(
                z
                    .number()
                    .int()
                    .refine(val => ALLOWED_REMINDER_OFFSETS.includes(val as 1440 | 120), {
                        message: 'Los offsets permitidos son 1440 (24h) o 120 (2h)'
                    })
            )
            .min(0)
            .max(2)
            .refine(arr => new Set(arr).size === arr.length, {
                message: 'Los offsets no pueden repetirse'
            })
            .optional()
    })
    .superRefine((data, ctx) => {
        if (data.remindersEnabled === true && data.reminderOffsetsMinutes?.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reminderOffsetsMinutes'],
                message: 'Seleccioná al menos un offset cuando los recordatorios están activos'
            })
        }
    })

export type UpdateBusinessSettingsRequest = z.infer<typeof updateBusinessSettingsSchema>
