import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { CreateResourceInput } from './resource.types'

/**
 * Valida el input para crear un recurso
 */
export function validateCreateResourceInput(input: CreateResourceInput): void {
    if (!input.name || input.name.trim().length === 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El nombre del recurso es requerido.', 400)
    }

    if (input.name.trim().length > 100) {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            'El nombre del recurso no puede exceder 100 caracteres.',
            400
        )
    }
}
