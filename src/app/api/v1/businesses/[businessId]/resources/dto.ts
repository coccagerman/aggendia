import { z } from 'zod'

/**
 * Schema para crear un recurso / prestador (POST)
 */
export const createResourceSchema = z.object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
    type: z.enum(['PERSON', 'ASSET']).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE')
})

/**
 * Schema para actualizar un recurso / prestador (PATCH)
 */
export const updateResourceSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    type: z.enum(['PERSON', 'ASSET']).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})

/**
 * Schema para actualizar un recurso / prestador vía colección (PATCH /resources)
 */
export const patchResourceByIdSchema = z.object({
    resourceId: z.string().uuid('resourceId inválido'),
    name: z.string().trim().min(1).max(100).optional(),
    type: z.enum(['PERSON', 'ASSET']).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})

/**
 * Schema para eliminar un recurso / prestador vía colección (DELETE /resources)
 */
export const deleteResourceByIdSchema = z.object({
    resourceId: z.string().uuid('resourceId inválido')
})

export type CreateResourceRequest = z.infer<typeof createResourceSchema>
export type UpdateResourceRequest = z.infer<typeof updateResourceSchema>
export type PatchResourceByIdRequest = z.infer<typeof patchResourceByIdSchema>
export type DeleteResourceByIdRequest = z.infer<typeof deleteResourceByIdSchema>
