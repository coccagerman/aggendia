import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById } from '@/data/repositories/business.repo'
import { getServicesByBusinessId } from '@/data/repositories/service.repo'
import { getResourcesByBusinessId } from '@/data/repositories/resource.repo'
import { countResourcesByServiceIds, getResourceIdsByServiceIds } from '@/data/repositories/serviceResource.repo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreateServiceDialog } from '@/components/dashboard/create-service-dialog'
import { ServiceActions } from '@/components/dashboard/service-actions'
import { AssignResourcesDialog } from '@/components/dashboard/assign-resources-dialog'
import { Service } from '@/domain/services/service.types'
import { Resource } from '@/domain/resources/resource.types'
import { Users } from 'lucide-react'

interface PageProps {
    params: Promise<{ businessId: string }>
}

export default async function ServicesPage({ params }: PageProps) {
    const { businessId } = await params

    // Validar sesión
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Validar acceso al negocio
    let business
    try {
        business = await getBusinessById(prisma, businessId)
        if (!business) {
            redirect('/dashboard')
        }

        // Verificar que el usuario tiene acceso (es miembro del negocio)
        const member = await prisma.businessMember.findFirst({
            where: {
                businessId,
                userId: user.id
            }
        })

        if (!member) {
            redirect('/dashboard')
        }
    } catch (error) {
        console.error('Error al obtener negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        redirect('/dashboard')
    }

    // Obtener servicios
    let services: Service[] = []
    let allResources: Resource[] = []
    let resourceCountsByService = new Map<string, number>()
    const assignedResourceIdsByService = new Map<string, string[]>()

    try {
        services = await getServicesByBusinessId(prisma, businessId)
    } catch (error) {
        console.error('Error al obtener servicios:', error instanceof Error ? error.message : 'UNKNOWN')
    }

    // Obtener recursos del negocio
    try {
        allResources = await getResourcesByBusinessId(prisma, businessId)
    } catch (error) {
        console.error('Error al obtener recursos:', error instanceof Error ? error.message : 'UNKNOWN')
    }

    // Obtener conteo de recursos por servicio
    if (services.length > 0) {
        try {
            const serviceIds = services.map(s => s.id)

            // Batch queries para evitar N+1
            const [counts, resourceIdsByService] = await Promise.all([
                countResourcesByServiceIds(prisma, businessId, serviceIds),
                getResourceIdsByServiceIds(prisma, businessId, serviceIds)
            ])

            resourceCountsByService = counts

            // Copiar resultados al Map
            for (const [serviceId, resourceIds] of resourceIdsByService) {
                assignedResourceIdsByService.set(serviceId, resourceIds)
            }
        } catch (error) {
            console.error('Error al obtener recursos asignados:', error instanceof Error ? error.message : 'UNKNOWN')
        }
    }

    const activeServices = services.filter(s => s.status === 'ACTIVE')
    const inactiveServices = services.filter(s => s.status === 'INACTIVE')

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <Button asChild variant='ghost' size='sm' className='mr-4'>
                        <Link href='/dashboard'>← Volver</Link>
                    </Button>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                        Servicios de {business.name}
                    </h1>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-3xl space-y-6'>
                        {/* Header con botón crear */}
                        <div className='flex items-center justify-between'>
                            <div>
                                <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                                    Gestión de servicios
                                </h2>
                                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                                    {services.length === 0
                                        ? 'Creá tu primer servicio para que los clientes puedan reservar'
                                        : `${activeServices.length} servicio${
                                              activeServices.length !== 1 ? 's' : ''
                                          } activo${activeServices.length !== 1 ? 's' : ''}`}
                                </p>
                            </div>
                            <CreateServiceDialog businessId={businessId} />
                        </div>

                        {/* Lista de servicios */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Servicios</CardTitle>
                                <CardDescription>
                                    Los servicios activos se muestran en la página pública de tu negocio
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {services.length === 0 ? (
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
                                            No hay servicios todavía
                                        </h3>
                                        <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                            Creá tu primer servicio para comenzar a recibir reservas.
                                        </p>
                                    </div>
                                ) : (
                                    <div className='space-y-4'>
                                        {services.map(service => {
                                            const resourceCount = resourceCountsByService.get(service.id) ?? 0
                                            const assignedIds = assignedResourceIdsByService.get(service.id) ?? []

                                            return (
                                                <div
                                                    key={service.id}
                                                    className='rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'
                                                >
                                                    <div className='flex items-start justify-between'>
                                                        <div className='flex-1'>
                                                            <div className='flex items-center gap-2'>
                                                                <h3 className='font-medium text-zinc-900 dark:text-zinc-50'>
                                                                    {service.name}
                                                                </h3>
                                                                <span
                                                                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                                                        service.status === 'ACTIVE'
                                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                                    }`}
                                                                >
                                                                    {service.status === 'ACTIVE'
                                                                        ? 'Activo'
                                                                        : 'Inactivo'}
                                                                </span>
                                                            </div>
                                                            {service.description && (
                                                                <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                                                                    {service.description}
                                                                </p>
                                                            )}
                                                            <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                                                <span>⏱️ {service.durationMinutes} min</span>
                                                                {service.slotIntervalMinutes >
                                                                    service.durationMinutes && (
                                                                    <span>
                                                                        🔄 Cada {service.slotIntervalMinutes} min
                                                                    </span>
                                                                )}
                                                                {service.priceCents !== null && (
                                                                    <span>
                                                                        💰 $
                                                                        {(service.priceCents / 100).toLocaleString(
                                                                            'es-AR',
                                                                            {
                                                                                minimumFractionDigits: 2
                                                                            }
                                                                        )}{' '}
                                                                        {service.currency}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Badge de recursos */}
                                                            <div className='mt-3 flex items-center gap-2'>
                                                                <AssignResourcesDialog
                                                                    service={service}
                                                                    allResources={allResources}
                                                                    assignedResourceIds={assignedIds}
                                                                    trigger={
                                                                        <button
                                                                            type='button'
                                                                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                                                                resourceCount > 0
                                                                                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                                                                                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                                                                            }`}
                                                                        >
                                                                            <Users className='h-3 w-3' />
                                                                            {resourceCount > 0
                                                                                ? `${resourceCount} recurso${
                                                                                      resourceCount !== 1 ? 's' : ''
                                                                                  }`
                                                                                : 'Sin recursos'}
                                                                        </button>
                                                                    }
                                                                />
                                                            </div>
                                                        </div>
                                                        <ServiceActions service={service} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Info card */}
                        {inactiveServices.length > 0 && (
                            <Card>
                                <CardContent className='pt-6'>
                                    <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                                        <span className='font-medium'>Nota:</span> Los servicios inactivos no se
                                        muestran en la página pública y no pueden ser reservados.
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
