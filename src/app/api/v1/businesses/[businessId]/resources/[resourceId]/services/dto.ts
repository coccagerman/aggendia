import { z } from 'zod'

/**
 * Schema para PUT /api/v1/businesses/:businessId/resources/:resourceId/services
 * Reemplaza todos los servicios asociados al recurso
 */
export const setResourceServicesSchema = z.object({
    serviceIds: z
        .array(z.string().uuid('ID de servicio inválido'))
        .max(50, 'No se pueden asociar más de 50 servicios a un recurso')
})

export type SetResourceServicesRequest = z.infer<typeof setResourceServicesSchema>
