/**
 * Domain service for public booking (US-5.4)
 * Handles the creation of appointments from the public booking page
 */

import { PrismaClient } from '@prisma/client'
import { CreatePublicAppointmentInput, AppointmentOutput } from './appointment.types'
import {
    AppError,
    BusinessErrorCodes,
    ServiceErrorCodes,
    ResourceErrorCodes,
    AppointmentErrorCodes,
    ValidationErrorCodes
} from '@/domain/common/errors'
import { findActiveBusinessBySlug } from '@/data/repositories/business.repo'
import { getServiceById } from '@/data/repositories/service.repo'
import { getResourceById } from '@/data/repositories/resource.repo'
import { upsertCustomer } from '@/data/repositories/customer.repo'
import { createAppointment, isSlotAvailable } from '@/data/repositories/appointment.repo'
import { getAvailabilityByResourceId } from '@/data/repositories/availability.repo'
import { isWithinAvailability } from '@/domain/availability/availability.service'
import { sendConfirmationEmail, sendConfirmationWhatsApp } from '@/domain/notifications/notification.service'
import { buildAppointmentManageUrl } from '@/lib/notifications/manage-url'
import { addMinutes } from 'date-fns'

/**
 * Error codes specific to service-resource linking
 */
const SERVICE_RESOURCE_NOT_LINKED = 'SERVICE_RESOURCE_NOT_LINKED'

/**
 * Create a public appointment
 * Validates all business rules before creating the appointment
 */
export async function createPublicAppointment(
    prisma: PrismaClient,
    input: CreatePublicAppointmentInput
): Promise<AppointmentOutput> {
    // 1. Resolve business by slug
    const business = await findActiveBusinessBySlug(prisma, input.slug)
    if (!business) {
        throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado', 404)
    }

    // 2. Validate service exists and is ACTIVE
    const service = await getServiceById(prisma, business.id, input.serviceId)
    if (!service || service.businessId !== business.id) {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
    }
    if (service.status !== 'ACTIVE') {
        throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no disponible', 404)
    }

    // 3. Validate resource exists and is ACTIVE
    const resource = await getResourceById(prisma, business.id, input.resourceId)
    if (!resource || resource.businessId !== business.id) {
        throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado', 404)
    }
    if (resource.status !== 'ACTIVE') {
        throw new AppError(ResourceErrorCodes.RESOURCE_INACTIVE, 'Recurso no disponible', 409)
    }

    // 4. Validate service-resource mapping exists
    const mapping = await prisma.serviceResource.findFirst({
        where: {
            businessId: business.id,
            serviceId: input.serviceId,
            resourceId: input.resourceId
        }
    })
    if (!mapping) {
        throw new AppError(SERVICE_RESOURCE_NOT_LINKED, 'Este recurso no ofrece el servicio seleccionado', 409)
    }

    // 5. Parse and validate startAt
    const startAt = new Date(input.startAt)
    if (isNaN(startAt.getTime())) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'Fecha de inicio inválida', 400)
    }

    // Validate startAt is in the future (with 1 minute tolerance)
    const now = new Date()
    if (startAt < new Date(now.getTime() - 60000)) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'No se puede reservar en el pasado', 400)
    }

    // US-7.1: Validate minimum booking notice
    // Reject if startAt is strictly before the earliest bookable time
    // Notice is now configured per-service, not per-business
    const minNoticeMinutes = service.minBookingNoticeMinutes ?? 0
    if (minNoticeMinutes > 0) {
        const earliestBookableTime = addMinutes(now, minNoticeMinutes)
        if (startAt < earliestBookableTime) {
            const hoursNotice = Math.floor(minNoticeMinutes / 60)
            const minutesNotice = minNoticeMinutes % 60
            const noticeText =
                hoursNotice > 0
                    ? minutesNotice > 0
                        ? `${hoursNotice}h ${minutesNotice}min`
                        : `${hoursNotice} hora${hoursNotice > 1 ? 's' : ''}`
                    : `${minutesNotice} minutos`
            throw new AppError(
                AppointmentErrorCodes.APPOINTMENT_TOO_SOON,
                `Debe reservar con al menos ${noticeText} de anticipación`,
                400
            )
        }
    }

    // 6. Calculate endAt and occupiedEndAt
    // endAt = startAt + duration (when the appointment actually ends)
    // occupiedEndAt = startAt + slotInterval (the time block occupied for scheduling)
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
    const customer = await upsertCustomer(prisma, business.id, {
        fullName: input.customer.fullName,
        email: input.customer.email || null,
        phone: input.customer.phone || null
    })

    // 10. Create appointment (DB constraint handles race conditions)
    const appointment = await createAppointment(prisma, {
        businessId: business.id,
        resourceId: input.resourceId,
        serviceId: input.serviceId,
        customerId: customer.id,
        startAt,
        endAt,
        occupiedEndAt,
        notes: input.notes || null
    })

    // 11. Send confirmation email (non-blocking, errors are logged not thrown)
    // US-8.1: Email is sent after appointment is successfully created
    const manageUrl = buildAppointmentManageUrl(business.slug, appointment.id, appointment.secretToken)

    sendConfirmationEmail(prisma, {
        appointmentId: appointment.id,
        business: {
            id: business.id,
            name: business.name,
            timezone: business.timezone,
            resourceLabel: business.resourceLabel,
            address: business.address,
            emailNotificationsEnabled: business.emailNotificationsEnabled
        },
        service: {
            id: appointment.service.id,
            name: appointment.service.name
        },
        resource: {
            id: appointment.resource.id,
            name: appointment.resource.name
        },
        customer: {
            fullName: appointment.customer.fullName,
            email: appointment.customer.email,
            phone: appointment.customer.phone
        },
        startAt: appointment.startAt,
        manageUrl
    }).catch(err => {
        // Extra safety: ensure any unexpected error doesn't bubble up
        console.error('[PublicBooking] Unexpected error in sendConfirmationEmail:', err)
    })

    // 12. Send confirmation WhatsApp (non-blocking, parallel to email)
    // US-10.2: WhatsApp is sent after appointment is successfully created
    sendConfirmationWhatsApp(prisma, {
        appointmentId: appointment.id,
        business: {
            id: business.id,
            name: business.name,
            timezone: business.timezone,
            resourceLabel: business.resourceLabel,
            whatsappNotificationsEnabled: business.whatsappNotificationsEnabled
        },
        service: {
            id: appointment.service.id,
            name: appointment.service.name
        },
        resource: {
            id: appointment.resource.id,
            name: appointment.resource.name
        },
        customer: {
            fullName: appointment.customer.fullName,
            phoneE164: appointment.customer.phoneE164
        },
        startAt: appointment.startAt,
        manageUrl
    }).catch(err => {
        // Extra safety: ensure any unexpected error doesn't bubble up
        console.error('[PublicBooking] Unexpected error in sendConfirmationWhatsApp:', err)
    })

    // 13. Return formatted output
    return {
        appointmentId: appointment.id,
        status: appointment.status as 'SCHEDULED',
        startAt: appointment.startAt.toISOString(),
        endAt: appointment.endAt.toISOString(),
        secretToken: appointment.secretToken,
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
            slug: appointment.business.slug,
            timezone: appointment.business.timezone
        },
        customer: {
            fullName: appointment.customer.fullName
        }
    }
}
