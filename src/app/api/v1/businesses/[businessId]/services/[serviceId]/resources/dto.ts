import { z } from 'zod'

/**
 * Schema para PUT /api/v1/businesses/:businessId/services/:serviceId/resources
 * Reemplaza todos los recursos / prestadores asociados al servicio
 */
export const setServiceResourcesSchema = z.object({
    resourceIds: z
        .array(z.string().uuid('ID de recurso / prestador inválido'))
        .max(50, 'No se pueden asociar más de 50 recursos / prestadores a un servicio')
})

export type SetServiceResourcesRequest = z.infer<typeof setServiceResourcesSchema>

/**
 * Schema para POST /api/v1/businesses/:businessId/services/:serviceId/resources
 * Agrega un recurso / prestador al servicio
 */
export const addServiceResourceSchema = z.object({
    resourceId: z.string().uuid('ID de recurso / prestador inválido')
})

export type AddServiceResourceRequest = z.infer<typeof addServiceResourceSchema>
