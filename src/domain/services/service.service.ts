/**
 * Service domain logic and validations
 */

import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { CreateServiceInput, UpdateServiceInput, DURATION_STEP, MAX_BOOKING_NOTICE_MINUTES } from './service.types'

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
 * Valida que minBookingNoticeMinutes sea válido (>= 0 y <= MAX_BOOKING_NOTICE_MINUTES)
 */
export function validateMinBookingNoticeMinutes(minBookingNoticeMinutes: number): void {
    if (minBookingNoticeMinutes < 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'La anticipación no puede ser negativa', 400)
    }

    if (minBookingNoticeMinutes > MAX_BOOKING_NOTICE_MINUTES) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'La anticipación no puede superar 7 días', 400)
    }
}

/**
 * Valida que slotIntervalMinutes sea válido (>= durationMinutes y múltiplo de DURATION_STEP)
 */
export function validateSlotIntervalMinutes(slotIntervalMinutes: number, durationMinutes: number): void {
    if (slotIntervalMinutes < durationMinutes) {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            'La periodicidad no puede ser menor que la duración del turno',
            400
        )
    }

    if (slotIntervalMinutes % DURATION_STEP !== 0) {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            `La periodicidad debe ser múltiplo de ${DURATION_STEP} minutos`,
            400
        )
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

    // Si se especifica slotIntervalMinutes, validar
    // Si no se especifica, se usará durationMinutes como default (en repo)
    if (input.slotIntervalMinutes !== undefined) {
        validateSlotIntervalMinutes(input.slotIntervalMinutes, input.durationMinutes)
    }

    // Validar minBookingNoticeMinutes si se especifica
    if (input.minBookingNoticeMinutes !== undefined) {
        validateMinBookingNoticeMinutes(input.minBookingNoticeMinutes)
    }

    if (input.priceCents !== undefined && input.priceCents !== null && input.priceCents < 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El precio no puede ser negativo', 400)
    }
}

/**
 * Valida el input completo de actualización de servicio
 */
export function validateUpdateServiceInput(input: UpdateServiceInput, existingDuration?: number): void {
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

    // Para validar slotIntervalMinutes necesitamos saber la duración final
    // (puede ser la nueva o la existente)
    if (input.slotIntervalMinutes !== undefined) {
        const duration = input.durationMinutes ?? existingDuration
        if (duration !== undefined) {
            validateSlotIntervalMinutes(input.slotIntervalMinutes, duration)
        }
    }

    // Validar minBookingNoticeMinutes si se especifica
    if (input.minBookingNoticeMinutes !== undefined) {
        validateMinBookingNoticeMinutes(input.minBookingNoticeMinutes)
    }

    if (input.priceCents !== undefined && input.priceCents !== null && input.priceCents < 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El precio no puede ser negativo', 400)
    }
}

/**
 * Resultado de la validación para eliminar un servicio.
 */
export interface CanDeleteServiceResult {
    canDelete: boolean
    futureAppointmentsCount: number
}

/**
 * Verifica si un servicio puede ser eliminado (soft delete).
 * Un servicio solo puede eliminarse si no tiene turnos futuros SCHEDULED.
 * @param futureAppointmentsCount - Cantidad de turnos futuros del servicio
 * @returns Resultado indicando si puede eliminarse
 */
export function canDeleteService(futureAppointmentsCount: number): CanDeleteServiceResult {
    return {
        canDelete: futureAppointmentsCount === 0,
        futureAppointmentsCount
    }
}
