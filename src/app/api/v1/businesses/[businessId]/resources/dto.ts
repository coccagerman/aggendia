import { z } from 'zod'

/**
 * Schema para crear un recurso (POST)
 */
export const createResourceSchema = z.object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
    type: z.enum(['PERSON', 'ASSET']).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE')
})

/**
 * Schema para actualizar un recurso (PATCH)
 */
export const updateResourceSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    type: z.enum(['PERSON', 'ASSET']).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})

export type CreateResourceRequest = z.infer<typeof createResourceSchema>
export type UpdateResourceRequest = z.infer<typeof updateResourceSchema>
