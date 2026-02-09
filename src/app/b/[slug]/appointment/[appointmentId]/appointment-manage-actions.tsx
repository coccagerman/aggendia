'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Slot {
    startAt: string
    endAt: string
    displayTime: string
}

interface AppointmentManageActionsProps {
    appointmentId: string
    token: string
    slug: string
    serviceId: string
    resourceId: string
    timezone: string
}

const MAX_DAYS_AHEAD = 30

export function AppointmentManageActions({
    appointmentId,
    token,
    slug,
    serviceId,
    resourceId,
    timezone
}: AppointmentManageActionsProps) {
    const router = useRouter()

    // ── Cancel state ──
    const [cancelling, setCancelling] = useState(false)
    const [cancelled, setCancelled] = useState(false)

    // ── Reschedule state ──
    const [showReschedule, setShowReschedule] = useState(false)
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

    // ── Shared state ──
    const [error, setError] = useState<string | null>(null)

    // ── Date helpers (business timezone) ──
    const getTodayInBusinessTz = useCallback(() => {
        const nowInTz = toZonedTime(new Date(), timezone)
        return format(nowInTz, 'yyyy-MM-dd')
    }, [timezone])

    const [selectedDate, setSelectedDate] = useState<string>(() => getTodayInBusinessTz())

    // ── Fetch slots ──
    const fetchSlots = useCallback(async () => {
        if (!showReschedule) return

        setIsLoadingSlots(true)
        setError(null)
        setSelectedSlot(null)

        try {
            const fromDateInTz = fromZonedTime(`${selectedDate}T00:00:00`, timezone)
            const toDate = addDays(fromDateInTz, 1)

            const params = new URLSearchParams({
                slug,
                serviceId,
                resourceId,
                fromDate: fromDateInTz.toISOString(),
                toDate: toDate.toISOString()
            })

            const res = await fetch(`/api/v1/public/slots?${params}`)

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error?.message || 'Error al cargar horarios')
            }

            const data = await res.json()
            setSlots(data.data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar horarios')
            setSlots([])
        } finally {
            setIsLoadingSlots(false)
        }
    }, [showReschedule, selectedDate, slug, serviceId, resourceId, timezone])

    useEffect(() => {
        fetchSlots()
    }, [fetchSlots])

    // ── Date navigation ──
    const minDate = getTodayInBusinessTz()
    const minDateParts = minDate.split('-').map(Number)
    const minDateObj = new Date(minDateParts[0], minDateParts[1] - 1, minDateParts[2])
    minDateObj.setDate(minDateObj.getDate() + MAX_DAYS_AHEAD)
    const maxDate = format(minDateObj, 'yyyy-MM-dd')

    function handlePreviousDay() {
        const parts = selectedDate.split('-').map(Number)
        const d = new Date(parts[0], parts[1] - 1, parts[2])
        d.setDate(d.getDate() - 1)
        const prev = format(d, 'yyyy-MM-dd')
        if (prev >= minDate) setSelectedDate(prev)
    }

    function handleNextDay() {
        const parts = selectedDate.split('-').map(Number)
        const d = new Date(parts[0], parts[1] - 1, parts[2])
        d.setDate(d.getDate() + 1)
        const next = format(d, 'yyyy-MM-dd')
        if (next <= maxDate) setSelectedDate(next)
    }

    function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        const v = e.target.value
        if (v && v >= minDate && v <= maxDate) setSelectedDate(v)
    }

    // ── Cancel handler ──
    async function handleCancel() {
        setCancelling(true)
        setError(null)
        try {
            const res = await fetch(`/api/v1/public/appointments/${appointmentId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            })

            if (!res.ok) {
                const body = await res.json().catch(() => null)
                setError(body?.error?.message ?? 'Error al cancelar el turno.')
                return
            }

            setCancelled(true)
            router.refresh()
        } catch {
            setError('Error de conexión. Intentá de nuevo.')
        } finally {
            setCancelling(false)
        }
    }

    // ── Reschedule handler ──
    async function handleReschedule() {
        if (!selectedSlot) return

        setIsSubmitting(true)
        setError(null)

        try {
            const res = await fetch(`/api/v1/public/appointments/${appointmentId}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newStartAt: selectedSlot.startAt })
            })

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                setError(data?.error?.message ?? 'Error al reprogramar el turno.')
                // If slot taken, refresh available slots
                if (res.status === 409) fetchSlots()
                return
            }

            // Redirect to the NEW appointment manage page (new token)
            const newId = data?.data?.newAppointmentId
            const newToken = data?.data?.newSecretToken
            if (newId && newToken) {
                router.push(`/b/${slug}/appointment/${newId}?token=${newToken}`)
            } else {
                router.refresh()
            }
        } catch {
            setError('Error de conexión. Intentá de nuevo.')
        } finally {
            setIsSubmitting(false)
        }
    }

    // ── Cancelled state ──
    if (cancelled) {
        return (
            <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20'>
                <p className='text-sm font-medium text-red-700 dark:text-red-400'>Tu turno fue cancelado.</p>
            </div>
        )
    }

    const busy = cancelling || isSubmitting

    return (
        <div className='space-y-4'>
            {/* Error banner */}
            {error && (
                <div className='rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20'>
                    <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
                </div>
            )}

            {/* ── Reschedule slot picker (inline) ── */}
            {showReschedule && (
                <div className='space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'>
                    <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-50'>Elegí un nuevo horario</h3>

                    {/* Date selector */}
                    <div className='space-y-1'>
                        <Label htmlFor='reschedule-date'>Fecha</Label>
                        <div className='flex items-center gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                onClick={handlePreviousDay}
                                disabled={selectedDate <= minDate || isLoadingSlots}
                                aria-label='Día anterior'
                            >
                                <ChevronLeft className='h-4 w-4' />
                            </Button>
                            <Input
                                id='reschedule-date'
                                type='date'
                                value={selectedDate}
                                onChange={handleDateChange}
                                min={minDate}
                                max={maxDate}
                                disabled={isLoadingSlots}
                                className='flex-1'
                            />
                            <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                onClick={handleNextDay}
                                disabled={selectedDate >= maxDate || isLoadingSlots}
                                aria-label='Día siguiente'
                            >
                                <ChevronRight className='h-4 w-4' />
                            </Button>
                        </div>
                        <p className='text-sm text-zinc-500'>
                            {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                    </div>

                    {/* Slots grid */}
                    <div className='space-y-1'>
                        <Label>Horarios disponibles</Label>

                        {isLoadingSlots && (
                            <div className='flex justify-center py-6'>
                                <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
                            </div>
                        )}

                        {!isLoadingSlots && slots.length === 0 && !error && (
                            <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900'>
                                <p className='text-sm text-zinc-500'>No hay horarios disponibles para este día.</p>
                            </div>
                        )}

                        {!isLoadingSlots && slots.length > 0 && (
                            <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 max-h-48 overflow-y-auto p-1'>
                                {slots.map(slot => (
                                    <Button
                                        key={slot.startAt}
                                        type='button'
                                        variant={selectedSlot?.startAt === slot.startAt ? 'default' : 'outline'}
                                        size='sm'
                                        onClick={() => setSelectedSlot(slot)}
                                        className='text-sm'
                                    >
                                        {slot.displayTime}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Confirm / Cancel buttons */}
                    <div className='flex gap-2'>
                        <Button
                            variant='outline'
                            className='flex-1'
                            onClick={() => {
                                setShowReschedule(false)
                                setSelectedSlot(null)
                                setError(null)
                            }}
                            disabled={busy}
                        >
                            Volver
                        </Button>
                        <Button className='flex-1' onClick={handleReschedule} disabled={!selectedSlot || busy}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                    Reprogramando…
                                </>
                            ) : (
                                'Confirmar nuevo horario'
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Action buttons (when slot picker is hidden) ── */}
            {!showReschedule && (
                <div className='space-y-3'>
                    <Button
                        variant='outline'
                        className='w-full'
                        onClick={() => {
                            setShowReschedule(true)
                            setError(null)
                        }}
                        disabled={busy}
                    >
                        Reprogramar turno
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant='destructive' className='w-full' disabled={busy}>
                                Cancelar turno
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Cancelar tu turno?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Tu turno será cancelado y el horario quedará
                                    libre.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Volver</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCancel} disabled={cancelling}>
                                    {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
    )
}
