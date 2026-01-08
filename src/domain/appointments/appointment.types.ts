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
 * Input for cancelling an appointment
 */
export interface CancelAppointmentInput {
    businessId: string
    appointmentId: string
    cancellationReason?: string
}

/**
 * Output for cancelled appointment
 */
export interface CancelAppointmentOutput {
    appointmentId: string
    status: 'CANCELLED'
    cancellationReason: string | null
}

/**
 * Input for rescheduling an appointment
 * @see docs/user-stories.md - US-6.3 Reprogramar turno
 */
export interface RescheduleAppointmentInput {
    businessId: string
    appointmentId: string
    /** New start time in ISO 8601 UTC format */
    newStartAt: string
}

/**
 * Output for rescheduled appointment
 */
export interface RescheduleAppointmentOutput {
    /** ID of the newly created appointment */
    newAppointmentId: string
    /** ID of the original appointment (now RESCHEDULED) */
    originalAppointmentId: string
    /** New start time in ISO 8601 UTC */
    newStartAt: string
    /** New end time in ISO 8601 UTC */
    newEndAt: string
}

/**
 * Result type for domain operations
 */
export type CreateAppointmentResult =
    | { success: true; data: AppointmentOutput }
    | { success: false; error: { code: string; message: string; httpStatus: number } }
