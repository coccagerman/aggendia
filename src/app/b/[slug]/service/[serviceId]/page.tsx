/**
 * Public page for selecting a resource for a service
 * Route: /b/[slug]/service/[serviceId]
 *
 * Handles:
 * - Auto-redirect to slots if only 1 resource (skips this step)
 * - Show resource list if >1 resources
 * - Show empty state if 0 resources
 */

import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { findActiveBusinessBySlug } from '@/data/repositories/business.repo'
import { getActiveResourcesByServiceId } from '@/data/repositories/serviceResource.repo'
import { ResourceSelector } from './resource-selector'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{ slug: string; serviceId: string }>
}

export default async function SelectResourcePage({ params }: PageProps) {
    const { slug, serviceId } = await params

    // Validate serviceId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(serviceId)) {
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
            durationMinutes: true
        }
    })

    if (!service) {
        notFound()
    }

    // Get ACTIVE resources assigned to this service
    const resources = await getActiveResourcesByServiceId(prisma, business.id, serviceId)

    // Auto-redirect if exactly 1 resource (skip this step)
    if (resources.length === 1) {
        redirect(`/b/${slug}/service/${serviceId}/resource/${resources[0].id}/slots`)
    }

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
                    <div className='mx-auto max-w-2xl space-y-6'>
                        {/* Breadcrumb / Context */}
                        <div className='flex items-center gap-2 text-sm text-zinc-500'>
                            <Link href={`/b/${slug}`} className='hover:text-zinc-900 dark:hover:text-zinc-50'>
                                Servicios
                            </Link>
                            <span>→</span>
                            <span className='text-zinc-900 dark:text-zinc-50'>{service.name}</span>
                        </div>

                        {/* Resource selection card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Elegí {business.resourceLabel.toLowerCase()}</CardTitle>
                                <CardDescription>
                                    Seleccioná con quién o dónde querés reservar tu turno de {service.name}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {resources.length === 0 ? (
                                    // Empty state
                                    <div className='flex flex-col items-center justify-center py-12 text-center'>
                                        <div className='rounded-full bg-zinc-100 p-3 dark:bg-zinc-800'>
                                            <svg
                                                className='h-6 w-6 text-zinc-400'
                                                fill='none'
                                                viewBox='0 0 24 24'
                                                stroke='currentColor'
                                            >
                                                <path
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    strokeWidth={2}
                                                    d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                                />
                                            </svg>
                                        </div>
                                        <h3 className='mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                                            No hay {business.resourceLabel.toLowerCase()}s disponibles para este
                                            servicio
                                        </h3>
                                        <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                            Por favor, elegí otro servicio o volvé más tarde.
                                        </p>
                                        <Button asChild className='mt-6 cursor-pointer' variant='outline'>
                                            <Link href={`/b/${slug}`}>Volver a servicios</Link>
                                        </Button>
                                    </div>
                                ) : (
                                    // Resource list
                                    <ResourceSelector
                                        resources={resources}
                                        slug={slug}
                                        serviceId={serviceId}
                                        resourceLabel={business.resourceLabel}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Back link */}
                        {resources.length > 0 && (
                            <div className='text-center'>
                                <Link
                                    href={`/b/${slug}`}
                                    className='text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50'
                                >
                                    ← Volver a servicios
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className='border-t border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto px-4 text-center sm:px-6 lg:px-8'>
                    <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                        Powered by <span className='font-semibold text-zinc-900 dark:text-zinc-50'>Aggendia</span>
                    </p>
                </div>
            </footer>
        </div>
    )
}
