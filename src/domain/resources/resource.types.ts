import { ResourceType, ResourceStatus } from '@prisma/client'

/**
 * Domain types for Resource entity
 */

export { ResourceType, ResourceStatus }

export interface Resource {
    id: string
    businessId: string
    name: string
    type: ResourceType | null
    status: ResourceStatus
    createdAt: Date
    updatedAt: Date
}

export interface CreateResourceInput {
    name: string
    type?: ResourceType | null
    status?: ResourceStatus
}

export interface UpdateResourceInput {
    name?: string
    type?: ResourceType | null
    status?: ResourceStatus
}
