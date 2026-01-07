/**
 * DTOs for public service resources endpoint
 */

import { z } from 'zod'

/**
 * Response schema for GET /api/v1/public/businesses/:slug/services/:serviceId/resources
 */
export const publicServiceResourcesResponseSchema = z.object({
    data: z.object({
        service: z.object({
            id: z.string().uuid(),
            name: z.string()
        }),
        resources: z.array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                type: z.enum(['PERSON', 'ASSET']).nullable()
            })
        )
    }),
    meta: z.object({
        resourceLabel: z.string(),
        count: z.number().int().nonnegative()
    })
})

export type PublicServiceResourcesResponse = z.infer<typeof publicServiceResourcesResponseSchema>
