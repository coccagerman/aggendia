import { z } from 'zod'

/**
 * DTOs for admin trial-links endpoints
 */

export const createTrialLinkRequestSchema = z.object({
    code: z
        .string()
        .min(3, 'El código debe tener al menos 3 caracteres')
        .max(50, 'El código es demasiado largo')
        .regex(/^[a-zA-Z0-9_-]+$/, 'Solo letras, números, guiones y guiones bajos'),
    trialDays: z.number().int().min(1).max(365).default(60),
    maxUses: z.number().int().min(1).nullable().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional()
})

export const updateTrialLinkRequestSchema = z.object({
    isActive: z.boolean().optional(),
    maxUses: z.number().int().min(1).nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
})
