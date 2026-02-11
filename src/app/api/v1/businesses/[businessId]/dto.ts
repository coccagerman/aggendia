import { z } from 'zod'

/**
 * Offsets permitidos para recordatorios (en minutos)
 * 1440 = 24 horas, 120 = 2 horas
 */
const ALLOWED_REMINDER_OFFSETS = [1440, 120] as const

/**
 * Schema para actualizar configuración del negocio (PATCH)
 *
 * Campos soportados:
 * - resourceLabel: etiqueta visible para recursos
 * - remindersEnabled: habilita/deshabilita recordatorios automáticos
 * - reminderOffsetsMinutes: cuándo enviar recordatorios (24h y/o 2h antes)
 * - emailNotificationsEnabled: habilita/deshabilita canal de email (US-10.1)
 * - whatsappNotificationsEnabled: habilita/deshabilita canal de WhatsApp (US-10.1)
 * - ownerEmailNotificationsEnabled: habilita/deshabilita email al negocio
 * - ownerWhatsappNotificationsEnabled: habilita/deshabilita WhatsApp al negocio
 * - ownerPhoneE164: teléfono del owner en formato E.164 para WhatsApp
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
            .optional(),
        emailNotificationsEnabled: z.boolean().optional(),
        whatsappNotificationsEnabled: z.boolean().optional(),
        ownerEmailNotificationsEnabled: z.boolean().optional(),
        ownerWhatsappNotificationsEnabled: z.boolean().optional(),
        ownerRemindersEnabled: z.boolean().optional(),
        ownerReminderOffsetsMinutes: z
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
            .optional(),
        ownerPhoneE164: z
            .string()
            .trim()
            .regex(/^\+[1-9]\d{6,14}$/, 'El teléfono debe estar en formato E.164 (ej: +5491155667788)')
            .nullable()
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
        if (data.ownerRemindersEnabled === true && data.ownerReminderOffsetsMinutes?.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['ownerReminderOffsetsMinutes'],
                message: 'Seleccioná al menos un offset cuando los recordatorios al negocio están activos'
            })
        }
        if (data.ownerWhatsappNotificationsEnabled === true && !data.ownerPhoneE164) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['ownerPhoneE164'],
                message: 'Ingresá un número de teléfono para recibir notificaciones por WhatsApp'
            })
        }
    })

export type UpdateBusinessSettingsRequest = z.infer<typeof updateBusinessSettingsSchema>

/**
 * Schema para actualizar datos core del negocio (PATCH)
 *
 * Campos soportados:
 * - name: nombre del negocio
 * - timezone: zona horaria
 * - address: dirección
 * - area: ciudad/zona
 * - status: ACTIVE | INACTIVE (DELETED no se permite vía PATCH)
 */
export const updateBusinessSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'El nombre del negocio es requerido')
        .max(100, 'El nombre del negocio no puede exceder 100 caracteres')
        .optional(),
    timezone: z.string().trim().min(1, 'El timezone es requerido').optional(),
    address: z.string().trim().max(200, 'La dirección no puede exceder 200 caracteres').nullable().optional(),
    area: z.string().trim().max(100, 'La ciudad/zona no puede exceder 100 caracteres').nullable().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})

export type UpdateBusinessRequest = z.infer<typeof updateBusinessSchema>
