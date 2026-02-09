import { BusinessRole, BusinessStatus } from '@prisma/client'

/**
 * Domain types for Business entity
 */

export { BusinessRole, BusinessStatus }

export interface Business {
    id: string
    name: string
    slug: string
    timezone: string
    resourceLabel: string
    address: string | null
    area: string | null
    status: BusinessStatus
    remindersEnabled: boolean
    reminderOffsetsMinutes: number[]
    emailNotificationsEnabled: boolean
    whatsappNotificationsEnabled: boolean
    createdAt: Date
    updatedAt: Date
}

export interface BusinessMember {
    id: string
    businessId: string
    userId: string
    role: BusinessRole
    createdAt: Date
}

export interface CreateBusinessInput {
    name: string
    timezone: string
    resourceLabel?: string
    address?: string | null
    area?: string | null
}

export interface CreateBusinessResult {
    business: Business
    member: BusinessMember
}

export interface UpdateBusinessInput {
    name?: string
    timezone?: string
    address?: string | null
    area?: string | null
    status?: BusinessStatus
}

export interface BusinessWithRole extends Business {
    role: BusinessRole
}
