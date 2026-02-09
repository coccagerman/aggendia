import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { countFutureAppointments } from '@/data/repositories/business.repo'
import { AppError } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string }>
}

/**
 * GET /api/v1/businesses/:businessId/future-appointments-count
 * Devuelve la cantidad de turnos futuros activos (SCHEDULED | RESCHEDULED) del negocio.
 * Útil para pre-checks en la UI antes de eliminar.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { businessId } = await context.params
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        const count = await countFutureAppointments(prisma, businessId)

        return NextResponse.json({ data: { count } })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al contar turnos futuros:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error al contar los turnos futuros.'
                }
            },
            { status: 500 }
        )
    }
}
