import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { removeResourceFromService } from '@/data/repositories/serviceResource.repo'
import { AppError } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; serviceId: string; resourceId: string }>
}

/**
 * DELETE /api/v1/businesses/:businessId/services/:serviceId/resources/:resourceId
 * Elimina la asociación de un recurso con el servicio
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let serviceId: string | undefined
    let resourceId: string | undefined
    try {
        ;({ businessId, serviceId, resourceId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Eliminar asociación
        await removeResourceFromService(prisma, businessId, serviceId, resourceId)

        return new NextResponse(null, { status: 204 })
    } catch (error) {
        console.error(
            `Error al eliminar recurso del servicio [businessId=${businessId}, serviceId=${serviceId}, resourceId=${resourceId}]:`,
            error instanceof Error ? error.message : 'UNKNOWN'
        )

        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Error al eliminar recurso del servicio.'
                }
            },
            { status: 500 }
        )
    }
}
