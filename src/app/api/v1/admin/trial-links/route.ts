/**
 * Admin API for trial links management.
 *
 * GET  /api/v1/admin/trial-links — List all trial links with usage count
 * POST /api/v1/admin/trial-links — Create a new trial link
 *
 * Security: Only authenticated users with admin privileges.
 * For MVP, we use a simple ADMIN_EMAILS env var check.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/data/prisma/prisma'
import { listTrialLinks, createTrialLink } from '@/data/repositories/trial-link.repo'
import { createTrialLinkRequestSchema } from './dto'
import { AppError, ValidationErrorCodes, AuthErrorCodes } from '@/domain/common/errors'

/**
 * Check if the current user is an admin.
 * For MVP: check against ADMIN_EMAILS env var (comma-separated).
 */
function isAdmin(email: string): boolean {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? []
    return adminEmails.includes(email.toLowerCase())
}

async function requireAdmin(): Promise<{ userId: string; email: string }> {
    const auth = await requireAuth()
    if (!isAdmin(auth.email)) {
        throw new AppError(AuthErrorCodes.FORBIDDEN, 'No tenés permisos de administrador.', 403)
    }
    return auth
}

export async function GET() {
    try {
        await requireAdmin()
        const links = await listTrialLinks(prisma)

        return NextResponse.json({
            data: links.map(link => ({
                id: link.id,
                code: link.code,
                trialDays: link.trialDays,
                maxUses: link.maxUses,
                usedCount: link.usedCount,
                usageCount: link._count.usages,
                expiresAt: link.expiresAt,
                isActive: link.isActive,
                metadata: link.metadata,
                createdBy: link.createdBy,
                createdAt: link.createdAt
            }))
        })
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al listar trial links:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al listar los trial links.' } },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await requireAdmin()

        const body = await request.json()
        const parsed = createTrialLinkRequestSchema.safeParse(body)
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

        const link = await createTrialLink(prisma, {
            ...parsed.data,
            createdBy: userId
        })

        return NextResponse.json(
            {
                data: {
                    id: link.id,
                    code: link.code,
                    trialDays: link.trialDays,
                    maxUses: link.maxUses,
                    usedCount: link.usedCount,
                    expiresAt: link.expiresAt,
                    isActive: link.isActive,
                    createdAt: link.createdAt
                }
            },
            { status: 201 }
        )
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.httpStatus })
        }

        console.error('Error al crear trial link:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al crear el trial link.' } },
            { status: 500 }
        )
    }
}
