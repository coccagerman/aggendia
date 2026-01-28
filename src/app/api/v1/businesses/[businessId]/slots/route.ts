/**
 * GET /api/v1/businesses/:businessId/slots
 * Returns available booking slots for a service + resource combination (private endpoint)
 *
 * This is similar to the public slots endpoint but:
 * - Requires authentication
 * - Does NOT apply minimum booking notice (for manual appointment creation)
 *
 * @see docs/user-stories.md - US-7.3 Crear turnos manualmente desde la agenda
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/data/prisma/prisma'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import {
    AppError,
    BusinessErrorCodes,
    ValidationErrorCodes,
    ResourceErrorCodes,
    ServiceErrorCodes,
    ServiceResourceErrorCodes
} from '@/domain/common/errors'
import { getResourceById } from '@/data/repositories/resource.repo'
import { getServiceById } from '@/data/repositories/service.repo'
import { getAvailabilityByResourceId } from '@/data/repositories/availability.repo'
import { getBlocksByResourceId } from '@/data/repositories/block.repo'
import { getAppointmentsByResourceAndRange } from '@/data/repositories/appointment.repo'
import { calculateSlots } from '@/domain/slots/slots.service'
import { MAX_DAYS_AHEAD } from '@/domain/slots/slots.types'
import { addDays, startOfDay } from 'date-fns'

// Query params validation schema
const slotsQuerySchema = z.object({
    serviceId: z.string().uuid('serviceId debe ser un UUID válido'),
    resourceId: z.string().uuid('resourceId debe ser un UUID válido'),
    fromDate: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'fromDate debe ser una fecha válida ISO 8601'
    }),
    toDate: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: 'toDate debe ser una fecha válida ISO 8601'
    })
})

// Response schema
const slotSchema = z.object({
    startAt: z.string(),
    endAt: z.string(),
    displayTime: z.string()
})

const slotsResponseSchema = z.object({
    data: z.array(slotSchema)
})

type RouteContext = {
    params: Promise<{ businessId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params

        // 1. Auth: verify user is authenticated
        const { userId } = await requireAuth()

        // 2. Verify user has access to the business
        await requireBusinessAccess(userId, businessId)

        // 3. Parse query params
        const { searchParams } = new URL(request.url)
        const queryParams = {
            serviceId: searchParams.get('serviceId'),
            resourceId: searchParams.get('resourceId'),
            fromDate: searchParams.get('fromDate'),
            toDate: searchParams.get('toDate')
        }

        const validatedQuery = slotsQuerySchema.parse(queryParams)

        // 4. Parse dates
        const fromDate = new Date(validatedQuery.fromDate)
        const toDate = new Date(validatedQuery.toDate)

        // 5. Validate date range
        if (fromDate >= toDate) {
            throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'fromDate debe ser menor que toDate', 400)
        }

        // For private endpoint, we allow unlimited future range (user requested)
        // But we still enforce MAX_DAYS_AHEAD per request to avoid performance issues
        const maxToDate = addDays(startOfDay(fromDate), MAX_DAYS_AHEAD)
        if (toDate > maxToDate) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                `El rango máximo por consulta es de ${MAX_DAYS_AHEAD} días`,
                400,
                { maxToDate: maxToDate.toISOString() }
            )
        }

        // 6. Get service (validate businessId + active)
        const service = await getServiceById(prisma, businessId, validatedQuery.serviceId)
        if (!service || service.businessId !== businessId) {
            throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
        }
        if (service.status !== 'ACTIVE') {
            throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no disponible', 404)
        }

        // 7. Get resource (validate businessId + active)
        const resource = await getResourceById(prisma, businessId, validatedQuery.resourceId)
        if (!resource || resource.businessId !== businessId) {
            throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado', 404)
        }
        if (resource.status !== 'ACTIVE') {
            throw new AppError(ResourceErrorCodes.RESOURCE_INACTIVE, 'Recurso no disponible', 409)
        }

        // 8. Validate service-resource mapping
        const mapping = await prisma.serviceResource.findFirst({
            where: {
                businessId,
                serviceId: validatedQuery.serviceId,
                resourceId: validatedQuery.resourceId
            }
        })
        if (!mapping) {
            throw new AppError(
                ServiceResourceErrorCodes.SERVICE_RESOURCE_NOT_LINKED,
                'Este recurso no ofrece el servicio seleccionado',
                409
            )
        }

        // 9. Get availability rules for resource
        const availabilityRules = await getAvailabilityByResourceId(prisma, validatedQuery.resourceId)

        // 10. Get blocks for resource in date range
        const blocks = await getBlocksByResourceId(prisma, {
            resourceId: validatedQuery.resourceId,
            from: fromDate,
            to: toDate
        })

        // 11. Get appointments for resource in date range
        const appointments = await getAppointmentsByResourceAndRange(
            prisma,
            validatedQuery.resourceId,
            fromDate,
            toDate
        )

        // 12. Get business for timezone
        const business = await prisma.business.findUnique({
            where: { id: businessId },
            select: { timezone: true }
        })

        if (!business) {
            throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado', 404)
        }

        // 13. Calculate slots - WITHOUT minimum booking notice (key difference from public endpoint)
        const slots = calculateSlots({
            businessTimezone: business.timezone,
            fromDate,
            toDate,
            durationMinutes: service.durationMinutes,
            slotIntervalMinutes: service.slotIntervalMinutes,
            availabilityRules: availabilityRules.map(rule => ({
                id: rule.id,
                resourceId: rule.resourceId,
                dayOfWeek: rule.dayOfWeek,
                startMinutes: rule.startMinutes,
                endMinutes: rule.endMinutes
            })),
            blocks: blocks.map(block => ({
                startAt: block.startAt,
                endAt: block.endAt
            })),
            appointments: appointments.map(appt => ({
                startAt: appt.startAt,
                occupiedEndAt: appt.occupiedEndAt
            })),
            // Key difference: do NOT apply minimum booking notice
            minBookingNoticeMinutes: 0
        })

        // 14. Validate response schema
        const response = slotsResponseSchema.parse({ data: slots })

        return NextResponse.json(response, { status: 200 })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Parámetros inválidos',
                        details: error.issues
                    }
                },
                { status: 400 }
            )
        }

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error in GET /api/v1/businesses/:businessId/slots:', error)
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error interno del servidor'
                }
            },
            { status: 500 }
        )
    }
}
