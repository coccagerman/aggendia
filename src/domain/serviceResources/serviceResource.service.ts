/**
 * ServiceResource domain service
 * Business logic for managing Service ↔ Resource associations
 */

import { z } from 'zod'
import { AppError, ValidationErrorCodes } from '@/domain/common/errors'

/**
 * Zod schema for validating resourceIds array
 */
export const setServiceResourcesInputSchema = z.object({
    resourceIds: z
        .array(z.string().uuid('ID de recurso / prestador inválido'))
        .max(50, 'No se pueden asociar más de 50 recursos / prestadores a un servicio')
})

/**
 * Validates the input for setServiceResources
 * @param input - Input to validate
 * @throws AppError if validation fails
 */
export function validateSetServiceResourcesInput(input: unknown): { resourceIds: string[] } {
    const result = setServiceResourcesInputSchema.safeParse(input)
    if (!result.success) {
        const firstError = result.error.issues[0]
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, firstError.message, 400, {
            field: firstError.path.join('.'),
            issues: result.error.issues
        })
    }
    return result.data
}

/**
 * Zod schema for single resource ID (add/remove operations)
 */
export const singleResourceIdSchema = z.object({
    resourceId: z.string().uuid('ID de recurso / prestador inválido')
})

/**
 * Validates a single resourceId
 * @param input - Input to validate
 * @throws AppError if validation fails
 */
export function validateSingleResourceId(input: unknown): { resourceId: string } {
    const result = singleResourceIdSchema.safeParse(input)
    if (!result.success) {
        const firstError = result.error.issues[0]
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, firstError.message, 400, {
            field: firstError.path.join('.'),
            issues: result.error.issues
        })
    }
    return result.data
}
