import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById } from '@/data/repositories/business.repo'
import { getResourceById } from '@/data/repositories/resource.repo'
import { getAvailabilityByResourceId } from '@/data/repositories/availability.repo'
import { getBlocksByResourceId } from '@/data/repositories/block.repo'
import { getServicesByBusinessId } from '@/data/repositories/service.repo'
import { getServiceIdsByResourceId } from '@/data/repositories/serviceResource.repo'
import type { AvailabilityRule } from '@/domain/availability/availability.types'
import type { ResourceBlock } from '@/domain/blocks/block.types'
import type { Service } from '@/domain/services/service.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AvailabilityEditor } from '@/components/dashboard/availability-editor'
import { BlockEditor } from '@/components/dashboard/block-editor'
import { ServiceAssignmentEditor } from '@/components/dashboard/service-assignment-editor'

interface PageProps {
    params: Promise<{ businessId: string; resourceId: string }>
    searchParams: Promise<{ tab?: string }>
}

export default async function ResourceDetailPage({ params, searchParams }: PageProps) {
    const { businessId, resourceId } = await params
    const { tab } = await searchParams

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

    // Obtener recurso / prestador
    let resource
    try {
        resource = await getResourceById(prisma, businessId, resourceId)
        if (!resource) {
            redirect(`/dashboard/business/${businessId}/resources`)
        }
    } catch (error) {
        console.error('Error al obtener recurso / prestador:', error instanceof Error ? error.message : 'UNKNOWN')
        redirect(`/dashboard/business/${businessId}/resources`)
    }

    // Obtener disponibilidad
    let availability: AvailabilityRule[] = []
    try {
        availability = await getAvailabilityByResourceId(prisma, resourceId)
    } catch (error) {
        console.error('Error al obtener disponibilidad:', error instanceof Error ? error.message : 'UNKNOWN')
        // Keep empty array on error
    }

    // Obtener bloqueos
    let blocks: ResourceBlock[] = []
    try {
        blocks = await getBlocksByResourceId(prisma, { resourceId })
    } catch (error) {
        console.error('Error al obtener bloqueos:', error instanceof Error ? error.message : 'UNKNOWN')
        // Keep empty array on error
    }

    // Obtener servicios del negocio y los asignados al recurso / prestador
    let allServices: Service[] = []
    let assignedServiceIds: string[] = []
    try {
        const [services, serviceIds] = await Promise.all([
            getServicesByBusinessId(prisma, businessId),
            getServiceIdsByResourceId(prisma, businessId, resourceId)
        ])
        allServices = services
        assignedServiceIds = serviceIds
    } catch (error) {
        console.error('Error al obtener servicios:', error instanceof Error ? error.message : 'UNKNOWN')
        // Keep empty arrays on error
    }

    const statusLabels: Record<string, { label: string; className: string }> = {
        ACTIVE: {
            label: 'Activo',
            className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
        },
        INACTIVE: {
            label: 'Inactivo',
            className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
        }
    }

    const statusInfo = statusLabels[resource.status] || statusLabels.ACTIVE
    const initialTab = tab === 'availability' || tab === 'blocks' || tab === 'services' ? tab : 'general'

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <Button asChild variant='ghost' size='sm' className='mr-4'>
                        <Link href='/dashboard'>← Volver</Link>
                    </Button>
                    <div className='flex items-center gap-3'>
                        <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>{resource.name}</h1>
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                            {statusInfo.label}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-3xl'>
                        <Tabs defaultValue={initialTab} className='w-full'>
                            <TabsList className='mb-6'>
                                <TabsTrigger value='general' className='cursor-pointer'>
                                    General
                                </TabsTrigger>
                                <TabsTrigger value='availability' className='cursor-pointer'>
                                    Disponibilidad
                                </TabsTrigger>
                                <TabsTrigger value='blocks' className='cursor-pointer'>
                                    Bloqueos
                                </TabsTrigger>
                                <TabsTrigger value='services' className='cursor-pointer'>
                                    Servicios
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value='general'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Información del {business.resourceLabel}</CardTitle>
                                        <CardDescription>Datos básicos del recurso / prestador</CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-4'>
                                        <div>
                                            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                                                Nombre
                                            </p>
                                            <p className='text-zinc-900 dark:text-zinc-50'>{resource.name}</p>
                                        </div>
                                        <div>
                                            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>Tipo</p>
                                            <p className='text-zinc-900 dark:text-zinc-50'>
                                                {resource.type === 'PERSON'
                                                    ? 'Persona'
                                                    : resource.type === 'ASSET'
                                                      ? 'Activo/Equipamiento'
                                                      : 'No especificado'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                                                Estado
                                            </p>
                                            <span
                                                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                                            >
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value='availability'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Disponibilidad semanal</CardTitle>
                                        <CardDescription>
                                            Definí los horarios en que este {business.resourceLabel.toLowerCase()} está
                                            disponible para recibir reservas. Podés agregar múltiples rangos por día.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <AvailabilityEditor
                                            businessId={businessId}
                                            resourceId={resourceId}
                                            initialRanges={availability.map(r => ({
                                                id: r.id,
                                                dayOfWeek: r.dayOfWeek,
                                                startMinutes: r.startMinutes,
                                                endMinutes: r.endMinutes
                                            }))}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value='blocks'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Bloqueos puntuales</CardTitle>
                                        <CardDescription>
                                            Bloqueá períodos específicos (feriados, mantenimiento, vacaciones) en que
                                            este {business.resourceLabel.toLowerCase()} no estará disponible.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <BlockEditor
                                            businessId={businessId}
                                            resourceId={resourceId}
                                            initialBlocks={blocks.map(b => ({
                                                id: b.id,
                                                resourceId: b.resourceId,
                                                startAt: b.startAt.toISOString(),
                                                endAt: b.endAt.toISOString(),
                                                reason: b.reason,
                                                createdAt: b.createdAt.toISOString()
                                            }))}
                                            timezone={business.timezone}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value='services'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Servicios asignados</CardTitle>
                                        <CardDescription>
                                            Seleccioná los servicios que puede ofrecer este{' '}
                                            {business.resourceLabel.toLowerCase()}. Solo aparecerá disponible para
                                            reservas de los servicios seleccionados.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ServiceAssignmentEditor
                                            businessId={businessId}
                                            resourceId={resourceId}
                                            allServices={allServices}
                                            assignedServiceIds={assignedServiceIds}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </main>
        </div>
    )
}
