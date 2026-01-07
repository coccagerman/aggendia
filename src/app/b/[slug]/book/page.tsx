/**
 * Public booking confirmation page
 * Route: /b/[slug]/book?serviceId=...&resourceId=...&startAt=...
 *
 * @see docs/user-stories.md - US-5.4
 */

import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { findBusinessBySlug } from '@/data/repositories/business.repo'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'
import { BookingForm } from './booking-form'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ serviceId?: string; resourceId?: string; startAt?: string }>
}

export default async function BookPage({ params, searchParams }: PageProps) {
    const { slug } = await params
    const { serviceId, resourceId, startAt } = await searchParams

    // Validate required params
    if (!serviceId || !resourceId || !startAt) {
        redirect(`/b/${slug}`)
    }

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(serviceId) || !uuidRegex.test(resourceId)) {
        notFound()
    }

    // Validate startAt format
    const startAtDate = new Date(startAt)
    if (isNaN(startAtDate.getTime())) {
        redirect(`/b/${slug}`)
    }

    // Find business by slug
    const business = await findBusinessBySlug(prisma, slug)
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

    // Format date in business timezone
    const zonedTime = toZonedTime(startAtDate, business.timezone)
    const formattedDate = format(zonedTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })

    // Format price if exists
    const formattedPrice = service.priceCents
        ? new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: service.currency || 'ARS'
          }).format(service.priceCents / 100)
        : null

    return (
        <main className='container mx-auto max-w-2xl px-4 py-8'>
            {/* Back link */}
            <Link
                href={`/b/${slug}/service/${serviceId}/resource/${resourceId}/slots`}
                className='mb-6 inline-flex items-center text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
            >
                ← Elegir otro horario
            </Link>

            {/* Header */}
            <div className='mb-8'>
                <h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-50'>{business.name}</h1>
                <p className='text-zinc-600 dark:text-zinc-400'>Confirmá tu reserva</p>
            </div>

            {/* Booking summary */}
            <Card className='mb-6'>
                <CardHeader>
                    <CardTitle className='text-lg'>Resumen de la reserva</CardTitle>
                    <CardDescription>Verificá los datos antes de confirmar</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <div className='flex justify-between'>
                        <span className='text-zinc-600 dark:text-zinc-400'>Servicio</span>
                        <span className='font-medium'>{service.name}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-zinc-600 dark:text-zinc-400'>{business.resourceLabel}</span>
                        <span className='font-medium'>{resource.name}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-zinc-600 dark:text-zinc-400'>Fecha y hora</span>
                        <span className='font-medium capitalize'>{formattedDate}</span>
                    </div>
                    <div className='flex justify-between'>
                        <span className='text-zinc-600 dark:text-zinc-400'>Duración</span>
                        <span className='font-medium'>{service.durationMinutes} min</span>
                    </div>
                    {formattedPrice && (
                        <div className='flex justify-between border-t pt-3'>
                            <span className='text-zinc-600 dark:text-zinc-400'>Precio</span>
                            <span className='font-semibold text-zinc-900 dark:text-zinc-50'>{formattedPrice}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Booking form */}
            <BookingForm
                slug={slug}
                serviceId={serviceId}
                resourceId={resourceId}
                startAt={startAt}
                businessName={business.name}
                serviceName={service.name}
                resourceName={resource.name}
                formattedDate={formattedDate}
                businessTimezone={business.timezone}
            />
        </main>
    )
}
