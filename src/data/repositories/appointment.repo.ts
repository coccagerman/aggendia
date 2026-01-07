/**
 * Repository for appointments table
 *
 * ⚠️  CRITICAL STUB - US-5.4 REQUIRED
 * This returns an empty array because the appointments table doesn't exist yet.
 * Once US-5.4 (Confirmar reserva) is implemented, this MUST be replaced with
 * actual queries to prevent double-booking.
 *
 * @see docs/user-stories.md - US-5.4
 */

import { PrismaClient } from '@prisma/client'

export interface AppointmentOccupiedSlot {
    id: string
    resourceId: string
    startAt: Date
    endAt: Date
    occupiedEndAt: Date
}

/**
 * Get appointments for a resource within a date range
 *
 * ⚠️  STUB: Returns empty array - appointments table not implemented yet.
 * This MUST be implemented in US-5.4 to query real appointments and prevent double-booking.
 */
export async function getAppointmentsByResourceAndRange(
    _prisma: PrismaClient,
    _resourceId: string,
    _from: Date,
    _to: Date
): Promise<AppointmentOccupiedSlot[]> {
    // TODO(US-5.4): CRITICAL - Replace stub with actual Prisma query once appointments table exists
    // return prisma.appointment.findMany({
    //     where: {
    //         resourceId,
    //         status: { in: ['SCHEDULED', 'RESCHEDULED'] },
    //         startAt: { lt: to },
    //         occupiedEndAt: { gt: from }
    //     },
    //     select: {
    //         id: true,
    //         resourceId: true,
    //         startAt: true,
    //         endAt: true,
    //         occupiedEndAt: true
    //     },
    //     orderBy: { startAt: 'asc' }
    // })

    return []
}
