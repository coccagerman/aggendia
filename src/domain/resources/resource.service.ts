import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { CreateResourceInput, UpdateResourceInput } from './resource.types'

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

/**
 * Valida el input para actualizar un recurso
 */
export function validateUpdateResourceInput(input: UpdateResourceInput): void {
    // Si se proporciona name, validar que no esté vacío ni exceda el límite
    if (input.name !== undefined) {
        if (input.name.trim().length === 0) {
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

    // Validar que status no sea DELETED (solo se usa internamente en soft delete)
    if (input.status === 'DELETED') {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            'No se puede establecer el estado DELETED directamente.',
            400
        )
    }
}
