import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { requireBusinessAccess } from '@/lib/auth/require-business-access'
import { prisma } from '@/data/prisma/prisma'
import { getBlockWithResource, deleteBlock } from '@/data/repositories/block.repo'
import { AppError, BlockErrorCodes, SystemErrorCodes } from '@/domain/common/errors'

type RouteContext = {
    params: Promise<{ businessId: string; resourceId: string; blockId: string }>
}

/**
 * DELETE /api/v1/businesses/:businessId/resources/:resourceId/blocks/:blockId
 * Elimina un bloqueo existente.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
    let businessId: string | undefined
    let resourceId: string | undefined
    let blockId: string | undefined
    try {
        ;({ businessId, resourceId, blockId } = await context.params)

        // Auth: verificar usuario autenticado y acceso al negocio
        const { userId } = await requireAuth()
        await requireBusinessAccess(userId, businessId)

        // Verificar que el bloqueo existe y pertenece al recurso/negocio
        const block = await getBlockWithResource(prisma, blockId)
        if (!block) {
            return NextResponse.json(
                {
                    error: {
                        code: BlockErrorCodes.BLOCK_NOT_FOUND,
                        message: 'Bloqueo no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        // Verificar que el bloqueo pertenece al recurso indicado
        if (block.resourceId !== resourceId) {
            return NextResponse.json(
                {
                    error: {
                        code: BlockErrorCodes.BLOCK_NOT_FOUND,
                        message: 'Bloqueo no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        // Verificar que el recurso pertenece al negocio indicado
        if (block.resource.businessId !== businessId) {
            return NextResponse.json(
                {
                    error: {
                        code: BlockErrorCodes.BLOCK_NOT_FOUND,
                        message: 'Bloqueo no encontrado.'
                    }
                },
                { status: 404 }
            )
        }

        // Eliminar bloqueo
        await deleteBlock(prisma, blockId)

        return NextResponse.json({ data: { success: true } })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al eliminar bloqueo:', {
            businessId,
            resourceId,
            blockId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })
        return NextResponse.json(
            {
                error: {
                    code: SystemErrorCodes.INTERNAL_ERROR,
                    message: 'Ocurrió un error al eliminar el bloqueo.'
                }
            },
            { status: 500 }
        )
    }
}
