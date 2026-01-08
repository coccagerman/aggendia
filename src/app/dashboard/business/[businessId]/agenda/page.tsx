import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById } from '@/data/repositories/business.repo'
import { getResourcesByBusinessId } from '@/data/repositories/resource.repo'
import { getAppointmentsByBusinessAndDay } from '@/data/repositories/appointment.repo'
import { getDayRangeInUTC, getTodayInTimezone, isValidDateString } from '@/lib/timezone'
import { formatDateForAgenda } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AgendaFilters } from '@/components/dashboard/agenda-filters'
import { AppointmentList } from '@/components/dashboard/appointment-list'

interface PageProps {
    params: Promise<{ businessId: string }>
    searchParams: Promise<{ date?: string; resourceId?: string }>
}

export default async function AgendaPage({ params, searchParams }: PageProps) {
    const { businessId } = await params
    const { date: dateParam, resourceId: resourceIdParam } = await searchParams

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

    // Determinar fecha a mostrar (default: hoy en timezone del negocio)
    const today = getTodayInTimezone(business.timezone)
    const selectedDate = dateParam && isValidDateString(dateParam) ? dateParam : today

    // Obtener recursos para el filtro (ACTIVE e INACTIVE, excluyendo DELETED)
    // Incluimos INACTIVE para permitir filtrar turnos históricos de recursos desactivados
    let resources: { id: string; name: string; status: string }[] = []
    try {
        const allResources = await getResourcesByBusinessId(prisma, businessId)
        resources = allResources
            .filter(r => r.status !== 'DELETED')
            .map(r => ({ id: r.id, name: r.name, status: r.status }))
    } catch (error) {
        console.error('Error al obtener recursos:', error instanceof Error ? error.message : 'UNKNOWN')
    }

    // Validar resourceId si está presente
    const validResourceId =
        resourceIdParam && resources.some(r => r.id === resourceIdParam) ? resourceIdParam : undefined

    // Obtener turnos del día
    const { start: dayStart, end: dayEnd } = getDayRangeInUTC(selectedDate, business.timezone)
    let appointments: Awaited<ReturnType<typeof getAppointmentsByBusinessAndDay>> = []

    try {
        appointments = await getAppointmentsByBusinessAndDay(prisma, businessId, dayStart, dayEnd, validResourceId)
    } catch (error) {
        console.error('Error al obtener turnos:', error instanceof Error ? error.message : 'UNKNOWN')
    }

    // Formatear fecha para display
    const formattedDate = formatDateForAgenda(dayStart, business.timezone)

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <Button asChild variant='ghost' size='sm' className='mr-4'>
                        <Link href='/dashboard'>← Volver</Link>
                    </Button>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>Agenda de {business.name}</h1>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-3xl space-y-6'>
                        {/* Filters */}
                        <AgendaFilters
                            resources={resources}
                            selectedDate={selectedDate}
                            selectedResourceId={validResourceId}
                            resourceLabel={business.resourceLabel}
                        />

                        {/* Appointments card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className='capitalize'>{formattedDate}</CardTitle>
                                <CardDescription>
                                    {appointments.length === 0
                                        ? 'No hay turnos para este día'
                                        : `${appointments.length} turno${appointments.length !== 1 ? 's' : ''}`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <AppointmentList
                                    appointments={appointments}
                                    timezone={business.timezone}
                                    resourceLabel={business.resourceLabel}
                                    businessId={businessId}
                                    slug={business.slug}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
