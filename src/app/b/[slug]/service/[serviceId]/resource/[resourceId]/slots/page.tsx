/**
 * Public page to display available booking slots
 * Route: /b/[slug]/service/[serviceId]/resource/[resourceId]/slots
 */

import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { findActiveBusinessBySlug } from '@/data/repositories/business.repo'
import { addDays, startOfDay } from 'date-fns'
import { SlotGrid } from './slot-grid'
import { MAX_DAYS_AHEAD } from '@/domain/slots/slots.types'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{ slug: string; serviceId: string; resourceId: string }>
}

export default async function SlotsPage({ params }: PageProps) {
    const { slug, serviceId, resourceId } = await params

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(serviceId) || !uuidRegex.test(resourceId)) {
        notFound()
    }

    // Find business by slug
    const business = await findActiveBusinessBySlug(prisma, slug)
    if (!business) {
        notFound()
    }

    // Find service (must be ACTIVE)
    const service = await prisma.service.findFirst({
        where: {
            id: serviceId,
            businessId: business.id,
            status: 'ACTIVE'
        },
        select: {
            id: true,
            name: true,
            durationMinutes: true,
            priceCents: true,
            currency: true
        }
    })

    if (!service) {
        notFound()
    }

    // Find resource (must be ACTIVE)
    const resource = await prisma.resource.findFirst({
        where: {
            id: resourceId,
            businessId: business.id,
            status: 'ACTIVE'
        },
        select: {
            id: true,
            name: true,
            type: true
        }
    })

    if (!resource) {
        notFound()
    }

    // Validate service-resource mapping
    const mapping = await prisma.serviceResource.findFirst({
        where: {
            serviceId,
            resourceId,
            businessId: business.id
        }
    })

    if (!mapping) {
        notFound()
    }

    // Default date range: today + 30 days (max allowed by public slots API)
    const fromDate = startOfDay(new Date())
    const toDate = addDays(fromDate, MAX_DAYS_AHEAD)

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <Link href={`/b/${slug}`} className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                        {business.name}
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-4xl space-y-6'>
                        {/* Breadcrumb / Context */}
                        <div className='flex items-center gap-2 text-sm text-zinc-500'>
                            <Link href={`/b/${slug}`} className='hover:text-zinc-900 dark:hover:text-zinc-50'>
                                Servicios
                            </Link>
                            <span>→</span>
                            <Link
                                href={`/b/${slug}/service/${serviceId}`}
                                className='hover:text-zinc-900 dark:hover:text-zinc-50'
                            >
                                {service.name}
                            </Link>
                            <span>→</span>
                            <span className='text-zinc-900 dark:text-zinc-50'>{resource.name}</span>
                        </div>

                        {/* Service info card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Elegí tu horario</CardTitle>
                                <CardDescription>
                                    <span className='block'>
                                        {service.name} • {resource.name}
                                    </span>
                                    <span className='block text-xs text-zinc-500 dark:text-zinc-400'>
                                        Duración: {service.durationMinutes} min
                                        {service.priceCents && service.currency && (
                                            <> • Precio: {formatPrice(service.priceCents, service.currency)}</>
                                        )}
                                    </span>
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {/* Client component for slot selection */}
                                <SlotGrid
                                    slug={slug}
                                    serviceId={serviceId}
                                    resourceId={resourceId}
                                    fromDate={fromDate.toISOString()}
                                    toDate={toDate.toISOString()}
                                    businessTimezone={business.timezone}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}

function formatPrice(priceCents: number, currency: string): string {
    const price = priceCents / 100
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: currency || 'ARS'
    }).format(price)
}
