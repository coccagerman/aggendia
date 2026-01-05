import { z } from 'zod'
import { DURATION_STEP } from '@/domain/services/service.types'

/**
 * Schema para crear un servicio (POST)
 * Validación en frontera API (DTO)
 */
export const createServiceSchema = z.object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(100, 'El nombre no puede exceder 100 caracteres'),
    description: z.string().trim().max(500, 'La descripción no puede exceder 500 caracteres').optional().nullable(),
    durationMinutes: z
        .number()
        .int('La duración debe ser un número entero')
        .min(DURATION_STEP, `La duración mínima es ${DURATION_STEP} minutos`)
        .max(480, 'La duración máxima es 480 minutos (8 horas)')
        .refine(val => val % DURATION_STEP === 0, {
            message: `La duración debe ser múltiplo de ${DURATION_STEP} minutos`
        }),
    bufferMinutes: z
        .number()
        .int('El buffer debe ser un número entero')
        .min(0, 'El buffer no puede ser negativo')
        .max(120, 'El buffer máximo es 120 minutos')
        .optional()
        .default(0),
    priceCents: z
        .number()
        .int('El precio debe ser un número entero (centavos)')
        .min(0, 'El precio no puede ser negativo')
        .optional()
        .nullable(),
    currency: z.string().trim().length(3, 'La moneda debe tener 3 caracteres (ej: ARS)').optional().default('ARS')
})

export type CreateServiceRequest = z.infer<typeof createServiceSchema>

/**
 * Schema para actualizar un servicio (PATCH)
 * Todos los campos son opcionales (partial update)
 */
export const updateServiceSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'El nombre es requerido')
        .max(100, 'El nombre no puede exceder 100 caracteres')
        .optional(),
    description: z.string().trim().max(500, 'La descripción no puede exceder 500 caracteres').optional().nullable(),
    durationMinutes: z
        .number()
        .int('La duración debe ser un número entero')
        .min(DURATION_STEP, `La duración mínima es ${DURATION_STEP} minutos`)
        .max(480, 'La duración máxima es 480 minutos (8 horas)')
        .refine(val => val % DURATION_STEP === 0, {
            message: `La duración debe ser múltiplo de ${DURATION_STEP} minutos`
        })
        .optional(),
    bufferMinutes: z
        .number()
        .int('El buffer debe ser un número entero')
        .min(0, 'El buffer no puede ser negativo')
        .max(120, 'El buffer máximo es 120 minutos')
        .optional(),
    priceCents: z
        .number()
        .int('El precio debe ser un número entero (centavos)')
        .min(0, 'El precio no puede ser negativo')
        .optional()
        .nullable(),
    currency: z.string().trim().length(3, 'La moneda debe tener 3 caracteres (ej: ARS)').optional()
})

export type UpdateServiceRequest = z.infer<typeof updateServiceSchema>
