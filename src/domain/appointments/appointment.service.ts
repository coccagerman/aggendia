/**
 * Domain service for appointment operations
 *
 * @see docs/user-stories.md - US-6.2 Cancelar turno
 */

import { AppError, AppointmentErrorCodes } from '@/domain/common/errors'
import { CancelAppointmentInput, CancelAppointmentOutput, AppointmentStatus } from './appointment.types'

/**
 * States that can be cancelled
 */
const CANCELLABLE_STATUSES: AppointmentStatus[] = ['SCHEDULED', 'RESCHEDULED']

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
            cancellationReason: appointment.cancellationReason
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
                cancellationReason: currentAppointment.cancellationReason
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
        cancellationReason: updated.cancellationReason
    }
}
