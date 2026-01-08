/**
 * GET /api/v1/public/slots
 * Returns available booking slots for a service + resource combination
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/data/prisma/prisma'
import {
    AppError,
    ValidationErrorCodes,
    BusinessErrorCodes,
    ResourceErrorCodes,
    ServiceErrorCodes
} from '@/domain/common/errors'
import { findBusinessBySlug } from '@/data/repositories/business.repo'
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
    slug: z.string().min(1, 'slug es requerido'),
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

export async function GET(request: NextRequest) {
    try {
        // Parse query params
        const { searchParams } = new URL(request.url)
        const queryParams = {
            slug: searchParams.get('slug'),
            serviceId: searchParams.get('serviceId'),
            resourceId: searchParams.get('resourceId'),
            fromDate: searchParams.get('fromDate'),
            toDate: searchParams.get('toDate')
        }

        const validatedQuery = slotsQuerySchema.parse(queryParams)

        // Parse dates
        const fromDate = new Date(validatedQuery.fromDate)
        const toDate = new Date(validatedQuery.toDate)

        // Validate date range
        if (fromDate >= toDate) {
            throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'fromDate debe ser menor que toDate', 400)
        }

        // Validate max range (30 days)
        const maxToDate = addDays(startOfDay(fromDate), MAX_DAYS_AHEAD)
        if (toDate > maxToDate) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                `El rango máximo es de ${MAX_DAYS_AHEAD} días`,
                400,
                { maxToDate: maxToDate.toISOString() }
            )
        }

        // 1. Get business by slug
        const business = await findBusinessBySlug(prisma, validatedQuery.slug)
        if (!business) {
            throw new AppError(BusinessErrorCodes.BUSINESS_NOT_FOUND, 'Negocio no encontrado', 404)
        }

        // 2. Get service (validate businessId + active)
        const service = await getServiceById(prisma, business.id, validatedQuery.serviceId)
        if (!service || service.businessId !== business.id) {
            throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no encontrado', 404)
        }
        if (service.status !== 'ACTIVE') {
            throw new AppError(ServiceErrorCodes.SERVICE_NOT_FOUND, 'Servicio no disponible', 404)
        }

        // 3. Get resource (validate businessId + active)
        const resource = await getResourceById(prisma, business.id, validatedQuery.resourceId)
        if (!resource || resource.businessId !== business.id) {
            throw new AppError(ResourceErrorCodes.RESOURCE_NOT_FOUND, 'Recurso no encontrado', 404)
        }
        if (resource.status !== 'ACTIVE') {
            throw new AppError(ResourceErrorCodes.RESOURCE_INACTIVE, 'Recurso no disponible', 409)
        }

        // 4. Validate service-resource mapping
        const mapping = await prisma.serviceResource.findFirst({
            where: {
                businessId: business.id,
                serviceId: validatedQuery.serviceId,
                resourceId: validatedQuery.resourceId
            }
        })
        if (!mapping) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                'Este recurso no ofrece el servicio seleccionado',
                409
            )
        }

        // 5. Get availability rules for resource
        const availabilityRules = await getAvailabilityByResourceId(prisma, validatedQuery.resourceId)

        // 6. Get blocks for resource in date range
        const blocks = await getBlocksByResourceId(prisma, {
            resourceId: validatedQuery.resourceId,
            from: fromDate,
            to: toDate
        })

        // 7. Get appointments for resource in date range (stub returns [])
        const appointments = await getAppointmentsByResourceAndRange(
            prisma,
            validatedQuery.resourceId,
            fromDate,
            toDate
        )

        // 8. Calculate slots using domain service
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
            }))
        })

        // Validate response schema
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

        console.error('Error in GET /api/v1/public/slots:', error)
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
