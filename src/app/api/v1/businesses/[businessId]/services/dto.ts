import { z } from 'zod'
import { DURATION_STEP } from '@/domain/services/service.types'

/**
 * Schema para crear un servicio (POST)
 * Validación en frontera API (DTO)
 */
export const createServiceSchema = z
    .object({
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
        slotIntervalMinutes: z
            .number()
            .int('La periodicidad debe ser un número entero')
            .min(DURATION_STEP, `La periodicidad mínima es ${DURATION_STEP} minutos`)
            .max(480, 'La periodicidad máxima es 480 minutos (8 horas)')
            .refine(val => val % DURATION_STEP === 0, {
                message: `La periodicidad debe ser múltiplo de ${DURATION_STEP} minutos`
            })
            .optional(),
        priceCents: z
            .number()
            .int('El precio debe ser un número entero (centavos)')
            .min(0, 'El precio no puede ser negativo')
            .optional()
            .nullable(),
        currency: z.string().trim().length(3, 'La moneda debe tener 3 caracteres (ej: ARS)').optional().default('ARS')
    })
    .refine(
        data => {
            // Si se especifica slotIntervalMinutes, debe ser >= durationMinutes
            if (data.slotIntervalMinutes !== undefined) {
                return data.slotIntervalMinutes >= data.durationMinutes
            }
            return true
        },
        {
            message: 'La periodicidad no puede ser menor que la duración del turno',
            path: ['slotIntervalMinutes']
        }
    )

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
    slotIntervalMinutes: z
        .number()
        .int('La periodicidad debe ser un número entero')
        .min(DURATION_STEP, `La periodicidad mínima es ${DURATION_STEP} minutos`)
        .max(480, 'La periodicidad máxima es 480 minutos (8 horas)')
        .refine(val => val % DURATION_STEP === 0, {
            message: `La periodicidad debe ser múltiplo de ${DURATION_STEP} minutos`
        })
        .optional(),
    priceCents: z
        .number()
        .int('El precio debe ser un número entero (centavos)')
        .min(0, 'El precio no puede ser negativo')
        .optional()
        .nullable(),
    currency: z.string().trim().length(3, 'La moneda debe tener 3 caracteres (ej: ARS)').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
})

export type UpdateServiceRequest = z.infer<typeof updateServiceSchema>
