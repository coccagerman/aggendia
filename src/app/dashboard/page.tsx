import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LogoutButton } from './logout-button'
import { CopyLinkButton } from './copy-link-button'
import { getBusinessesByUserId } from '@/data/repositories/business.repo'
import { getResourcesByBusinessIdsMap } from '@/data/repositories/resource.repo'
import { prisma } from '@/data/prisma/prisma'

interface Business {
    id: string
    name: string
    slug: string
    timezone: string
    resourceLabel: string
    address: string | null
    area: string | null
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
        fetchError = 'No pudimos cargar tus negocios. Probá nuevamente en unos minutos.'
        // Continuar con array vacío
    }

    // Cargar recursos en batch para evitar N+1 usando repositorio (capa data)
    const businessIds = businesses.map(b => b.id)
    let resourcesByBusinessId: Record<string, Resource[]> = {}

    if (businessIds.length > 0) {
        try {
            resourcesByBusinessId = await getResourcesByBusinessIdsMap(prisma, businessIds)
        } catch (error) {
            console.error('Error al obtener recursos:', error instanceof Error ? error.message : 'UNKNOWN')
            resourcesByBusinessId = {}
        }
    }

    const businessesWithResources = businesses.map(business => ({
        ...business,
        resources: resourcesByBusinessId[business.id] ?? []
    }))

    const totalResources = businessesWithResources.reduce((acc, b) => acc + b.resources.length, 0)

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8'>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>TurnosApp</h1>
                    <LogoutButton />
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
                                <CardDescription>Gestioná tu negocio desde acá</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='space-y-4'>
                                    <div>
                                        <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
                                            Email de la cuenta
                                        </p>
                                        <p className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                                            {user.email || 'No disponible'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Businesses section */}
                        <Card>
                            <CardHeader>
                                <div className='flex items-center justify-between'>
                                    <div>
                                        <CardTitle>Mis Negocios</CardTitle>
                                        <CardDescription>
                                            {businessesWithResources.length === 0
                                                ? 'Creá tu primer negocio para comenzar'
                                                : `${businessesWithResources.length} negocio${
                                                      businessesWithResources.length > 1 ? 's' : ''
                                                  } configurado${businessesWithResources.length > 1 ? 's' : ''}`}
                                        </CardDescription>
                                    </div>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button asChild>
                                                    <Link href='/dashboard/business/new'>Crear negocio</Link>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Creá un nuevo negocio para gestionar turnos y recursos</p>
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
                                    {businessesWithResources.length === 0 ? (
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
                                                No tenés negocios todavía
                                            </h3>
                                            <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
                                                Comenzá creando tu primer negocio.
                                            </p>
                                            <Button asChild className='mt-6'>
                                                <Link href='/dashboard/business/new'>Crear mi primer negocio</Link>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className='space-y-4'>
                                            {businessesWithResources.map(business => (
                                                <div
                                                    key={business.id}
                                                    className='rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'
                                                >
                                                    <div className='flex items-start justify-between'>
                                                        <div className='flex-1'>
                                                            <h3 className='font-semibold text-zinc-900 dark:text-zinc-50'>
                                                                {business.name}
                                                            </h3>
                                                            <div className='mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-400'>
                                                                <p>
                                                                    <span className='font-medium'>Slug:</span>{' '}
                                                                    {business.slug}
                                                                </p>
                                                                <p>
                                                                    <span className='font-medium'>Timezone:</span>{' '}
                                                                    {business.timezone}
                                                                </p>
                                                                <p>
                                                                    <span className='font-medium'>
                                                                        Etiqueta de recurso:
                                                                    </span>{' '}
                                                                    {business.resourceLabel}
                                                                </p>
                                                                {business.address && (
                                                                    <p>
                                                                        <span className='font-medium'>Dirección:</span>{' '}
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

                                                            {/* Sección de recursos */}
                                                            <div className='mt-4'>
                                                                <div className='flex items-center justify-between'>
                                                                    <h4 className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                                                                        {business.resourceLabel}s
                                                                    </h4>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button asChild size='sm' variant='outline'>
                                                                                <Link
                                                                                    href={`/dashboard/business/${business.id}/resources/new`}
                                                                                >
                                                                                    Crear {business.resourceLabel}
                                                                                </Link>
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>
                                                                                Agregá{' '}
                                                                                {business.resourceLabel.toLowerCase()}s
                                                                                para recibir reservas
                                                                            </p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </div>

                                                                {business.resources.length === 0 ? (
                                                                    <p className='mt-2 text-sm text-zinc-500 dark:text-zinc-400'>
                                                                        No hay {business.resourceLabel.toLowerCase()}s
                                                                        creados todavía.
                                                                    </p>
                                                                ) : (
                                                                    <ul className='mt-2 space-y-1'>
                                                                        {business.resources.map(resource => (
                                                                            <li
                                                                                key={resource.id}
                                                                                className='flex items-center text-sm text-zinc-600 dark:text-zinc-400'
                                                                            >
                                                                                <span className='mr-2 h-1.5 w-1.5 rounded-full bg-green-500' />
                                                                                {resource.name}
                                                                                {resource.type && (
                                                                                    <span className='ml-2 text-xs text-zinc-500 dark:text-zinc-500'>
                                                                                        ({resource.type})
                                                                                    </span>
                                                                                )}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <span className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'>
                                                            {business.role}
                                                        </span>
                                                    </div>
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
                                <CardDescription>Configurá tu negocio para comenzar a recibir turnos</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='space-y-2 text-sm text-zinc-600 dark:text-zinc-400'>
                                    <p>✓ Cuenta creada</p>
                                    <p
                                        className={
                                            businessesWithResources.length > 0 ? '' : 'text-zinc-400 dark:text-zinc-600'
                                        }
                                    >
                                        {businessesWithResources.length > 0 ? '✓' : '○'} Crear negocio
                                    </p>
                                    <p className={totalResources > 0 ? '' : 'text-zinc-400 dark:text-zinc-600'}>
                                        {totalResources > 0 ? '✓' : '○'} Agregar recursos
                                    </p>
                                    <p className='text-zinc-400 dark:text-zinc-600'>
                                        ○ Definir servicios (próximamente)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
