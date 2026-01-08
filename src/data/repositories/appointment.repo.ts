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
 * Returns only active appointments (SCHEDULED, RESCHEDULED)
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
            status: { in: ['SCHEDULED', 'RESCHEDULED'] },
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
 * Returns true if no overlapping appointments exist
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
            status: { in: ['SCHEDULED', 'RESCHEDULED'] },
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
