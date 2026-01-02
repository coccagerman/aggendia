/**
 * Service domain types
 */

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
