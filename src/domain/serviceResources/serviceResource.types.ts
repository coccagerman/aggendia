/**
 * Domain types for ServiceResource entity (many-to-many Service ↔ Resource)
 */

import { type Resource, type ResourceStatus } from '@/domain/resources/resource.types'

/**
 * ServiceResource - Link entity between Service and Resource
 */
export interface ServiceResource {
    id: string
    businessId: string
    serviceId: string
    resourceId: string
    createdAt: Date
}

/**
 * ServiceResource with embedded resource data (for GET responses)
 */
export interface ServiceResourceWithResource extends ServiceResource {
    resource: Resource
}

/**
 * Summary of a linked resource for display purposes
 */
export interface LinkedResourceSummary {
    resourceId: string
    resourceName: string
    resourceStatus: ResourceStatus
}

/**
 * Input for creating a service-resource link
 */
export interface CreateServiceResourceInput {
    serviceId: string
    resourceId: string
}

/**
 * Input for bulk update of service-resource links (replace all)
 */
export interface SetServiceResourcesInput {
    resourceIds: string[]
}
