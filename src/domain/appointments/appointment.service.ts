/**
 * Domain service for appointment operations
 *
 * @see docs/user-stories.md - US-6.2 Cancelar turno
 * @see docs/user-stories.md - US-6.3 Reprogramar turno
 * @see docs/user-stories.md - US-6.4 Marcar completado
 */

import { AppError, AppointmentErrorCodes } from '@/domain/common/errors'
import { isWithinAvailability } from '@/domain/availability/availability.service'
import type { AvailabilityRangeInput } from '@/domain/availability/availability.types'
import {
    CancelAppointmentInput,
    CancelAppointmentOutput,
    AppointmentStatus,
    RescheduleAppointmentInput,
    RescheduleAppointmentOutput,
    CompleteAppointmentInput,
    CompleteAppointmentOutput
} from './appointment.types'

/**
 * States that can be cancelled
 */
const CANCELLABLE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'RESCHEDULED']

/**
 * States that can be rescheduled
 * Same as cancellable - both SCHEDULED and RESCHEDULED can be rescheduled
 * This allows chains of rescheduling (turno A -> B -> C)
 */
const RESCHEDULABLE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'RESCHEDULED']

/**
 * Appointment data returned by repository (minimal fields needed for cancellation)
 */
interface AppointmentForCancellation {
    id: string
    status: AppointmentStatus
    cancellationReason: string | null
}

/**
 * Repository dependencies for cancelAppointment
 * Allows domain to remain infrastructure-agnostic (no Prisma dependency)
 */
export interface CancelAppointmentDeps {
    /** Get appointment by ID with multi-tenant validation */
    getAppointmentById: (businessId: string, appointmentId: string) => Promise<AppointmentForCancellation | null>
    /** Update appointment status atomically with expected state check */
    updateAppointmentStatus: (
        appointmentId: string,
        status: AppointmentStatus,
        cancellationReason: string | undefined,
        expectedStatuses: AppointmentStatus[]
    ) => Promise<AppointmentForCancellation | null>
}

/**
 * Cancel an appointment
 *
 * Business rules:
 * - Appointment must exist and belong to the specified business (multi-tenant)
 * - Only SCHEDULED or RESCHEDULED appointments can be cancelled
 * - Idempotent: if already CANCELLED, returns success without error
 * - Stores optional cancellation reason
 * - Uses atomic state verification to prevent race conditions
 *
 * @param deps - Repository dependencies (injected)
 * @param input - Cancel appointment input
 * @returns Cancelled appointment output
 * @throws AppError if appointment not found or invalid status
 */
export async function cancelAppointment(
    deps: CancelAppointmentDeps,
    input: CancelAppointmentInput
): Promise<CancelAppointmentOutput> {
    const { businessId, appointmentId, cancellationReason } = input

    // 1. Get appointment with multi-tenant validation
    const appointment = await deps.getAppointmentById(businessId, appointmentId)

    if (!appointment) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_NOT_FOUND,
            'El turno no existe o no pertenece a este negocio',
            404
        )
    }

    // 2. Check if already cancelled (idempotent)
    if (appointment.status === 'CANCELLED') {
        return {
            appointmentId: appointment.id,
            status: 'CANCELLED',
            cancellationReason: appointment.cancellationReason,
            wasAlreadyCancelled: true
        }
    }

    // 3. Validate current status allows cancellation
    if (!CANCELLABLE_STATUSES.includes(appointment.status)) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            `No se puede cancelar un turno en estado ${appointment.status}`,
            400
        )
    }

    // 4. Update status to CANCELLED with atomic state verification
    // This prevents race conditions where status changes between read and write
    const updated = await deps.updateAppointmentStatus(
        appointmentId,
        'CANCELLED',
        cancellationReason,
        CANCELLABLE_STATUSES
    )

    // If update returned null, the state changed between validation and update (race condition)
    if (!updated) {
        // Re-fetch to check current state
        const currentAppointment = await deps.getAppointmentById(businessId, appointmentId)

        // If it's now CANCELLED, treat as success (idempotent)
        if (currentAppointment?.status === 'CANCELLED') {
            return {
                appointmentId: currentAppointment.id,
                status: 'CANCELLED',
                cancellationReason: currentAppointment.cancellationReason,
                wasAlreadyCancelled: true
            }
        }

        // Otherwise, the status changed to something else (e.g., COMPLETED)
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            `El estado del turno cambió durante la operación. Estado actual: ${
                currentAppointment?.status ?? 'desconocido'
            }`,
            409
        )
    }

    return {
        appointmentId: updated.id,
        status: 'CANCELLED',
        cancellationReason: updated.cancellationReason,
        wasAlreadyCancelled: false
    }
}

// ============================================================================
// Reschedule Appointment (US-6.3)
// ============================================================================

/**
 * Appointment data needed for rescheduling validation
 */
interface AppointmentForReschedule {
    id: string
    businessId: string
    resourceId: string
    serviceId: string
    customerId: string
    status: AppointmentStatus
    businessTimezone: string
    service: {
        id: string
        name: string
        durationMinutes: number
        slotIntervalMinutes: number
        status: string
    }
    resource: {
        id: string
        name: string
        status: string
    }
}

/**
 * Result of creating a rescheduled appointment in repository
 */
interface RescheduleResult {
    newAppointmentId: string
    originalAppointmentId: string
    newStartAt: Date
    newEndAt: Date
    newSecretToken: string
}

/**
 * Block interval for overlap checking
 */
interface BlockInterval {
    startAt: Date
    endAt: Date
}

/**
 * Repository dependencies for rescheduleAppointment
 */
export interface RescheduleAppointmentDeps {
    /** Get appointment by ID with service/resource info for validation */
    getAppointmentForReschedule: (businessId: string, appointmentId: string) => Promise<AppointmentForReschedule | null>
    /** Get availability rules for a resource */
    getAvailabilityRules: (resourceId: string) => Promise<AvailabilityRangeInput[]>
    /** Get blocks for a resource within a date range */
    getBlocksByResourceId: (resourceId: string, from: Date, to: Date) => Promise<BlockInterval[]>
    /** Create new appointment and mark original as RESCHEDULED in a transaction */
    createRescheduledAppointment: (input: {
        originalAppointmentId: string
        businessId: string
        resourceId: string
        serviceId: string
        customerId: string
        startAt: Date
        endAt: Date
        occupiedEndAt: Date
    }) => Promise<RescheduleResult>
}

/**
 * Reschedule an appointment to a new time slot
 *
 * Business rules:
 * - Appointment must exist and belong to the specified business (multi-tenant)
 * - Only SCHEDULED or RESCHEDULED appointments can be rescheduled
 * - New start time must be in the future
 * - New slot must be within resource availability rules
 * - New slot must not overlap with resource blocks
 * - Service and resource must still be ACTIVE
 * - Creates a NEW appointment with rescheduled_from_id pointing to original
 * - Original appointment status changes to RESCHEDULED (frees original slot)
 * - Both operations happen atomically in a transaction
 * - DB constraint prevents double-booking on new slot (only SCHEDULED blocks)
 *
 * @param deps - Repository dependencies (injected)
 * @param input - Reschedule appointment input
 * @returns Rescheduled appointment output
 * @throws AppError if validation fails or slot is taken
 */
export async function rescheduleAppointment(
    deps: RescheduleAppointmentDeps,
    input: RescheduleAppointmentInput
): Promise<RescheduleAppointmentOutput> {
    const { businessId, appointmentId, newStartAt } = input

    // 1. Parse and validate new start time
    const newStartAtDate = new Date(newStartAt)
    if (isNaN(newStartAtDate.getTime())) {
        throw new AppError(AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS, 'La fecha proporcionada no es válida', 400)
    }

    // 2. Validate new time is in the future
    if (newStartAtDate <= new Date()) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
            'No se puede reprogramar a un horario que ya pasó',
            400
        )
    }

    // 3. Get appointment with multi-tenant validation
    const appointment = await deps.getAppointmentForReschedule(businessId, appointmentId)

    if (!appointment) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_NOT_FOUND,
            'El turno no existe o no pertenece a este negocio',
            404
        )
    }

    // 4. Validate current status allows rescheduling
    if (!RESCHEDULABLE_STATUSES.includes(appointment.status)) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            `No se puede reprogramar un turno en estado ${appointment.status}`,
            400
        )
    }

    // 5. Validate service is still ACTIVE
    if (appointment.service.status !== 'ACTIVE') {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            'No se puede reprogramar: el servicio ya no está disponible',
            400
        )
    }

    // 6. Validate resource is still ACTIVE
    if (appointment.resource.status !== 'ACTIVE') {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            'No se puede reprogramar: el recurso ya no está disponible',
            400
        )
    }

    // 7. Calculate new end times based on service duration and slot interval
    const { durationMinutes, slotIntervalMinutes } = appointment.service
    const newEndAt = new Date(newStartAtDate.getTime() + durationMinutes * 60 * 1000)
    const newOccupiedEndAt = new Date(newStartAtDate.getTime() + slotIntervalMinutes * 60 * 1000)

    // 8. Validate new slot is within resource availability (prevents creating appointments outside configured hours)
    const availabilityRules = await deps.getAvailabilityRules(appointment.resourceId)
    if (!isWithinAvailability(availabilityRules, newStartAtDate, newEndAt, appointment.businessTimezone)) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
            'El horario seleccionado está fuera del horario disponible del recurso',
            409
        )
    }

    // 9. Validate new slot doesn't overlap with any resource blocks (vacations, holidays, etc.)
    const blocks = await deps.getBlocksByResourceId(appointment.resourceId, newStartAtDate, newOccupiedEndAt)
    const hasBlockOverlap = blocks.some(block => newStartAtDate < block.endAt && newOccupiedEndAt > block.startAt)
    if (hasBlockOverlap) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
            'El horario seleccionado está bloqueado',
            409
        )
    }

    // 10. Create new appointment and mark original as RESCHEDULED (atomic transaction)
    // The repository handles the DB constraint violation for double-booking
    const result = await deps.createRescheduledAppointment({
        originalAppointmentId: appointmentId,
        businessId: appointment.businessId,
        resourceId: appointment.resourceId,
        serviceId: appointment.serviceId,
        customerId: appointment.customerId,
        startAt: newStartAtDate,
        endAt: newEndAt,
        occupiedEndAt: newOccupiedEndAt
    })

    return {
        newAppointmentId: result.newAppointmentId,
        originalAppointmentId: result.originalAppointmentId,
        newStartAt: result.newStartAt.toISOString(),
        newEndAt: result.newEndAt.toISOString(),
        newSecretToken: result.newSecretToken
    }
}

// ============================================================================
// Mark Appointment as Completed (US-6.4)
// ============================================================================

/**
 * States that can be marked as completed
 */
const COMPLETABLE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'RESCHEDULED']

/**
 * Appointment data returned by repository (minimal fields needed for completion)
 */
interface AppointmentForCompletion {
    id: string
    status: AppointmentStatus
    startAt: Date
    /** End time including buffer - used to validate completion (slot must be finished) */
    occupiedEndAt: Date
}

/**
 * Repository dependencies for markAppointmentAsCompleted
 * Allows domain to remain infrastructure-agnostic (no Prisma dependency)
 */
export interface CompleteAppointmentDeps {
    /** Get appointment by ID with multi-tenant validation */
    getAppointmentById: (businessId: string, appointmentId: string) => Promise<AppointmentForCompletion | null>
    /** Update appointment status atomically with expected state check */
    updateAppointmentStatus: (
        appointmentId: string,
        status: AppointmentStatus,
        cancellationReason: string | undefined,
        expectedStatuses: AppointmentStatus[]
    ) => Promise<AppointmentForCompletion | null>
}

/**
 * Mark an appointment as completed
 *
 * Business rules:
 * - Appointment must exist and belong to the specified business (multi-tenant)
 * - Only SCHEDULED or RESCHEDULED appointments can be marked as completed
 * - Appointment occupiedEndAt must be <= current time (cannot complete in-progress or future appointments)
 * - Idempotent: if already COMPLETED, returns success without error
 * - Uses atomic state verification to prevent race conditions
 * - Marking as completed does NOT free the slot (slot already passed)
 *
 * @see docs/user-stories.md - US-6.4 Marcar completado
 *
 * @param deps - Repository dependencies (injected)
 * @param input - Complete appointment input
 * @returns Completed appointment output
 * @throws AppError if appointment not found, invalid status, or appointment not finished
 */
export async function markAppointmentAsCompleted(
    deps: CompleteAppointmentDeps,
    input: CompleteAppointmentInput
): Promise<CompleteAppointmentOutput> {
    const { businessId, appointmentId, currentTime } = input

    // 1. Get appointment with multi-tenant validation
    const appointment = await deps.getAppointmentById(businessId, appointmentId)

    if (!appointment) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_NOT_FOUND,
            'El turno no existe o no pertenece a este negocio',
            404
        )
    }

    // 2. Check if already completed (idempotent)
    if (appointment.status === 'COMPLETED') {
        return {
            appointmentId: appointment.id,
            status: 'COMPLETED'
        }
    }

    // 3. Validate current status allows completion
    if (!COMPLETABLE_STATUSES.includes(appointment.status)) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            `No se puede marcar como completado un turno en estado ${appointment.status}`,
            400
        )
    }

    // 4. Validate appointment has finished (cannot complete future or in-progress appointments)
    // This ensures "no afecta disponibilidad" because the slot is already in the past
    if (appointment.occupiedEndAt > currentTime) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            'No se puede marcar como completado un turno que aún no ha finalizado',
            400
        )
    }

    // 5. Update status to COMPLETED with atomic state verification
    // This prevents race conditions where status changes between read and write
    const updated = await deps.updateAppointmentStatus(appointmentId, 'COMPLETED', undefined, COMPLETABLE_STATUSES)

    // If update returned null, the state changed between validation and update (race condition)
    if (!updated) {
        // Re-fetch to check current state
        const currentAppointment = await deps.getAppointmentById(businessId, appointmentId)

        // If it's now COMPLETED, treat as success (idempotent)
        if (currentAppointment?.status === 'COMPLETED') {
            return {
                appointmentId: currentAppointment.id,
                status: 'COMPLETED'
            }
        }

        // Otherwise, the status changed to something else (e.g., CANCELLED)
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
            `El estado del turno cambió durante la operación. Estado actual: ${
                currentAppointment?.status ?? 'desconocido'
            }`,
            409
        )
    }

    return {
        appointmentId: updated.id,
        status: 'COMPLETED'
    }
}
