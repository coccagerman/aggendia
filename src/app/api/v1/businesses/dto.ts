import { z } from 'zod'

/**
 * DTOs para endpoints de businesses
 */

// Lista de timezones válidos para el MVP
export const VALID_TIMEZONES = [
    'America/Argentina/Buenos_Aires',
    'America/Sao_Paulo',
    'America/Santiago',
    'America/Lima',
    'America/Mexico_City',
    'UTC'
] as const

export const createBusinessRequestSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es demasiado largo'),
    timezone: z.enum(VALID_TIMEZONES, {
        message: 'Timezone inválido. Seleccioná una opción válida.'
    }),
    address: z.string().max(200, 'La dirección es demasiado larga').optional().nullable(),
    area: z.string().max(100, 'La ciudad/zona es demasiado larga').optional().nullable(),
    /** Optional trial link code — extends trial duration if valid */
    trialCode: z.string().max(50).optional()
})

export type CreateBusinessRequest = z.infer<typeof createBusinessRequestSchema>

export const businessResponseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    address: z.string().nullable(),
    area: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date()
})

export type BusinessResponse = z.infer<typeof businessResponseSchema>

export const businessWithRoleResponseSchema = businessResponseSchema.extend({
    role: z.enum(['OWNER', 'ADMIN', 'STAFF'])
})

export type BusinessWithRoleResponse = z.infer<typeof businessWithRoleResponseSchema>

export const businessListResponseSchema = z.object({
    data: z.array(businessWithRoleResponseSchema)
})

export type BusinessListResponse = z.infer<typeof businessListResponseSchema>
