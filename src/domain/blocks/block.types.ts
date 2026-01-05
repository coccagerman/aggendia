/**
 * Domain types for ResourceBlock entity
 */

/**
 * Constantes de validación
 */
export const BLOCK_MIN_DURATION_MINUTES = 1
export const BLOCK_MAX_DURATION_DAYS = 365

/**
 * ResourceBlock - entidad de dominio
 */
export interface ResourceBlock {
    id: string
    resourceId: string
    startAt: Date
    endAt: Date
    reason: string | null
    createdAt: Date
    updatedAt: Date
}

/**
 * Input para crear un bloqueo
 */
export interface CreateBlockInput {
    resourceId: string
    startAt: Date
    endAt: Date
    reason?: string
}

/**
 * Input para listar bloqueos con filtros opcionales
 */
export interface ListBlocksInput {
    resourceId: string
    from?: Date
    to?: Date
}
