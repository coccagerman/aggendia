import { z } from 'zod'

/**
 * Schema para crear un bloqueo
 */
export const createBlockSchema = z.object({
    startAt: z.string().datetime({ message: 'startAt debe ser una fecha ISO 8601 válida.' }),
    endAt: z.string().datetime({ message: 'endAt debe ser una fecha ISO 8601 válida.' }),
    reason: z.string().max(500, { message: 'El motivo no puede exceder 500 caracteres.' }).optional()
})

export type CreateBlockDTO = z.infer<typeof createBlockSchema>

/**
 * Schema para query params de listar bloqueos
 */
export const listBlocksQuerySchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
})

export type ListBlocksQueryDTO = z.infer<typeof listBlocksQuerySchema>
