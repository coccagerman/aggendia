import { notFound } from 'next/navigation'
import { prisma } from '@/data/prisma/prisma'
import { getAppointmentByIdAndToken } from '@/data/repositories/appointment.repo'
import { formatDateTimeForNotification, getTimezoneDisplayName } from '@/lib/notifications/notification-time'
import { AppointmentManageActions } from './appointment-manage-actions'

export const dynamic = 'force-dynamic'

type PageProps = {
    params: Promise<{ slug: string; appointmentId: string }>
    searchParams: Promise<{ token?: string }>
}

export default async function AppointmentManagePage({ params, searchParams }: PageProps) {
    const { slug, appointmentId } = await params
    const { token } = await searchParams

    if (!token) {
        notFound()
    }

    const appointment = await getAppointmentByIdAndToken(prisma, appointmentId, token)

    if (!appointment || appointment.business.slug !== slug) {
        notFound()
    }

    const isActive = appointment.status === 'SCHEDULED' || appointment.status === 'RESCHEDULED'

    const statusLabels: Record<string, { text: string; color: string }> = {
        SCHEDULED: { text: 'Confirmado', color: 'text-emerald-600' },
        RESCHEDULED: { text: 'Reprogramado', color: 'text-blue-600' },
        CANCELLED: { text: 'Cancelado', color: 'text-red-600' },
        COMPLETED: { text: 'Completado', color: 'text-zinc-500' }
    }

    const statusInfo = statusLabels[appointment.status] ?? { text: appointment.status, color: 'text-zinc-500' }

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                        {appointment.business.name}
                    </h1>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-lg space-y-6'>
                        {/* Title */}
                        <div className='text-center'>
                            <h2 className='text-2xl font-bold text-zinc-900 dark:text-zinc-50'>Tu turno</h2>
                            <p className='mt-1 text-zinc-500'>
                                Hola {appointment.customer.fullName}, acá están los detalles de tu turno.
                            </p>
                        </div>

                        {/* Appointment details card */}
                        <div className='rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'>
                            {/* Status badge */}
                            <div className='mb-4 text-center'>
                                <span className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.text}</span>
                            </div>

                            <div className='space-y-3'>
                                <DetailRow label='Servicio' value={appointment.service.name} />
                                <DetailRow
                                    label={appointment.business.resourceLabel}
                                    value={appointment.resource.name}
                                />
                                <DetailRow
                                    label='Fecha y hora'
                                    value={formatDateTimeForNotification(
                                        appointment.startAt,
                                        appointment.business.timezone
                                    )}
                                    bold
                                />
                                <DetailRow
                                    label='Zona horaria'
                                    value={getTimezoneDisplayName(appointment.business.timezone)}
                                />
                                {appointment.business.address && (
                                    <DetailRow label='Dirección' value={appointment.business.address} />
                                )}
                            </div>
                        </div>

                        {/* Actions (client component) */}
                        {isActive && (
                            <AppointmentManageActions
                                appointmentId={appointmentId}
                                token={token}
                                slug={slug}
                                serviceId={appointment.service.id}
                                resourceId={appointment.resource.id}
                                timezone={appointment.business.timezone}
                            />
                        )}

                        {!isActive && (
                            <p className='text-center text-sm text-zinc-400'>Este turno ya no puede ser modificado.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
    return (
        <div className='flex items-center justify-between'>
            <span className='text-sm text-zinc-500'>{label}</span>
            <span
                className={`text-sm ${bold ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-300'}`}
            >
                {value}
            </span>
        </div>
    )
}
