/**
 * Service domain logic and validations
 */

import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { CreateServiceInput, UpdateServiceInput, DURATION_STEP } from './service.types'

/**
 * Valida que la duración del servicio sea válida (> 0 y múltiplo de DURATION_STEP)
 */
export function validateServiceDuration(durationMinutes: number): void {
    if (durationMinutes <= 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'La duración debe ser mayor a 0 minutos', 400)
    }

    // Validación de múltiplo de DURATION_STEP min para slots consistentes
    if (durationMinutes % DURATION_STEP !== 0) {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            `La duración debe ser múltiplo de ${DURATION_STEP} minutos`,
            400
        )
    }
}

/**
 * Valida que el buffer de minutos sea válido (>= 0)
 */
export function validateBufferMinutes(bufferMinutes: number): void {
    if (bufferMinutes < 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El buffer no puede ser negativo', 400)
    }
}

/**
 * Valida el input completo de creación de servicio
 */
export function validateCreateServiceInput(input: CreateServiceInput): void {
    if (!input.name || input.name.trim().length === 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El nombre del servicio es requerido', 400)
    }

    if (input.name.trim().length > 100) {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            'El nombre del servicio no puede exceder 100 caracteres',
            400
        )
    }

    validateServiceDuration(input.durationMinutes)

    if (input.bufferMinutes !== undefined) {
        validateBufferMinutes(input.bufferMinutes)
    }

    if (input.priceCents !== undefined && input.priceCents !== null && input.priceCents < 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El precio no puede ser negativo', 400)
    }
}

/**
 * Valida el input completo de actualización de servicio
 */
export function validateUpdateServiceInput(input: UpdateServiceInput): void {
    if (input.name !== undefined) {
        if (!input.name || input.name.trim().length === 0) {
            throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El nombre del servicio es requerido', 400)
        }
        if (input.name.trim().length > 100) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                'El nombre del servicio no puede exceder 100 caracteres',
                400
            )
        }
    }

    if (input.durationMinutes !== undefined) {
        validateServiceDuration(input.durationMinutes)
    }

    if (input.bufferMinutes !== undefined) {
        validateBufferMinutes(input.bufferMinutes)
    }

    if (input.priceCents !== undefined && input.priceCents !== null && input.priceCents < 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El precio no puede ser negativo', 400)
    }
}
