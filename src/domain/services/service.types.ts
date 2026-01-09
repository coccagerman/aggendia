/**
 * Service domain types
 */

/**
 * Constante para el paso de duración/periodicidad en minutos.
 * Los slots de servicio deben ser múltiplos de este valor.
 */
export const DURATION_STEP = 5

/**
 * Maximum booking notice allowed (7 days in minutes)
 */
export const MAX_BOOKING_NOTICE_MINUTES = 10080

/**
 * Opciones de duración predefinidas para UI.
 * Generadas como múltiplos de DURATION_STEP.
 */
export const DURATION_OPTIONS = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hora' },
    { value: 90, label: '1.5 horas' },
    { value: 120, label: '2 horas' }
] as const

/**
 * Estados posibles de un servicio
 */
export type ServiceStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED'

export type Service = {
    id: string
    businessId: string
    name: string
    description: string | null
    durationMinutes: number
    slotIntervalMinutes: number // Periodicidad: cada cuántos minutos se ofrece un nuevo turno
    minBookingNoticeMinutes: number // Anticipación mínima para reservas (minutos)
    priceCents: number | null
    currency: string | null
    status: ServiceStatus
    createdAt: Date
    updatedAt: Date
}

export type CreateServiceInput = {
    name: string
    description?: string | null
    durationMinutes: number
    slotIntervalMinutes?: number // Si no se especifica, usa durationMinutes por defecto
    minBookingNoticeMinutes?: number // Si no se especifica, default 0
    priceCents?: number | null
    currency?: string | null
}

export type UpdateServiceInput = Partial<CreateServiceInput> & {
    status?: ServiceStatus
}
