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
        phoneE164: string | null
    }
    business: {
        id: string
        name: string
        slug: string
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
                    select: { id: true, fullName: true, email: true, phone: true, phoneE164: true }
                },
                business: {
                    select: { id: true, name: true, slug: true, timezone: true }
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
                select: { id: true, fullName: true, email: true, phone: true, phoneE164: true }
            },
            business: {
                select: { id: true, name: true, slug: true, timezone: true }
            }
        }
    })
}

/**
 * Public appointment data with business settings for notification management URL
 */
export interface PublicAppointmentWithRelations extends Appointment {
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
    customer: {
        id: string
        fullName: string
        email: string | null
        phone: string | null
        phoneE164: string | null
    }
    business: {
        id: string
        name: string
        slug: string
        timezone: string
        resourceLabel: string
        address: string | null
        emailNotificationsEnabled: boolean
        whatsappNotificationsEnabled: boolean
        ownerEmail: string | null
        ownerPhoneE164: string | null
        ownerEmailNotificationsEnabled: boolean
        ownerWhatsappNotificationsEnabled: boolean
    }
}

/**
 * Get appointment by ID and secretToken (public access — no auth required)
 * Used for customer self-service (cancel/reschedule via capability URL)
 * Returns null if appointment not found or token doesn't match (prevents enumeration)
 */
export async function getAppointmentByIdAndToken(
    prisma: PrismaClient,
    appointmentId: string,
    secretToken: string
): Promise<PublicAppointmentWithRelations | null> {
    return prisma.appointment.findFirst({
        where: {
            id: appointmentId,
            secretToken
        },
        include: {
            service: {
                select: { id: true, name: true, durationMinutes: true, slotIntervalMinutes: true, status: true }
            },
            resource: {
                select: { id: true, name: true, status: true }
            },
            customer: {
                select: { id: true, fullName: true, email: true, phone: true, phoneE164: true }
            },
            business: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    timezone: true,
                    resourceLabel: true,
                    address: true,
                    emailNotificationsEnabled: true,
                    whatsappNotificationsEnabled: true,
                    ownerEmail: true,
                    ownerPhoneE164: true,
                    ownerEmailNotificationsEnabled: true,
                    ownerWhatsappNotificationsEnabled: true
                }
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
 * Get appointments for a business on a specific day/range
 * Optionally filter by resourceId
 * Returns all statuses (SCHEDULED, CANCELLED, etc.) for admin visibility
 * Note: Appointments are shown even if their resource/service has been soft-deleted
 *       because appointments represent historical data that should be preserved.
 *
 * @param prisma - Prisma client
 * @param businessId - Business ID (multi-tenant filter)
 * @param dayStart - Start of range in UTC
 * @param dayEnd - End of range in UTC (exclusive)
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
            ...(resourceId ? { resourceId } : {})
        },
        include: {
            service: {
                select: { id: true, name: true }
            },
            resource: {
                select: { id: true, name: true }
            },
            customer: {
                select: { id: true, fullName: true, email: true, phone: true, phoneE164: true }
            },
            business: {
                select: { id: true, name: true, slug: true, timezone: true }
            }
        },
        orderBy: { startAt: 'asc' }
    })
}

/**
 * Alias for getAppointmentsByBusinessAndDay for semantic clarity when querying ranges.
 * Use this when querying week or month ranges.
 */
export const getAppointmentsByBusinessAndRange = getAppointmentsByBusinessAndDay

/**
 * Count appointments per day for a business within a date range.
 * Uses SQL aggregation with timezone conversion for optimal performance.
 *
 * @param prisma - Prisma client
 * @param businessId - Business ID (multi-tenant filter)
 * @param rangeStart - Start of range in UTC
 * @param rangeEnd - End of range in UTC (exclusive)
 * @param resourceId - Optional resource ID filter
 * @param timezone - Business timezone for grouping by local date
 * @returns Record of date strings (YYYY-MM-DD) to appointment counts
 */
export async function getAppointmentCountsByDay(
    prisma: PrismaClient,
    businessId: string,
    rangeStart: Date,
    rangeEnd: Date,
    resourceId?: string,
    timezone: string = 'UTC'
): Promise<Record<string, number>> {
    // Use raw SQL for GROUP BY with timezone conversion (PostgreSQL)
    // GROUP BY 1 means "group by first column in SELECT"
    const results = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT 
            TO_CHAR("startAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') as date,
            COUNT(*) as count
        FROM "Appointment"
        WHERE "businessId" = ${businessId}
          AND "startAt" >= ${rangeStart}
          AND "startAt" < ${rangeEnd}
          ${resourceId ? Prisma.sql`AND "resourceId" = ${resourceId}` : Prisma.empty}
        GROUP BY 1
    `

    const countsByDay: Record<string, number> = {}
    for (const row of results) {
        countsByDay[row.date] = Number(row.count)
    }

    return countsByDay
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
    newSecretToken: string
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
                newEndAt: newAppointment.endAt,
                newSecretToken: newAppointment.secretToken
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

/**
 * Count future SCHEDULED appointments for a service
 * Used for soft-delete validation (US-7.2)
 * @param prisma - Prisma client
 * @param serviceId - Service ID
 * @returns Number of future appointments
 */
export async function countFutureAppointmentsByServiceId(prisma: PrismaClient, serviceId: string): Promise<number> {
    return prisma.appointment.count({
        where: {
            serviceId,
            status: 'SCHEDULED',
            startAt: { gte: new Date() }
        }
    })
}

/**
 * Count future SCHEDULED appointments for a resource
 * Used for soft-delete validation (US-2.3)
 * @param prisma - Prisma client
 * @param resourceId - Resource ID
 * @returns Number of future appointments
 */
export async function countFutureAppointmentsByResourceId(prisma: PrismaClient, resourceId: string): Promise<number> {
    return prisma.appointment.count({
        where: {
            resourceId,
            status: 'SCHEDULED',
            startAt: { gte: new Date() }
        }
    })
}

// ============================================================================
// Reminder-related queries (US-8.3)
// ============================================================================

/**
 * Eligible appointment for reminders
 * Contains all data needed to send a reminder email
 */
export interface EligibleAppointment {
    id: string
    secretToken: string
    status: AppointmentStatus
    startAt: Date
    business: {
        id: string
        name: string
        slug: string
        timezone: string
        resourceLabel: string
        address: string | null
        remindersEnabled: boolean
        reminderOffsetsMinutes: number[]
        emailNotificationsEnabled: boolean
        whatsappNotificationsEnabled: boolean
        ownerEmail: string | null
        ownerPhoneE164: string | null
        ownerEmailNotificationsEnabled: boolean
        ownerWhatsappNotificationsEnabled: boolean
        ownerRemindersEnabled: boolean
        ownerReminderOffsetsMinutes: number[]
    }
    service: {
        id: string
        name: string
    }
    resource: {
        id: string
        name: string
    }
    customer: {
        fullName: string
        email: string | null
        phoneE164: string | null
    }
}

/**
 * Options for finding eligible appointments for reminders
 */
export interface FindEligibleAppointmentsOptions {
    /** Offset in minutes (1440 = 24h, 120 = 2h) */
    offsetMinutes: number
    /** Start of query window (UTC) */
    windowStart: Date
    /** End of query window (UTC) */
    windowEnd: Date
    /** Filter by business ID (optional) */
    businessId?: string
    /** Filter by business IDs (optional) */
    businessIds?: string[]
}

/**
 * Find appointments eligible for reminders
 *
 * This query finds appointments that:
 * 1. Have status SCHEDULED
 * 2. Belong to businesses with remindersEnabled = true
 * 3. Have the specified offset in their business's reminderOffsetsMinutes
 * 4. Have startAt within the provided query window
 *
 * The query is designed to be timezone-aware by working with UTC times.
 * The actual timezone conversion happens in the domain layer using Luxon.
 *
 * @param prisma - Prisma client
 * @param options - Query options
 * @returns Array of eligible appointments with all related data
 */
export async function findEligibleAppointmentsForReminders(
    prisma: PrismaClient,
    options: FindEligibleAppointmentsOptions
): Promise<EligibleAppointment[]> {
    const { offsetMinutes, windowStart, windowEnd, businessId, businessIds } = options
    const businessIdsFilter = businessId ? undefined : businessIds

    const appointments = await prisma.appointment.findMany({
        where: {
            status: 'SCHEDULED',
            startAt: {
                gte: windowStart,
                lte: windowEnd
            },
            business: {
                OR: [
                    {
                        remindersEnabled: true,
                        reminderOffsetsMinutes: { has: offsetMinutes }
                    },
                    {
                        ownerRemindersEnabled: true,
                        ownerReminderOffsetsMinutes: { has: offsetMinutes }
                    }
                ],
                ...(businessId ? { id: businessId } : {}),
                ...(businessIdsFilter && businessIdsFilter.length > 0 ? { id: { in: businessIdsFilter } } : {})
            }
        },
        include: {
            business: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    timezone: true,
                    resourceLabel: true,
                    address: true,
                    remindersEnabled: true,
                    reminderOffsetsMinutes: true,
                    emailNotificationsEnabled: true,
                    whatsappNotificationsEnabled: true,
                    ownerEmail: true,
                    ownerPhoneE164: true,
                    ownerEmailNotificationsEnabled: true,
                    ownerWhatsappNotificationsEnabled: true,
                    ownerRemindersEnabled: true,
                    ownerReminderOffsetsMinutes: true
                }
            },
            service: {
                select: {
                    id: true,
                    name: true
                }
            },
            resource: {
                select: {
                    id: true,
                    name: true
                }
            },
            customer: {
                select: {
                    fullName: true,
                    email: true,
                    phoneE164: true
                }
            }
        },
        orderBy: { startAt: 'asc' }
    })

    return appointments.map(apt => ({
        id: apt.id,
        secretToken: apt.secretToken,
        status: apt.status,
        startAt: apt.startAt,
        business: apt.business,
        service: apt.service,
        resource: apt.resource,
        customer: apt.customer
    }))
}
