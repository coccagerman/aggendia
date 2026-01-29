import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById } from '@/data/repositories/business.repo'
import { getResourcesByBusinessId } from '@/data/repositories/resource.repo'
import { getAppointmentsByBusinessAndRange, getAppointmentCountsByDay } from '@/data/repositories/appointment.repo'
import {
    getDayRangeInUTC,
    getWeekRangeInUTC,
    getMonthRangeInUTC,
    getWeekDays,
    getMonthDays,
    getWeekStartDate,
    getMonthStartDate,
    getTodayInTimezone,
    isValidDateString
} from '@/lib/timezone'
import { formatDateForAgenda, formatWeekRangeForAgenda, formatMonthForAgenda } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AgendaFilters, type AgendaView } from '@/components/dashboard/agenda-filters'
import { AppointmentList } from '@/components/dashboard/appointment-list'
import { WeekView } from '@/components/dashboard/week-view'
import { MonthView } from '@/components/dashboard/month-view'
import { CreateAppointmentDialog } from '@/components/dashboard/create-appointment-dialog'

interface PageProps {
    params: Promise<{ businessId: string }>
    searchParams: Promise<{ date?: string; resourceId?: string; view?: string }>
}

function isValidView(view: string | undefined): view is AgendaView {
    return view === 'day' || view === 'week' || view === 'month'
}

export default async function AgendaPage({ params, searchParams }: PageProps) {
    const { businessId } = await params
    const { date: dateParam, resourceId: resourceIdParam, view: viewParam } = await searchParams

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

    // Determinar vista (default: día)
    const selectedView: AgendaView = isValidView(viewParam) ? viewParam : 'day'

    // Determinar fecha a mostrar (default: hoy en timezone del negocio)
    const today = getTodayInTimezone(business.timezone)
    let selectedDate = dateParam && isValidDateString(dateParam) ? dateParam : today

    // Adjust date based on view (week starts on Monday, month on 1st)
    if (selectedView === 'week') {
        selectedDate = getWeekStartDate(selectedDate)
    } else if (selectedView === 'month') {
        selectedDate = getMonthStartDate(selectedDate)
    }

    // Obtener recursos para el filtro (ACTIVE e INACTIVE, excluyendo DELETED)
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

    // Calculate date range based on view
    let rangeStart: Date
    let rangeEnd: Date

    switch (selectedView) {
        case 'week': {
            const range = getWeekRangeInUTC(selectedDate, business.timezone)
            rangeStart = range.start
            rangeEnd = range.end
            break
        }
        case 'month': {
            const range = getMonthRangeInUTC(selectedDate, business.timezone)
            rangeStart = range.start
            rangeEnd = range.end
            break
        }
        default: {
            const range = getDayRangeInUTC(selectedDate, business.timezone)
            rangeStart = range.start
            rangeEnd = range.end
        }
    }

    // Obtener turnos del rango (para day/week) o solo conteos (para month)
    let appointments: Awaited<ReturnType<typeof getAppointmentsByBusinessAndRange>> = []
    let appointmentCountByDay: Record<string, number> = {}

    try {
        if (selectedView === 'month') {
            // Vista mes: solo necesitamos conteos por día (query optimizado)
            appointmentCountByDay = await getAppointmentCountsByDay(
                prisma,
                businessId,
                rangeStart,
                rangeEnd,
                validResourceId,
                business.timezone
            )
        } else {
            // Vista día/semana: necesitamos datos completos
            appointments = await getAppointmentsByBusinessAndRange(
                prisma,
                businessId,
                rangeStart,
                rangeEnd,
                validResourceId
            )
        }
    } catch (error) {
        console.error('Error al obtener turnos:', error instanceof Error ? error.message : 'UNKNOWN')
    }

    // Format title based on view
    let formattedTitle: string
    let description: string

    // Para vista mes, calcular total desde el record de conteos
    const monthTotalAppointments =
        selectedView === 'month' ? Object.values(appointmentCountByDay).reduce((sum, count) => sum + count, 0) : 0

    switch (selectedView) {
        case 'week':
            formattedTitle = formatWeekRangeForAgenda(selectedDate, business.timezone)
            description =
                appointments.length === 0
                    ? 'No hay turnos esta semana'
                    : `${appointments.length} turno${appointments.length !== 1 ? 's' : ''}`
            break
        case 'month':
            formattedTitle = formatMonthForAgenda(selectedDate, business.timezone)
            description =
                monthTotalAppointments === 0
                    ? 'No hay turnos este mes'
                    : `${monthTotalAppointments} turno${monthTotalAppointments !== 1 ? 's' : ''}`
            break
        default:
            formattedTitle = formatDateForAgenda(rangeStart, business.timezone)
            description =
                appointments.length === 0
                    ? 'No hay turnos para este día'
                    : `${appointments.length} turno${appointments.length !== 1 ? 's' : ''}`
    }

    // Group appointments by day for week view (only needed for day/week)
    const appointmentsByDay: Record<string, typeof appointments> = {}
    if (selectedView !== 'month') {
        for (const appt of appointments) {
            const startAt = new Date(appt.startAt)
            // Get date string in business timezone
            const dateStr = startAt.toLocaleDateString('en-CA', { timeZone: business.timezone })
            const existing = appointmentsByDay[dateStr] || []
            existing.push(appt)
            appointmentsByDay[dateStr] = existing
        }
    }

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8'>
                    <div className='flex items-center'>
                        <Button asChild variant='ghost' size='sm' className='mr-4'>
                            <Link href='/dashboard'>← Volver</Link>
                        </Button>
                        <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                            Agenda de {business.name}
                        </h1>
                    </div>
                    <CreateAppointmentDialog
                        businessId={businessId}
                        timezone={business.timezone}
                        resourceLabel={business.resourceLabel}
                    />
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-4xl space-y-6'>
                        {/* Filters */}
                        <AgendaFilters
                            resources={resources}
                            selectedDate={selectedDate}
                            selectedResourceId={validResourceId}
                            selectedView={selectedView}
                            resourceLabel={business.resourceLabel}
                        />

                        {/* Appointments card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className='capitalize'>{formattedTitle}</CardTitle>
                                <CardDescription>{description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {selectedView === 'day' && (
                                    <AppointmentList
                                        appointments={appointments}
                                        timezone={business.timezone}
                                        resourceLabel={business.resourceLabel}
                                        businessId={businessId}
                                        slug={business.slug}
                                    />
                                )}
                                {selectedView === 'week' && (
                                    <WeekView
                                        weekDays={getWeekDays(selectedDate)}
                                        appointmentsByDay={appointmentsByDay}
                                        timezone={business.timezone}
                                        resourceLabel={business.resourceLabel}
                                        businessId={businessId}
                                        slug={business.slug}
                                    />
                                )}
                                {selectedView === 'month' && (
                                    <MonthView
                                        monthDays={getMonthDays(selectedDate)}
                                        appointmentCountByDay={appointmentCountByDay}
                                        timezone={business.timezone}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
