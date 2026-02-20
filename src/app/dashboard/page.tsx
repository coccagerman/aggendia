import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem } from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LogoutButton } from './logout-button'
import { CopyLinkButton } from './copy-link-button'
import { ResourceActions } from '@/components/dashboard/resource-actions'
import { BusinessActions } from '@/components/dashboard/business-actions'
import { ServiceActions } from '@/components/dashboard/service-actions'
import { CreateServiceDialog } from '@/components/dashboard/create-service-dialog'
import { getBusinessesByUserId } from '@/data/repositories/business.repo'
import { getResourcesByBusinessIdsMap } from '@/data/repositories/resource.repo'
import { getServicesByBusinessIdsMap } from '@/data/repositories/service.repo'
import { prisma } from '@/data/prisma/prisma'
import { type Service } from '@/domain/services/service.types'
import { getSubscriptionStatus } from '@/domain/subscriptions/subscription.service'
import { getPlanById } from '@/data/repositories/subscription-plan.repo'
import { ChevronDownIcon, CircleAlert, Settings, Wallet } from 'lucide-react'

const BASE_ACTIVE_BUSINESSES_LIMIT = 3

interface Business {
    id: string
    name: string
    slug: string
    timezone: string
    resourceLabel: string
    address: string | null
    area: string | null
    status: string
    role: 'OWNER' | 'ADMIN' | 'STAFF'
}

interface Resource {
    id: string
    name: string
    type: string | null
    status: string
    businessId: string
}

export default async function DashboardPage() {
    const supabase = await createClient()

    let user
    try {
        const { data } = await supabase.auth.getUser()
        user = data.user
    } catch (error) {
        // Si falla getUser(), redirigir a login (podría ser token inválido/expirado)
        // I5: Loguear solo mensaje, no objeto completo (evitar stack traces en logs)
        console.error('Error al obtener usuario:', error instanceof Error ? error.message : 'UNKNOWN')
        redirect('/login')
    }

    // Si no hay usuario (no debería pasar por el middleware, pero por seguridad)
    if (!user) {
        redirect('/login')
    }

    // Obtener negocios del usuario directamente desde repositorio
    let businesses: Business[] = []
    let fetchError: string | null = null
    try {
        businesses = await getBusinessesByUserId(prisma, user.id)
    } catch (error) {
        console.error('Error al obtener negocios:', error instanceof Error ? error.message : 'UNKNOWN')
        fetchError = 'No pudimos cargar tus negocios / sedes. Probá nuevamente en unos minutos.'
        // Continuar con array vacío
    }

    // Check if user is admin (for trial-links link in header)
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? []
    const isAdmin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false

    // Cargar recursos / prestadores en batch para evitar N+1 usando repositorio (capa data)
    const businessIds = businesses.map(b => b.id)
    let resourcesByBusinessId: Record<string, Resource[]> = {}
    let servicesByBusinessId: Record<string, Service[]> = {}

    if (businessIds.length > 0) {
        try {
            resourcesByBusinessId = await getResourcesByBusinessIdsMap(prisma, businessIds)
        } catch (error) {
            console.error(
                'Error al obtener recursos / prestadores:',
                error instanceof Error ? error.message : 'UNKNOWN'
            )
            resourcesByBusinessId = {}
        }

        try {
            servicesByBusinessId = await getServicesByBusinessIdsMap(prisma, businessIds)
        } catch (error) {
            console.error('Error al obtener servicios:', error instanceof Error ? error.message : 'UNKNOWN')
            servicesByBusinessId = {}
        }
    }

    const businessesWithData = businesses.map(business => ({
        ...business,
        resources: resourcesByBusinessId[business.id] ?? [],
        services: servicesByBusinessId[business.id] ?? []
    }))

    const allResourceIds = businessesWithData.flatMap(business => business.resources.map(resource => resource.id))
    const allServiceIds = businessesWithData.flatMap(business => business.services.map(service => service.id))

    let resourceIdsWithAvailability = new Set<string>()
    if (allResourceIds.length > 0) {
        try {
            const availabilityGroups = await prisma.availabilityRule.groupBy({
                by: ['resourceId'],
                where: {
                    resourceId: {
                        in: allResourceIds
                    }
                }
            })

            resourceIdsWithAvailability = new Set(availabilityGroups.map(group => group.resourceId))
        } catch (error) {
            console.error(
                'Error al obtener disponibilidad de recursos / prestadores:',
                error instanceof Error ? error.message : 'UNKNOWN'
            )
        }
    }

    let serviceIdsWithAssignedResources = new Set<string>()
    if (allServiceIds.length > 0) {
        try {
            const serviceResourceGroups = await prisma.serviceResource.groupBy({
                by: ['serviceId'],
                where: {
                    serviceId: {
                        in: allServiceIds
                    }
                }
            })

            serviceIdsWithAssignedResources = new Set(serviceResourceGroups.map(group => group.serviceId))
        } catch (error) {
            console.error(
                'Error al obtener asignaciones de recursos / prestadores por servicio:',
                error instanceof Error ? error.message : 'UNKNOWN'
            )
        }
    }

    const totalResources = businessesWithData.reduce((acc, b) => acc + b.resources.length, 0)
    const totalActiveServices = businessesWithData.reduce(
        (acc, b) => acc + b.services.filter(s => s.status === 'ACTIVE').length,
        0
    )
    const activeBusinessesCount = businessesWithData.filter(b => b.status === 'ACTIVE').length

    const subscription = await getSubscriptionStatus(prisma, user.id)
    let isTrialOrBaseUser = false
    let currentPlanName = 'Sin plan activo'
    if (subscription?.status === 'TRIALING') {
        isTrialOrBaseUser = true
        currentPlanName = 'Prueba gratis'
    } else if (subscription?.planId) {
        const plan = await getPlanById(prisma, subscription.planId)
        isTrialOrBaseUser = plan?.slug === 'base'
        currentPlanName = plan?.name ?? 'Sin plan activo'
    }

    const canCreateBusiness = !(isTrialOrBaseUser && activeBusinessesCount >= BASE_ACTIVE_BUSINESSES_LIMIT)

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8'>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>Aggendia</h1>
                    <div className='flex items-center gap-3'>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant='ghost' size='icon' aria-label='Gestionar mi suscripción'>
                                        <Link href='/subscription'>
                                            <Wallet className='h-4 w-4' />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Gestionar mi suscripción</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {isAdmin && (
                            <Link
                                href='/dashboard/admin/trial-links'
                                className='flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                            >
                                <Settings className='h-4 w-4' />
                                Admin
                            </Link>
                        )}
                        <LogoutButton />
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-4xl space-y-8'>
                        {/* Welcome card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Bienvenido al Dashboard</CardTitle>
                                <CardDescription>Gestioná tus negocios / sedes desde acá</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                                    <div className='grid gap-4 sm:grid-cols-2 sm:gap-8'>
                                        <div>
                                            <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
                                                Email de la cuenta
                                            </p>
                                            <p className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                                                {user.email || 'No disponible'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
                                                Plan:
                                            </p>
                                            <p className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                                                {currentPlanName}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Businesses section */}
                        <Card>
                            <CardHeader>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <CardTitle>Mis negocios / sedes</CardTitle>
                                        <CardDescription>
                                            {businessesWithData.length === 0
                                                ? 'Creá tu primer negocio / sede para comenzar'
                                                : `${businessesWithData.length} negocio${
                                                      businessesWithData.length > 1 ? 's' : ''
                                                  } / sede${
                                                      businessesWithData.length > 1 ? 's' : ''
                                                  } configurado${businessesWithData.length > 1 ? 's' : ''}`}
                                        </CardDescription>
                                    </div>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                {canCreateBusiness ? (
                                                    <Button asChild>
                                                        <Link href='/dashboard/business/new'>Crear negocio / sede</Link>
                                                    </Button>
                                                ) : (
                                                    <span className='inline-flex'>
                                                        <Button disabled>Crear negocio / sede</Button>
                                                    </span>
                                                )}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {canCreateBusiness ? (
                                                    <p>
                                                        Creá un nuevo negocio / sede para gestionar turnos y recursos /
                                                        prestadores
                                                    </p>
                                                ) : (
                                                    <p>suscribite al plan premium para crear más negocios</p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <TooltipProvider>
                                    {fetchError && (
                                        <div className='mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                                            {fetchError}
                                        </div>
                                    )}
                                    {businessesWithData.length === 0 ? (
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
                                                        d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                                                    />
                                                </svg>
                                            </div>
                                            <h3 className='mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                                                No tenés negocios / sedes todavía
                                            </h3>
                                            <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                                Comenzá creando tu primer negocio / sede.
                                            </p>
                                            <Button asChild className='mt-6'>
                                                <Link href='/dashboard/business/new'>
                                                    Crear mi primer negocio / sede
                                                </Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className='space-y-4'>
                                            {businessesWithData.map(business => (
                                                <div
                                                    key={business.id}
                                                    className='rounded-lg border border-zinc-200 px-4 dark:border-zinc-800'
                                                >
                                                    <Accordion
                                                        type='single'
                                                        collapsible
                                                        defaultValue={`business-${business.id}`}
                                                        className='w-full'
                                                    >
                                                        <AccordionItem
                                                            value={`business-${business.id}`}
                                                            className='border-b-0'
                                                        >
                                                            <div className='flex items-center gap-2 py-4'>
                                                                <AccordionPrimitive.Header className='flex-1'>
                                                                    <AccordionPrimitive.Trigger className='[&[data-state=open]_.business-chevron]:rotate-180 flex w-full cursor-pointer items-center gap-2 text-left text-base font-semibold text-zinc-900 outline-none dark:text-zinc-50'>
                                                                        <ChevronDownIcon className='business-chevron h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400' />
                                                                        <span>{business.name}</span>
                                                                    </AccordionPrimitive.Trigger>
                                                                </AccordionPrimitive.Header>
                                                                <span
                                                                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                                                        business.status === 'ACTIVE'
                                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                                    }`}
                                                                >
                                                                    {business.status === 'ACTIVE'
                                                                        ? 'Activo'
                                                                        : 'Inactivo'}
                                                                </span>
                                                                <BusinessActions
                                                                    business={{
                                                                        id: business.id,
                                                                        name: business.name,
                                                                        timezone: business.timezone,
                                                                        address: business.address,
                                                                        area: business.area,
                                                                        status: business.status
                                                                    }}
                                                                />
                                                            </div>
                                                            <AccordionContent className='pb-4'>
                                                                <div className='mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400'>
                                                                    <p>
                                                                        <span className='font-medium'>Slug:</span>{' '}
                                                                        {business.slug}
                                                                    </p>
                                                                    {business.address && (
                                                                        <p>
                                                                            <span className='font-medium'>
                                                                                Dirección:
                                                                            </span>{' '}
                                                                            {business.address}
                                                                        </p>
                                                                    )}
                                                                    {business.area && (
                                                                        <p>
                                                                            <span className='font-medium'>
                                                                                Ciudad/Zona:
                                                                            </span>{' '}
                                                                            {business.area}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Link público */}
                                                                <div className='mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/30'>
                                                                    <p className='text-xs font-medium text-blue-900 dark:text-blue-200'>
                                                                        🔗 Link público para compartir
                                                                    </p>
                                                                    <CopyLinkButton slug={business.slug} />
                                                                </div>

                                                                {/* Sección de agenda */}
                                                                <div className='mt-4'>
                                                                    <div className='flex items-center justify-between'>
                                                                        <div>
                                                                            <h4 className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                                                                                Agenda
                                                                            </h4>
                                                                            <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                                                                Visualizá y organizá los turnos por día
                                                                                y recursos / prestadores.
                                                                            </p>
                                                                        </div>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    asChild
                                                                                    size='sm'
                                                                                    variant='outline'
                                                                                >
                                                                                    <Link
                                                                                        href={`/dashboard/business/${business.id}/agenda`}
                                                                                    >
                                                                                        Ver Agenda
                                                                                    </Link>
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>Mirá los turnos del día</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </div>
                                                                </div>

                                                                {/* Sección de notificaciones */}
                                                                <div className='mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700'>
                                                                    <div className='flex items-center justify-between'>
                                                                        <div>
                                                                            <h4 className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                                                                                Notificaciones
                                                                            </h4>
                                                                            <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                                                                Configurá recordatorios y notificaciones
                                                                                por mail y WhatsApp.
                                                                            </p>
                                                                        </div>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    asChild
                                                                                    size='sm'
                                                                                    variant='outline'
                                                                                >
                                                                                    <Link
                                                                                        href={`/dashboard/business/${business.id}/settings`}
                                                                                    >
                                                                                        Configurar notificaciones
                                                                                    </Link>
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                <p>Notificaciones y recordatorios</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </div>
                                                                </div>

                                                                <Accordion
                                                                    type='multiple'
                                                                    defaultValue={['resources', 'services']}
                                                                    className='mt-4 border-t border-zinc-200 dark:border-zinc-700'
                                                                >
                                                                    <AccordionItem
                                                                        value='resources'
                                                                        className='border-b border-zinc-200 dark:border-zinc-700'
                                                                    >
                                                                        <div className='flex items-center justify-between py-3'>
                                                                            <AccordionPrimitive.Header className='flex-1'>
                                                                                <AccordionPrimitive.Trigger className='[&[data-state=open]_.resources-chevron]:rotate-180 flex w-full cursor-pointer items-center gap-2 py-0 text-left text-sm font-medium text-zinc-700 outline-none dark:text-zinc-300'>
                                                                                    <ChevronDownIcon className='resources-chevron h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400' />
                                                                                    <span>Recursos / prestadores</span>
                                                                                </AccordionPrimitive.Trigger>
                                                                            </AccordionPrimitive.Header>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Button
                                                                                        asChild
                                                                                        size='sm'
                                                                                        variant='outline'
                                                                                    >
                                                                                        <Link
                                                                                            href={`/dashboard/business/${business.id}/resources/new`}
                                                                                        >
                                                                                            Crear recurso / prestador
                                                                                        </Link>
                                                                                    </Button>
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>
                                                                                    <p>
                                                                                        Agregá recursos / prestadores
                                                                                        para recibir reservas
                                                                                    </p>
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </div>
                                                                        <AccordionContent>
                                                                            {business.resources.length === 0 ? (
                                                                                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                                                                                    No hay recursos / prestadores
                                                                                    creados todavía.
                                                                                </p>
                                                                            ) : (
                                                                                <ul className='space-y-1'>
                                                                                    {business.resources.map(resource =>
                                                                                        (() => {
                                                                                            const hasAvailability =
                                                                                                resourceIdsWithAvailability.has(
                                                                                                    resource.id
                                                                                                )

                                                                                            return (
                                                                                                <li
                                                                                                    key={resource.id}
                                                                                                    className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'
                                                                                                >
                                                                                                    <div className='flex min-w-0 flex-1 items-center gap-2'>
                                                                                                        <span
                                                                                                            className={`h-1.5 w-1.5 rounded-full ${
                                                                                                                resource.status ===
                                                                                                                'ACTIVE'
                                                                                                                    ? 'bg-green-500'
                                                                                                                    : 'bg-zinc-400'
                                                                                                            }`}
                                                                                                        />
                                                                                                        <Link
                                                                                                            href={`/dashboard/business/${business.id}/resources/${resource.id}`}
                                                                                                            className='truncate hover:text-zinc-900 hover:underline dark:hover:text-zinc-200'
                                                                                                        >
                                                                                                            {
                                                                                                                resource.name
                                                                                                            }
                                                                                                            {resource.type && (
                                                                                                                <span className='ml-2 text-xs text-zinc-500 dark:text-zinc-500'>
                                                                                                                    (
                                                                                                                    {resource.type ===
                                                                                                                    'PERSON'
                                                                                                                        ? 'Prestador'
                                                                                                                        : 'Recurso físico'}
                                                                                                                    )
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </Link>
                                                                                                        {!hasAvailability && (
                                                                                                            <Tooltip>
                                                                                                                <TooltipTrigger
                                                                                                                    asChild
                                                                                                                >
                                                                                                                    <Button
                                                                                                                        asChild
                                                                                                                        size='sm'
                                                                                                                        variant='outline'
                                                                                                                        className='h-7 border-orange-200 bg-orange-50 px-2 text-xs text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50'
                                                                                                                    >
                                                                                                                        <Link
                                                                                                                            href={`/dashboard/business/${business.id}/resources/${resource.id}?tab=availability`}
                                                                                                                        >
                                                                                                                            <CircleAlert className='mr-1 h-3.5 w-3.5' />
                                                                                                                            Configurar
                                                                                                                            disponibilidad
                                                                                                                        </Link>
                                                                                                                    </Button>
                                                                                                                </TooltipTrigger>
                                                                                                                <TooltipContent>
                                                                                                                    <p>
                                                                                                                        El
                                                                                                                        recurso/prestador
                                                                                                                        no
                                                                                                                        tiene
                                                                                                                        disponibilidad
                                                                                                                        configurada
                                                                                                                        aún.
                                                                                                                        Configurala
                                                                                                                        para
                                                                                                                        que
                                                                                                                        tus
                                                                                                                        clientes
                                                                                                                        pueden
                                                                                                                        reservar.
                                                                                                                    </p>
                                                                                                                </TooltipContent>
                                                                                                            </Tooltip>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <span
                                                                                                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                                                                                            resource.status ===
                                                                                                            'ACTIVE'
                                                                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                                                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                                                                        }`}
                                                                                                    >
                                                                                                        {resource.status ===
                                                                                                        'ACTIVE'
                                                                                                            ? 'Activo'
                                                                                                            : 'Inactivo'}
                                                                                                    </span>
                                                                                                    <ResourceActions
                                                                                                        resource={
                                                                                                            resource
                                                                                                        }
                                                                                                        resourceLabel={
                                                                                                            business.resourceLabel
                                                                                                        }
                                                                                                    />
                                                                                                </li>
                                                                                            )
                                                                                        })()
                                                                                    )}
                                                                                </ul>
                                                                            )}
                                                                        </AccordionContent>
                                                                    </AccordionItem>

                                                                    <AccordionItem
                                                                        value='services'
                                                                        className='border-b-0'
                                                                    >
                                                                        <div className='flex items-center justify-between py-3'>
                                                                            <AccordionPrimitive.Header className='flex-1'>
                                                                                <AccordionPrimitive.Trigger className='[&[data-state=open]_.services-chevron]:rotate-180 flex w-full cursor-pointer items-center gap-2 py-0 text-left text-sm font-medium text-zinc-700 outline-none dark:text-zinc-300'>
                                                                                    <ChevronDownIcon className='services-chevron h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400' />
                                                                                    <span>Servicios</span>
                                                                                </AccordionPrimitive.Trigger>
                                                                            </AccordionPrimitive.Header>
                                                                            <CreateServiceDialog
                                                                                businessId={business.id}
                                                                                triggerVariant='outline'
                                                                                triggerSize='sm'
                                                                            />
                                                                        </div>
                                                                        <AccordionContent>
                                                                            {business.services.length === 0 ? (
                                                                                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                                                                                    No hay servicios creados todavía.
                                                                                </p>
                                                                            ) : (
                                                                                <ul className='space-y-1'>
                                                                                    {business.services.map(service =>
                                                                                        (() => {
                                                                                            const hasAssignedResources =
                                                                                                serviceIdsWithAssignedResources.has(
                                                                                                    service.id
                                                                                                )

                                                                                            return (
                                                                                                <li
                                                                                                    key={service.id}
                                                                                                    className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'
                                                                                                >
                                                                                                    <div className='flex min-w-0 flex-1 items-center gap-2'>
                                                                                                        <span
                                                                                                            className={`h-1.5 w-1.5 rounded-full ${
                                                                                                                service.status ===
                                                                                                                'ACTIVE'
                                                                                                                    ? 'bg-green-500'
                                                                                                                    : 'bg-zinc-400'
                                                                                                            }`}
                                                                                                        />
                                                                                                        <Link
                                                                                                            href={`/dashboard/business/${business.id}/services`}
                                                                                                            className='truncate hover:text-zinc-900 hover:underline dark:hover:text-zinc-200'
                                                                                                        >
                                                                                                            {
                                                                                                                service.name
                                                                                                            }
                                                                                                            <span className='ml-2 text-xs text-zinc-500 dark:text-zinc-500'>
                                                                                                                {
                                                                                                                    service.durationMinutes
                                                                                                                }{' '}
                                                                                                                min
                                                                                                            </span>
                                                                                                        </Link>
                                                                                                        {!hasAssignedResources && (
                                                                                                            <Tooltip>
                                                                                                                <TooltipTrigger
                                                                                                                    asChild
                                                                                                                >
                                                                                                                    <Button
                                                                                                                        asChild
                                                                                                                        size='sm'
                                                                                                                        variant='outline'
                                                                                                                        className='h-7 border-orange-200 bg-orange-50 px-2 text-xs text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50'
                                                                                                                    >
                                                                                                                        <Link
                                                                                                                            href={`/dashboard/business/${business.id}/services`}
                                                                                                                        >
                                                                                                                            <CircleAlert className='mr-1 h-3.5 w-3.5' />
                                                                                                                            Asociar
                                                                                                                            recurso
                                                                                                                            /
                                                                                                                            prestador
                                                                                                                        </Link>
                                                                                                                    </Button>
                                                                                                                </TooltipTrigger>
                                                                                                                <TooltipContent>
                                                                                                                    <p>
                                                                                                                        El
                                                                                                                        servicio
                                                                                                                        no
                                                                                                                        tiene
                                                                                                                        un
                                                                                                                        recurso/prestador
                                                                                                                        asociado
                                                                                                                        aún.
                                                                                                                        Asocialo
                                                                                                                        para
                                                                                                                        que
                                                                                                                        tus
                                                                                                                        clientes
                                                                                                                        pueden
                                                                                                                        reservar.
                                                                                                                    </p>
                                                                                                                </TooltipContent>
                                                                                                            </Tooltip>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <span
                                                                                                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                                                                                            service.status ===
                                                                                                            'ACTIVE'
                                                                                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                                                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                                                                        }`}
                                                                                                    >
                                                                                                        {service.status ===
                                                                                                        'ACTIVE'
                                                                                                            ? 'Activo'
                                                                                                            : 'Inactivo'}
                                                                                                    </span>
                                                                                                    <ServiceActions
                                                                                                        service={
                                                                                                            service
                                                                                                        }
                                                                                                    />
                                                                                                </li>
                                                                                            )
                                                                                        })()
                                                                                    )}
                                                                                </ul>
                                                                            )}
                                                                        </AccordionContent>
                                                                    </AccordionItem>
                                                                </Accordion>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TooltipProvider>
                            </CardContent>
                        </Card>

                        {/* Next steps card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Próximos pasos</CardTitle>
                                <CardDescription>
                                    Configurá tu negocio / sede para comenzar a recibir turnos
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='space-y-2 text-sm text-zinc-600 dark:text-zinc-400'>
                                    <p>✓ Cuenta creada</p>
                                    <p
                                        className={
                                            businessesWithData.length > 0 ? '' : 'text-zinc-400 dark:text-zinc-600'
                                        }
                                    >
                                        {businessesWithData.length > 0 ? '✓' : '○'} Crear negocio / sede
                                    </p>
                                    <p className={totalResources > 0 ? '' : 'text-zinc-400 dark:text-zinc-600'}>
                                        {totalResources > 0 ? '✓' : '○'} Agregar recursos / prestadores
                                    </p>
                                    <p className={totalActiveServices > 0 ? '' : 'text-zinc-400 dark:text-zinc-600'}>
                                        {totalActiveServices > 0 ? '✓' : '○'} Definir servicios
                                    </p>
                                    {businessesWithData.length > 0 && totalResources > 0 && totalActiveServices > 0 && (
                                        <p className='pt-2 font-medium text-green-700 dark:text-green-400'>
                                            Listo! Ya podés compartir tu link y que tus clientes comiencen a reservar.
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
