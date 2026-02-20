import { z } from 'zod'

export const updateBusinessSettingsSchema = z.object({
    resource_label: z
        .string()
        .trim()
        .min(1, 'La etiqueta de recurso / prestador no puede estar vacía')
        .max(50, 'La etiqueta de recurso / prestador no puede exceder 50 caracteres')
        .optional()
})

export type UpdateBusinessSettingsRequest = z.infer<typeof updateBusinessSettingsSchema>
