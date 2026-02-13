/**
 * GET /api/v1/subscription-plans
 *
 * Returns all active subscription plans.
 * Public endpoint — used by pricing page and subscription settings.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { getActivePlans } from '@/data/repositories/subscription-plan.repo'

export async function GET() {
    try {
        const plans = await getActivePlans(prisma)

        return NextResponse.json({
            data: plans.map(plan => ({
                id: plan.id,
                name: plan.name,
                slug: plan.slug,
                priceCents: plan.priceCents,
                currency: plan.currency,
                intervalMonths: plan.intervalMonths
            }))
        })
    } catch (error) {
        console.error('Error al obtener planes:', error instanceof Error ? error.message : 'UNKNOWN')
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Error al obtener los planes.' } },
            { status: 500 }
        )
    }
}
