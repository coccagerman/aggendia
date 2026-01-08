/**
 * Repository for appointments table
 * Handles appointment CRUD operations with anti double-booking support
 *
 * @see docs/user-stories.md - US-5.4
 */

import { PrismaClient, Appointment, AppointmentStatus, Prisma } from '@prisma/client'
import { AppError, AppointmentErrorCodes, SystemErrorCodes } from '@/domain/common/errors'

export interface AppointmentOccupiedSlot {
    id: string
    resourceId: string
    startAt: Date
    endAt: Date
    occupiedEndAt: Date
}

export interface CreateAppointmentInput {
    businessId: string
    resourceId: string
    serviceId: string
    customerId: string
    startAt: Date
    endAt: Date
    occupiedEndAt: Date
    notes?: string | null
    createdByUserId?: string | null
}

export interface AppointmentWithRelations extends Appointment {
    service: {
        id: string
        name: string
    }
    resource: {
        id: string
        name: string
    }
    customer: {
        id: string
        fullName: string
        email: string | null
        phone: string | null
    }
    business: {
        id: string
        name: string
        timezone: string
    }
}

/**
 * Get appointments for a resource within a date range
 * Returns only appointments that block slots (SCHEDULED)
 * Note: RESCHEDULED appointments don't block slots - their time was moved
 */
export async function getAppointmentsByResourceAndRange(
    prisma: PrismaClient,
    resourceId: string,
    from: Date,
    to: Date
): Promise<AppointmentOccupiedSlot[]> {
    return prisma.appointment.findMany({
        where: {
            resourceId,
            status: 'SCHEDULED',
            startAt: { lt: to },
            occupiedEndAt: { gt: from }
        },
        select: {
            id: true,
            resourceId: true,
            startAt: true,
            endAt: true,
            occupiedEndAt: true
        },
        orderBy: { startAt: 'asc' }
    })
}

/**
 * Check if a slot is available for a resource
 * Returns true if no overlapping SCHEDULED appointments exist
 * Note: RESCHEDULED appointments don't block slots
 */
export async function isSlotAvailable(
    prisma: PrismaClient,
    resourceId: string,
    startAt: Date,
    occupiedEndAt: Date
): Promise<boolean> {
    const overlapping = await prisma.appointment.findFirst({
        where: {
            resourceId,
            status: 'SCHEDULED',
            startAt: { lt: occupiedEndAt },
            occupiedEndAt: { gt: startAt }
        },
        select: { id: true }
    })
    return overlapping === null
}

/**
 * Create a new appointment
 * Handles DB constraint violation for double-booking
 */
export async function createAppointment(
    prisma: PrismaClient,
    input: CreateAppointmentInput
): Promise<AppointmentWithRelations> {
    try {
        return await prisma.appointment.create({
            data: {
                businessId: input.businessId,
                resourceId: input.resourceId,
                serviceId: input.serviceId,
                customerId: input.customerId,
                status: 'SCHEDULED',
                startAt: input.startAt,
                endAt: input.endAt,
                occupiedEndAt: input.occupiedEndAt,
                notes: input.notes || null,
                createdByUserId: input.createdByUserId || null
            },
            include: {
                service: {
                    select: { id: true, name: true }
                },
                resource: {
                    select: { id: true, name: true }
                },
                customer: {
                    select: { id: true, fullName: true, email: true, phone: true }
                },
                business: {
                    select: { id: true, name: true, timezone: true }
                }
            }
        })
    } catch (error) {
        // Handle EXCLUDE constraint violation (double-booking)
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2034: Transaction conflict / exclusion constraint violation
            // P2002: Unique constraint violation (fallback)
            if (error.code === 'P2034' || error.message.includes('Appointment_no_overlap')) {
                throw new AppError(
                    AppointmentErrorCodes.APPOINTMENT_SLOT_TAKEN,
                    'El horario seleccionado ya no está disponible',
                    409
                )
            }
        }
        // Check for raw exclusion constraint error
        if (error instanceof Error && error.message.includes('Appointment_no_overlap')) {
            throw new AppError(
                AppointmentErrorCodes.APPOINTMENT_SLOT_TAKEN,
                'El horario seleccionado ya no está disponible',
                409
            )
        }
        // Re-throw other errors
        console.error('Error creating appointment:', error)
        throw new AppError(SystemErrorCodes.DB_ERROR, 'Error al crear el turno', 500)
    }
}

/**
 * Get appointment by ID with relations
 */
export async function getAppointmentById(
    prisma: PrismaClient,
    businessId: string,
    appointmentId: string
): Promise<AppointmentWithRelations | null> {
    return prisma.appointment.findFirst({
        where: {
            id: appointmentId,
            businessId
        },
        include: {
            service: {
                select: { id: true, name: true }
            },
            resource: {
                select: { id: true, name: true }
            },
            customer: {
                select: { id: true, fullName: true, email: true, phone: true }
            },
            business: {
                select: { id: true, name: true, timezone: true }
            }
        }
    })
}

/**
 * Update appointment status with optional state verification (atomic)
 *
 * @param prisma - Prisma client
 * @param appointmentId - Appointment ID
 * @param status - New status
 * @param cancellationReason - Optional cancellation reason
 * @param expectedStatuses - If provided, only update if current status is one of these (race condition prevention)
 * @returns Updated appointment or null if expectedStatuses check failed
 */
export async function updateAppointmentStatus(
    prisma: PrismaClient,
    appointmentId: string,
    status: AppointmentStatus,
    cancellationReason?: string,
    expectedStatuses?: AppointmentStatus[]
): Promise<Appointment | null> {
    // Use updateMany for atomic state verification when expectedStatuses is provided
    if (expectedStatuses && expectedStatuses.length > 0) {
        const result = await prisma.appointment.updateMany({
            where: {
                id: appointmentId,
                status: { in: expectedStatuses }
            },
            data: {
                status,
                ...(cancellationReason !== undefined ? { cancellationReason } : {})
            }
        })

        // If no rows affected, the state check failed
        if (result.count === 0) {
            return null
        }

        // Fetch and return the updated appointment
        return prisma.appointment.findUnique({ where: { id: appointmentId } })
    }

    // Simple update without state verification (backwards compatible)
    return prisma.appointment.update({
        where: { id: appointmentId },
        data: {
            status,
            ...(cancellationReason !== undefined ? { cancellationReason } : {})
        }
    })
}

/**
 * Get appointments for a business on a specific day
 * Optionally filter by resourceId
 * Returns all statuses (SCHEDULED, CANCELLED, etc.) for admin visibility
 * Excludes appointments with soft-deleted resources or services
 *
 * @param prisma - Prisma client
 * @param businessId - Business ID (multi-tenant filter)
 * @param dayStart - Start of day in UTC
 * @param dayEnd - End of day in UTC (exclusive)
 * @param resourceId - Optional resource ID filter
 * @returns Appointments with relations
 */
export async function getAppointmentsByBusinessAndDay(
    prisma: PrismaClient,
    businessId: string,
    dayStart: Date,
    dayEnd: Date,
    resourceId?: string
): Promise<AppointmentWithRelations[]> {
    return prisma.appointment.findMany({
        where: {
            businessId,
            startAt: { gte: dayStart, lt: dayEnd },
            ...(resourceId ? { resourceId } : {}),
            // Exclude appointments with soft-deleted resources or services
            resource: {
                status: { not: 'DELETED' }
            },
            service: {
                status: { not: 'DELETED' }
            }
        },
        include: {
            service: {
                select: { id: true, name: true }
            },
            resource: {
                select: { id: true, name: true }
            },
            customer: {
                select: { id: true, fullName: true, email: true, phone: true }
            },
            business: {
                select: { id: true, name: true, timezone: true }
            }
        },
        orderBy: { startAt: 'asc' }
    })
}

// ============================================================================
// Reschedule Appointment (US-6.3)
// ============================================================================

/**
 * Appointment data with service/resource info for reschedule validation
 */
export interface AppointmentForReschedule {
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
 * Get appointment by ID with service/resource details for reschedule validation
 */
export async function getAppointmentForReschedule(
    prisma: PrismaClient,
    businessId: string,
    appointmentId: string
): Promise<AppointmentForReschedule | null> {
    const result = await prisma.appointment.findFirst({
        where: {
            id: appointmentId,
            businessId
        },
        select: {
            id: true,
            businessId: true,
            resourceId: true,
            serviceId: true,
            customerId: true,
            status: true,
            business: {
                select: {
                    timezone: true
                }
            },
            service: {
                select: {
                    id: true,
                    name: true,
                    durationMinutes: true,
                    slotIntervalMinutes: true,
                    status: true
                }
            },
            resource: {
                select: {
                    id: true,
                    name: true,
                    status: true
                }
            }
        }
    })

    if (!result) return null

    return {
        id: result.id,
        businessId: result.businessId,
        resourceId: result.resourceId,
        serviceId: result.serviceId,
        customerId: result.customerId,
        status: result.status as AppointmentStatus,
        businessTimezone: result.business.timezone,
        service: result.service,
        resource: result.resource
    }
}

/**
 * Input for creating a rescheduled appointment
 */
export interface CreateRescheduledAppointmentInput {
    originalAppointmentId: string
    businessId: string
    resourceId: string
    serviceId: string
    customerId: string
    startAt: Date
    endAt: Date
    occupiedEndAt: Date
}

/**
 * Result of creating a rescheduled appointment
 */
export interface RescheduleAppointmentResult {
    newAppointmentId: string
    originalAppointmentId: string
    newStartAt: Date
    newEndAt: Date
}

/**
 * Create a new appointment from rescheduling and mark original as RESCHEDULED
 *
 * This operation is atomic (transaction):
 * 1. Updates original appointment status to RESCHEDULED (frees the original slot)
 *    - Uses conditional update to prevent race conditions (only updates if status is SCHEDULED/RESCHEDULED)
 * 2. Creates new appointment with rescheduled_from_id pointing to original
 *
 * Note: The DB constraint for anti double-booking only applies to SCHEDULED appointments.
 * When an appointment is rescheduled, the original slot becomes FREE for new bookings
 * while preserving the audit trail via rescheduled_from_id.
 *
 * @throws AppError with APPOINTMENT_SLOT_TAKEN if new slot overlaps with another SCHEDULED appointment
 * @throws AppError with APPOINTMENT_INVALID_STATUS if original appointment status changed during operation
 */
export async function createRescheduledAppointment(
    prisma: PrismaClient,
    input: CreateRescheduledAppointmentInput
): Promise<RescheduleAppointmentResult> {
    try {
        return await prisma.$transaction(async tx => {
            // 1. Update original appointment status to RESCHEDULED with state verification
            // Only update if current status is SCHEDULED or RESCHEDULED (prevents race conditions)
            // This ensures we don't overwrite a concurrent cancellation or completion
            const updateResult = await tx.appointment.updateMany({
                where: {
                    id: input.originalAppointmentId,
                    status: { in: ['SCHEDULED', 'RESCHEDULED'] }
                },
                data: { status: 'RESCHEDULED' }
            })

            // If no rows updated, the appointment status changed concurrently
            if (updateResult.count === 0) {
                throw new AppError(
                    AppointmentErrorCodes.APPOINTMENT_INVALID_STATUS,
                    'El estado del turno cambió durante la operación. Por favor, recargue e intente nuevamente.',
                    409
                )
            }

            // 2. Create new appointment with reference to original
            const newAppointment = await tx.appointment.create({
                data: {
                    businessId: input.businessId,
                    resourceId: input.resourceId,
                    serviceId: input.serviceId,
                    customerId: input.customerId,
                    status: 'SCHEDULED',
                    startAt: input.startAt,
                    endAt: input.endAt,
                    occupiedEndAt: input.occupiedEndAt,
                    rescheduledFromId: input.originalAppointmentId
                }
            })

            return {
                newAppointmentId: newAppointment.id,
                originalAppointmentId: input.originalAppointmentId,
                newStartAt: newAppointment.startAt,
                newEndAt: newAppointment.endAt
            }
        })
    } catch (error) {
        // Handle EXCLUDE constraint violation (double-booking on new slot)
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2034' || error.message.includes('Appointment_no_overlap')) {
                throw new AppError(
                    AppointmentErrorCodes.APPOINTMENT_SLOT_TAKEN,
                    'El horario seleccionado ya no está disponible',
                    409
                )
            }
        }
        if (error instanceof Error && error.message.includes('Appointment_no_overlap')) {
            throw new AppError(
                AppointmentErrorCodes.APPOINTMENT_SLOT_TAKEN,
                'El horario seleccionado ya no está disponible',
                409
            )
        }
        // Re-throw AppErrors as-is
        if (error instanceof AppError) {
            throw error
        }
        // Log and wrap other errors
        console.error('Error rescheduling appointment:', error)
        throw new AppError(SystemErrorCodes.DB_ERROR, 'Error al reprogramar el turno', 500)
    }
}
