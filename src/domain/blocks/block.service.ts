/**
 * Domain service for ResourceBlock validation and business rules
 */

import { AppError, BlockErrorCodes } from '@/domain/common/errors'
import { BLOCK_MIN_DURATION_MINUTES, BLOCK_MAX_DURATION_DAYS, ResourceBlock } from './block.types'

/**
 * Calcula la diferencia en minutos entre dos fechas
 */
function diffInMinutes(start: Date, end: Date): number {
    return (end.getTime() - start.getTime()) / (1000 * 60)
}

/**
 * Calcula la diferencia en días entre dos fechas
 */
function diffInDays(start: Date, end: Date): number {
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
}

/**
 * Valida que el rango de un bloqueo sea válido
 * - startAt < endAt
 * - Duración mínima: 1 minuto
 * - Duración máxima: 365 días
 */
export function validateBlockRange(startAt: Date, endAt: Date): void {
    // startAt debe ser menor que endAt
    if (startAt >= endAt) {
        throw new AppError(
            BlockErrorCodes.BLOCK_INVALID_RANGE,
            'La fecha de inicio debe ser anterior a la fecha de fin.',
            400,
            { startAt: startAt.toISOString(), endAt: endAt.toISOString() }
        )
    }

    // Duración mínima
    const durationMinutes = diffInMinutes(startAt, endAt)
    if (durationMinutes < BLOCK_MIN_DURATION_MINUTES) {
        throw new AppError(
            BlockErrorCodes.BLOCK_INVALID_RANGE,
            `La duración mínima del bloqueo es ${BLOCK_MIN_DURATION_MINUTES} minuto(s).`,
            400,
            { durationMinutes }
        )
    }

    // Duración máxima
    const durationDays = diffInDays(startAt, endAt)
    if (durationDays > BLOCK_MAX_DURATION_DAYS) {
        throw new AppError(
            BlockErrorCodes.BLOCK_RANGE_TOO_LONG,
            `La duración máxima del bloqueo es ${BLOCK_MAX_DURATION_DAYS} días.`,
            400,
            { durationDays }
        )
    }
}

/**
 * Verifica si dos rangos de tiempo se solapan
 * Dos rangos se solapan si: start1 < end2 && start2 < end1
 */
export function rangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1
}

/**
 * Valida que un nuevo bloqueo no se solape con bloqueos existentes
 * @param existingBlocks - Bloqueos existentes para el recurso / prestador
 * @param startAt - Inicio del nuevo bloqueo
 * @param endAt - Fin del nuevo bloqueo
 * @param excludeBlockId - ID del bloqueo a excluir (para edición futura)
 */
export function validateNoOverlap(
    existingBlocks: ResourceBlock[],
    startAt: Date,
    endAt: Date,
    excludeBlockId?: string
): void {
    const filteredBlocks = excludeBlockId ? existingBlocks.filter(b => b.id !== excludeBlockId) : existingBlocks

    const overlappingBlock = filteredBlocks.find(block => rangesOverlap(startAt, endAt, block.startAt, block.endAt))

    if (overlappingBlock) {
        throw new AppError(BlockErrorCodes.BLOCK_OVERLAP, 'Ya existe un bloqueo en ese rango de tiempo.', 409, {
            existingBlockId: overlappingBlock.id,
            existingStartAt: overlappingBlock.startAt.toISOString(),
            existingEndAt: overlappingBlock.endAt.toISOString()
        })
    }
}

/**
 * Formatea la duración de un bloqueo para mostrar en UI
 */
export function formatBlockDuration(startAt: Date, endAt: Date): string {
    const minutes = diffInMinutes(startAt, endAt)

    if (minutes < 60) {
        return `${Math.round(minutes)} min`
    }

    const hours = minutes / 60
    if (hours < 24) {
        return hours === 1 ? '1 hora' : `${Math.round(hours)} horas`
    }

    const days = hours / 24
    return days === 1 ? '1 día' : `${Math.round(days)} días`
}
