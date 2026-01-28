/**
 * Domain service for manual booking (US-7.3)
 * Handles the creation of appointments by admin/staff from the dashboard agenda
 *
 * Key differences from public booking:
 * - Uses businessId directly (not slug)
 * - Does NOT enforce minimum booking notice
 * - Does NOT allow creating appointments in the past
 * - Tracks createdByUserId for audit
 */

import { PrismaClient } from '@prisma/client'
import { AppointmentOutput } from './appointment.types'
import {
    AppError,
    BusinessErrorCodes,
    ServiceErrorCodes,
    ResourceErrorCodes,
    AppointmentErrorCodes,
    ValidationErrorCodes,
    ServiceResourceErrorCodes
} from '@/domain/common/errors'
import { getBusinessById } from '@/data/repositories/business.repo'
import { getServiceById } from '@/data/repositories/service.repo'
import { getResourceById } from '@/data/repositories/resource.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { createAppointment, isSlotAvailable } from '@/data/repositories/appointment.repo'
import { getAvailabilityByResourceId } from '@/data/repositories/availability.repo'
import { isWithinAvailability } from '@/domain/availability/availability.service'
import { addMinutes } from 'date-fns'

/**
 * Input for creating a manual appointment (from dashboard)
 */
export interface CreateManualAppointmentInput {
    businessId: string
    serviceId: string
    resourceId: string
    startAt: string // ISO 8601 UTC string
    customer: {
        fullName: string
        email?: string
        phone?: string
    }
    notes?: string
    /** User ID of the admin/staff creating the appointment */
    createdByUserId: string
}

/**
 * Create a manual appointment (by admin/staff)
 * Validates all business rules except minimum booking notice
 */
export async function createManualAppointment(
    prisma: PrismaClient,
    input: CreateManualAppointmentInput
): Promise<AppointmentOutput> {
    // 1. Resolve business by ID
    const business = await getBusinessById(prisma, input.businessId)
    if (!business) {
        throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado', 404)
    }

    // 2. Validate service exists and is ACTIVE
    const service = await getServiceById(prisma, input.businessId, input.serviceId)
    if (!service || service.businessId !== input.businessId) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
    }
    if (service.status !== 'ACTIVE') {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no disponible', 404)
    }

    // 3. Validate resource exists and is ACTIVE
    const resource = await getResourceById(prisma, input.businessId, input.resourceId)
    if (!resource || resource.businessId !== input.businessId) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado', 404)
    }
    if (resource.status !== 'ACTIVE') {
        throw new AppError(ResourceErrorCodes.RESOURCE_INACTIVE, 'Recurso no disponible', 409)
    }

    // 4. Validate service-resource mapping exists
    const mapping = await prisma.serviceResource.findFirst({
        where: {
            businessId: input.businessId,
            serviceId: input.serviceId,
            resourceId: input.resourceId
        }
    })
    if (!mapping) {
        throw new AppError(
            ServiceResourceErrorCodes.SERVICE_RESOURCE_NOT_LINKED,
            'Este recurso no ofrece el servicio seleccionado',
            409
        )
    }

    // 5. Parse and validate startAt
    const startAt = new Date(input.startAt)
    if (isNaN(startAt.getTime())) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'Fecha de inicio inválida', 400)
    }

    // US-7.3: Validate startAt is NOT in the past (with 1 minute tolerance for clock drift)
    // Unlike public booking, we do NOT enforce minimum booking notice
    const now = new Date()
    if (startAt < new Date(now.getTime() - 60000)) {
        throw new AppError(AppointmentErrorCodes.APPOINTMENT_IN_PAST, 'No se pueden crear turnos en el pasado', 400)
    }

    // NOTE: We intentionally skip minimum booking notice validation (US-7.3 requirement)

    // 6. Calculate endAt and occupiedEndAt
    const endAt = addMinutes(startAt, service.durationMinutes)
    const occupiedEndAt = addMinutes(startAt, service.slotIntervalMinutes)

    // 7. Validate appointment falls within resource availability
    const availabilityRules = await getAvailabilityByResourceId(prisma, input.resourceId)
    if (!isWithinAvailability(availabilityRules, startAt, endAt, business.timezone)) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_OUTSIDE_AVAILABILITY,
            'El horario seleccionado está fuera del horario disponible',
            409
        )
    }

    // 8. Pre-check slot availability (defense in depth, DB constraint is source of truth)
    const available = await isSlotAvailable(prisma, input.resourceId, startAt, occupiedEndAt)
    if (!available) {
        throw new AppError(
            AppointmentErrorCodes.APPOINTMENT_SLOT_TAKEN,
            'El horario seleccionado ya no está disponible',
            409
        )
    }

    // 9. Upsert customer
    const customer = await upsertCustomer(prisma, input.businessId, {
        fullName: input.customer.fullName,
        email: input.customer.email || null,
        phone: input.customer.phone || null
    })

    // 10. Create appointment with createdByUserId (DB constraint handles race conditions)
    const appointment = await createAppointment(prisma, {
        businessId: input.businessId,
        resourceId: input.resourceId,
        serviceId: input.serviceId,
        customerId: customer.id,
        startAt,
        endAt,
        occupiedEndAt,
        notes: input.notes || null,
        createdByUserId: input.createdByUserId
    })

    // 11. Return formatted output
    return {
        appointmentId: appointment.id,
        status: appointment.status as 'SCHEDULED',
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        service: {
            id: appointment.service.id,
            name: appointment.service.name
        },
        resource: {
            id: appointment.resource.id,
            name: appointment.resource.name
        },
        business: {
            name: appointment.business.name,
            timezone: appointment.business.timezone
        },
        customer: {
            fullName: appointment.customer.fullName
        }
    }
}
