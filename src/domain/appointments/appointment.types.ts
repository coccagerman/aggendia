/**
 * Domain types for appointments
 */

export type AppointmentStatus = 'SCHEDULED' | 'CANCELLED' | 'RESCHEDULED' | 'COMPLETED'

/**
 * Input for creating a public appointment (from booking page)
 */
export interface CreatePublicAppointmentInput {
    slug: string
    serviceId: string
    resourceId: string
    startAt: string // ISO 8601 UTC string
    customer: {
        fullName: string
        email?: string
        phone?: string
    }
    notes?: string
}

/**
 * Output for created appointment (API response)
 */
export interface AppointmentOutput {
    appointmentId: string
    status: AppointmentStatus
    startAt: string // ISO 8601 UTC
    endAt: string // ISO 8601 UTC
    service: {
        id: string
        name: string
    }
    resource: {
        id: string
        name: string
    }
    business: {
        name: string
        timezone: string
    }
    customer: {
        fullName: string
    }
}

/**
 * Result type for domain operations
 */
export type CreateAppointmentResult =
    | { success: true; data: AppointmentOutput }
    | { success: false; error: { code: string; message: string; httpStatus: number } }
