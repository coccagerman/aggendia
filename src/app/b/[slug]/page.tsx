import { notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { findBusinessBySlug } from '@/data/repositories/business.repo'
import { getActiveServicesByBusinessId } from '@/data/repositories/service.repo'
import { getServiceIdsWithActiveResources } from '@/data/repositories/serviceResource.repo'
import { prisma } from '@/data/prisma/prisma'
import { Service } from '@/domain/services/service.types'
import { formatPrice } from '@/lib/format'
import { ServiceCard } from './service-card'

// Forzar renderizado dinámico para mostrar datos actualizados
export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{ slug: string }>
}

export default async function PublicBusinessPage({ params }: PageProps) {
    const { slug } = await params

    // Buscar negocio por slug
    let business
    try {
        business = await findBusinessBySlug(prisma, slug)
    } catch (error) {
        console.error('Error al buscar negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        notFound()
    }

    if (!business) {
        notFound()
    }

    // Obtener servicios activos
    const services = await getActiveServicesByBusinessId(prisma, business.id)

    // Filtrar servicios que tienen al menos un recurso ACTIVE asignado
    let bookableServices: Service[] = []
    if (services.length > 0) {
        const serviceIdsWithResources = await getServiceIdsWithActiveResources(
            prisma,
            business.id,
            services.map(s => s.id)
        )
        bookableServices = services.filter(s => serviceIdsWithResources.has(s.id))
    }
    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header público */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>{business.name}</h1>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl space-y-8'>
                        {/* Welcome card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Bienvenido a {business.name}</CardTitle>
                                <CardDescription>Reservá tu turno de forma rápida y sencilla</CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900'>
                                    <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                                        <strong className='text-zinc-900 dark:text-zinc-50'>
                                            Etiqueta configurada:
                                        </strong>{' '}
                                        {business.resourceLabel}
                                    </p>
                                    <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                                        En esta página vas a poder seleccionar {business.resourceLabel.toLowerCase()}s y
                                        reservar turnos.
                                    </p>
                                </div>

                                {business.address && (
                                    <div>
                                        <p className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>Dirección</p>
                                        <p className='text-sm text-zinc-600 dark:text-zinc-400'>{business.address}</p>
                                        {business.area && (
                                            <p className='text-sm text-zinc-500 dark:text-zinc-500'>{business.area}</p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Estado vacío o lista de servicios */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Servicios disponibles</CardTitle>
                                <CardDescription>Seleccioná el servicio que querés reservar</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {bookableServices.length === 0 ? (
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
                                                    d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                                                />
                                            </svg>
                                        </div>
                                        <h3 className='mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                                            Estamos configurando los servicios
                                        </h3>
                                        <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                            Este negocio está preparando su catálogo de servicios. Volvé pronto para
                                            reservar tu turno.
                                        </p>
                                    </div>
                                ) : (
                                    <div className='space-y-4'>
                                        {bookableServices.map(service => (
                                            <ServiceCard
                                                key={service.id}
                                                id={service.id}
                                                slug={slug}
                                                name={service.name}
                                                description={service.description}
                                                durationMinutes={service.durationMinutes}
                                                formattedPrice={formatPrice(service.priceCents, service.currency)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className='border-t border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto px-4 text-center sm:px-6 lg:px-8'>
                    <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                        Powered by <span className='font-semibold text-zinc-900 dark:text-zinc-50'>TurnosApp</span>
                    </p>
                </div>
            </footer>
        </div>
    )
}
