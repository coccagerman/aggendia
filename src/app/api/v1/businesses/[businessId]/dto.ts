import { z } from 'zod'

/**
 * Schema para actualizar configuración del negocio (PATCH)
 */
export const updateBusinessSettingsSchema = z.object({
    resourceLabel: z
        .string()
        .trim()
        .min(1, 'La etiqueta de recurso no puede estar vacía')
        .max(50, 'La etiqueta de recurso no puede exceder 50 caracteres')
})

export type UpdateBusinessSettingsRequest = z.infer<typeof updateBusinessSettingsSchema>
