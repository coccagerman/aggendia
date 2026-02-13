/**
 * PATCH /api/v1/admin/trial-links/:id
 *
 * Update a trial link (toggle active, update max uses, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { getTrialLinkById, updateTrialLink } from '@/data/repositories/trial-link.repo'
import { updateTrialLinkRequestSchema } from '../dto'
import { AppError, ValidationErrorCodes, AuthErrorCodes } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

function isAdmin(email: string): boolean {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? []
    return adminEmails.includes(email.toLowerCase())
}

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        const { id } = await params
        const auth = await requireAuth()

        if (!isAdmin(auth.email)) {
            throw new AppError(AuthErrorCodes.FORBIDDEN, 'No tenés permisos de administrador.', 403)
        }

        const existing = await getTrialLinkById(prisma, id)
        if (!existing) {
            throw new AppError(SubscriptionErrorCodes.TRIAL_LINK_NOT_FOUND, 'Trial link no encontrado.', 404)
        }

        const body = await request.json()
        const parsed = updateTrialLinkRequestSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: 'Datos inválidos.',
                        details: parsed.error.flatten()
                    }
                },
                { status: 400 }
            )
        }

        const updated = await updateTrialLink(prisma, id, parsed.data)

        return NextResponse.json({
            data: {
                id: updated.id,
                code: updated.code,
                trialDays: updated.trialDays,
                maxUses: updated.maxUses,
                usedCount: updated.usedCount,
                expiresAt: updated.expiresAt,
                isActive: updated.isActive,
                createdAt: updated.createdAt
            }
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al actualizar trial link:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al actualizar el trial link.' } },
            { status: 500 }
        )
    }
}
