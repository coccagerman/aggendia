/**
 * Service domain types
 */

/**
 * Constante para el paso de duración en minutos.
 * Los slots de servicio deben ser múltiplos de este valor.
 */
export const DURATION_STEP = 5

export type Service = {
    id: string
    businessId: string
    name: string
    description: string | null
    durationMinutes: number
    bufferMinutes: number
    priceCents: number | null
    currency: string | null
    active: boolean
    createdAt: Date
    updatedAt: Date
}

export type CreateServiceInput = {
    name: string
    description?: string | null
    durationMinutes: number
    bufferMinutes?: number
    priceCents?: number | null
    currency?: string | null
}

export type UpdateServiceInput = Partial<CreateServiceInput> & {
    active?: boolean
}
