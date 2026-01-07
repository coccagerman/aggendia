/**
 * Public API endpoint for getting resources assigned to a service
 * GET /api/v1/public/businesses/:slug/services/:serviceId/resources
 *
 * No authentication required - public endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { getPublicServiceResources } from '@/domain/serviceResources/serviceResources.service'
import { AppError } from '@/domain/common/errors'
import { publicServiceResourcesResponseSchema, type PublicServiceResourcesResponse } from './dto'

type RouteContext = {
    params: Promise<{ slug: string; serviceId: string }>
}

/**
 * GET /api/v1/public/businesses/:slug/services/:serviceId/resources
 * Returns ACTIVE resources assigned to a service (for public booking flow)
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { slug, serviceId } = await context.params

        // Delegate to domain service
        const result = await getPublicServiceResources(prisma, slug, serviceId)

        // Build response DTO
        const response: PublicServiceResourcesResponse = {
            data: {
                service: result.service,
                resources: result.resources
            },
            meta: {
                resourceLabel: result.resourceLabel,
                count: result.resources.length
            }
        }

        // Validate response schema (ensures consistency)
        const validatedResponse = publicServiceResourcesResponseSchema.parse(response)

        return NextResponse.json(validatedResponse, {
            status: 200,
            headers: {
                'Cache-Control': 'public, max-age=60' // Cache 1 minute
            }
        })
    } catch (error) {
        console.error('Error in public service resources endpoint:', error)

        if (error instanceof AppError) {
            return NextResponse.json(
                {
                    error: {
                        code: error.code,
                        message: error.message,
                        details: error.details
                    }
                },
                { status: error.httpStatus }
            )
        }

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
