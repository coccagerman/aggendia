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

/**
 * Resultado de la validación para eliminar un recurso.
 */
export interface CanDeleteResult {
    canDelete: boolean
    futureAppointmentsCount: number
}

/**
 * Verifica si un recurso puede ser eliminado.
 * Retorna si puede eliminarse y la cantidad de turnos futuros.
 *
 * TODO: Cuando exista el modelo Appointment, implementar la verificación real.
 * Por ahora siempre permite eliminar (futureAppointmentsCount = 0).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canDeleteResource(_resourceId: string): CanDeleteResult {
    // Stub: cuando se implemente Appointment, aquí se consultará
    // la cantidad de turnos futuros para este recurso
    return {
        canDelete: true,
        futureAppointmentsCount: 0
    }
}
