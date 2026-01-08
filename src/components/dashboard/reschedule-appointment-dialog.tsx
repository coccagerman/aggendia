'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RefreshCw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Slot {
    startAt: string // ISO 8601 UTC
    endAt: string
    displayTime: string // HH:mm in business timezone
}

interface RescheduleAppointmentDialogProps {
    appointmentId: string
    businessId: string
    slug: string
    serviceId: string
    resourceId: string
    customerName: string
    serviceName: string
    resourceName: string
    currentTimeRange: string
    timezone: string
}

const MAX_DAYS_AHEAD = 30

export function RescheduleAppointmentDialog({
    appointmentId,
    businessId,
    slug,
    serviceId,
    resourceId,
    customerName,
    serviceName,
    resourceName,
    currentTimeRange,
    timezone
}: RescheduleAppointmentDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [slots, setSlots] = useState<Slot[]>([])

    // Calculate "today" in business timezone for date limits
    const getTodayInBusinessTz = useCallback(() => {
        const nowInTz = toZonedTime(new Date(), timezone)
        return format(nowInTz, 'yyyy-MM-dd')
    }, [timezone])

    // Date selection state - initialize with today in business timezone
    const [selectedDate, setSelectedDate] = useState<string>(() => getTodayInBusinessTz())

    // Selected slot
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

    // Fetch slots when dialog opens or date changes
    const fetchSlots = useCallback(async () => {
        if (!open) return

        setIsLoadingSlots(true)
        setError(null)
        setSelectedSlot(null)

        try {
            // Convert selected date to UTC range in business timezone
            // selectedDate is YYYY-MM-DD in business timezone
            // We need to get the UTC equivalent of 00:00 and 24:00 in that timezone
            const fromDateInTz = fromZonedTime(`${selectedDate}T00:00:00`, timezone)
            const toDateInTz = fromZonedTime(`${selectedDate}T00:00:00`, timezone)
            const toDate = addDays(toDateInTz, 1)

            const params = new URLSearchParams({
                slug,
                serviceId,
                resourceId,
                fromDate: fromDateInTz.toISOString(),
                toDate: toDate.toISOString()
            })

            const response = await fetch(`/api/v1/public/slots?${params}`)

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error?.message || 'Error al cargar horarios')
            }

            const data = await response.json()
            setSlots(data.data || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar horarios')
            setSlots([])
        } finally {
            setIsLoadingSlots(false)
        }
    }, [open, selectedDate, slug, serviceId, resourceId, timezone])

    useEffect(() => {
        fetchSlots()
    }, [fetchSlots])

    async function handleReschedule() {
        if (!selectedSlot) return

        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/reschedule`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    newStartAt: selectedSlot.startAt
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error?.message || 'Error al reprogramar el turno')
            }

            // Close dialog and refresh page to show updated status
            setOpen(false)
            setSelectedSlot(null)
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al reprogramar el turno')
        } finally {
            setIsSubmitting(false)
        }
    }

    function handleOpenChange(newOpen: boolean) {
        if (!isSubmitting) {
            setOpen(newOpen)
            if (!newOpen) {
                setError(null)
                setSelectedSlot(null)
                // Reset to today (in business timezone) when closing
                setSelectedDate(getTodayInBusinessTz())
            }
        }
    }

    function handlePreviousDay() {
        // selectedDate is YYYY-MM-DD in business timezone
        // Calculate yesterday by parsing in business TZ context
        const today = getTodayInBusinessTz()
        const currentDateParts = selectedDate.split('-').map(Number)
        const currentDateObj = new Date(currentDateParts[0], currentDateParts[1] - 1, currentDateParts[2])
        currentDateObj.setDate(currentDateObj.getDate() - 1)
        const yesterday = format(currentDateObj, 'yyyy-MM-dd')

        // Don't allow selecting dates before today (in business timezone)
        if (yesterday >= today) {
            setSelectedDate(yesterday)
        }
    }

    function handleNextDay() {
        // selectedDate is YYYY-MM-DD in business timezone
        const today = getTodayInBusinessTz()
        const currentDateParts = selectedDate.split('-').map(Number)
        const currentDateObj = new Date(currentDateParts[0], currentDateParts[1] - 1, currentDateParts[2])
        currentDateObj.setDate(currentDateObj.getDate() + 1)
        const nextDay = format(currentDateObj, 'yyyy-MM-dd')

        // Calculate max date limit in business TZ
        const todayParts = today.split('-').map(Number)
        const todayObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2])
        todayObj.setDate(todayObj.getDate() + MAX_DAYS_AHEAD)
        const maxDateLimit = format(todayObj, 'yyyy-MM-dd')

        // Don't allow selecting dates beyond MAX_DAYS_AHEAD from today
        if (nextDay <= maxDateLimit) {
            setSelectedDate(nextDay)
        }
    }

    function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newDate = e.target.value
        if (newDate) {
            const today = getTodayInBusinessTz()
            const todayParts = today.split('-').map(Number)
            const todayObj = new Date(todayParts[0], todayParts[1] - 1, todayParts[2])
            todayObj.setDate(todayObj.getDate() + MAX_DAYS_AHEAD)
            const maxDateLimit = format(todayObj, 'yyyy-MM-dd')

            // Validate date is within allowed range (today to MAX_DAYS_AHEAD)
            if (newDate >= today && newDate <= maxDateLimit) {
                setSelectedDate(newDate)
            }
        }
    }

    // Calculate min and max dates for the date input (in business timezone)
    const minDate = getTodayInBusinessTz()
    const minDateParts = minDate.split('-').map(Number)
    const minDateObj = new Date(minDateParts[0], minDateParts[1] - 1, minDateParts[2])
    minDateObj.setDate(minDateObj.getDate() + MAX_DAYS_AHEAD)
    const maxDate = format(minDateObj, 'yyyy-MM-dd')

    // Check if navigation buttons should be disabled
    const isPreviousDisabled = selectedDate <= minDate
    const isNextDisabled = selectedDate >= maxDate

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20'
                >
                    <RefreshCw className='h-4 w-4 mr-1' />
                    Reprogramar
                </Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>Reprogramar turno</DialogTitle>
                    <DialogDescription asChild>
                        <div className='space-y-1'>
                            <p>
                                <strong>{customerName}</strong> — {serviceName}
                            </p>
                            <p className='text-sm text-zinc-500'>
                                {resourceName} · Horario actual: {currentTimeRange}
                            </p>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4 py-4'>
                    {/* Date selector */}
                    <div className='space-y-2'>
                        <Label htmlFor='reschedule-date'>Seleccionar fecha</Label>
                        <div className='flex items-center gap-2'>
                            <Button
                                type='button'
                                variant='outline'
                                size='icon'
                                onClick={handlePreviousDay}
                                disabled={isPreviousDisabled || isLoadingSlots}
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
                                disabled={isNextDisabled || isLoadingSlots}
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
                    <div className='space-y-2'>
                        <Label>Horarios disponibles</Label>

                        {isLoadingSlots && (
                            <div className='flex justify-center py-8'>
                                <Loader2 className='h-6 w-6 animate-spin text-zinc-400' />
                            </div>
                        )}

                        {!isLoadingSlots && slots.length === 0 && !error && (
                            <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900'>
                                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                                    No hay horarios disponibles para este día.
                                </p>
                            </div>
                        )}

                        {!isLoadingSlots && slots.length > 0 && (
                            <div className='grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1'>
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

                    {/* Error message */}
                    {error && (
                        <div className='rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950'>
                            <p className='text-sm text-red-800 dark:text-red-200'>{error}</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type='button'
                        onClick={handleReschedule}
                        disabled={!selectedSlot || isSubmitting || isLoadingSlots}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Reprogramando...
                            </>
                        ) : (
                            'Confirmar'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
