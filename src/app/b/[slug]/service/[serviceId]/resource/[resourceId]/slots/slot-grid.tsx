'use client'

import { useMemo, useState, useEffect } from 'react'
import { addDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { Calendar } from '@/components/ui/calendar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatInTimeZone } from 'date-fns-tz'
import {
    getAdjacentDateKeys,
    getDateHeader,
    getFirstAvailableDateKey,
    getNextAvailableDateKey,
    groupSlotsByBusinessDate,
    isDateInRange
} from './slot-grid.utils'

interface Slot {
    startAt: string // ISO 8601 UTC
    endAt: string
    displayTime: string // HH:mm in business timezone
}

interface SlotGridProps {
    slug: string
    serviceId: string
    resourceId: string
    fromDate: string // ISO 8601
    toDate: string // ISO 8601
    businessTimezone: string
}

export function SlotGrid({ slug, serviceId, resourceId, fromDate, toDate, businessTimezone }: SlotGridProps) {
    const router = useRouter()
    const [slots, setSlots] = useState<Slot[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)

    useEffect(() => {
        async function fetchSlots() {
            try {
                setLoading(true)
                setError(null)

                const params = new URLSearchParams({
                    slug,
                    serviceId,
                    resourceId,
                    fromDate,
                    toDate
                })

                const response = await fetch(`/api/v1/public/slots?${params}`)

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error?.message || 'Error al cargar horarios')
                }

                const data = await response.json()
                setSlots(data.data || [])
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error desconocido')
            } finally {
                setLoading(false)
            }
        }

        fetchSlots()
    }, [slug, serviceId, resourceId, fromDate, toDate])

    function handleSlotClick(slot: Slot) {
        // Navigate to booking confirmation page with slot data
        const bookingUrl = `/b/${slug}/book?serviceId=${serviceId}&resourceId=${resourceId}&startAt=${encodeURIComponent(
            slot.startAt
        )}`
        router.push(bookingUrl)
    }

    const fromDateObj = useMemo(() => parseISO(fromDate), [fromDate])
    const toDateObj = useMemo(() => parseISO(toDate), [toDate])

    const slotsByDate = useMemo(() => groupSlotsByBusinessDate(slots, businessTimezone), [slots, businessTimezone])

    const availableDateKeys = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate])

    useEffect(() => {
        if (availableDateKeys.length === 0) {
            setSelectedDateKey(null)
            return
        }

        if (!selectedDateKey || !slotsByDate[selectedDateKey]?.length) {
            const fallbackDate = getFirstAvailableDateKey(availableDateKeys)
            setSelectedDateKey(fallbackDate)
        }
    }, [availableDateKeys, selectedDateKey, slotsByDate])

    const adjacentDateKeys = useMemo(() => {
        if (!selectedDateKey) {
            return { previousDateKey: null, nextDateKey: null }
        }

        return getAdjacentDateKeys(availableDateKeys, selectedDateKey)
    }, [availableDateKeys, selectedDateKey])

    function handleSelectDate(date: Date | undefined) {
        if (!date) {
            return
        }

        const key = formatInTimeZone(date, businessTimezone, 'yyyy-MM-dd')
        if (slotsByDate[key]?.length) {
            setSelectedDateKey(key)
        }
    }

    function goToNextAvailableDate(direction: 'previous' | 'next') {
        if (!selectedDateKey) {
            return
        }

        const nextKey = getNextAvailableDateKey(availableDateKeys, selectedDateKey, direction)
        if (nextKey) {
            setSelectedDateKey(nextKey)
        }
    }

    function isCalendarDateEnabled(date: Date) {
        if (!isDateInRange(date, fromDateObj, toDateObj)) {
            return false
        }

        const key = formatInTimeZone(date, businessTimezone, 'yyyy-MM-dd')
        return Boolean(slotsByDate[key]?.length)
    }

    if (loading) {
        return (
            <div className='flex justify-center py-12'>
                <div className='h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50' />
            </div>
        )
    }

    if (error) {
        return (
            <div className='rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950'>
                <p className='text-sm text-red-800 dark:text-red-200'>{error}</p>
            </div>
        )
    }

    if (slots.length === 0) {
        return (
            <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900'>
                <p className='text-zinc-600 dark:text-zinc-400'>
                    No hay horarios disponibles en este momento.
                    <br />
                    <span className='text-sm'>Probá seleccionando otro recurso / prestador o contactá al negocio.</span>
                </p>
            </div>
        )
    }

    return (
        <div className='space-y-6'>
            <div className='rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'>
                <p className='mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50'>Seleccioná un día</p>
                <TooltipProvider>
                    <Calendar
                        mode='single'
                        selected={selectedDateKey ? parseISO(`${selectedDateKey}T00:00:00`) : undefined}
                        onSelect={handleSelectDate}
                        locale={es}
                        showOutsideDays={false}
                        fromDate={fromDateObj}
                        toDate={addDays(toDateObj, -1)}
                        disabled={date => !isCalendarDateEnabled(date)}
                        className='mx-auto w-full max-w-3xl'
                        classNames={{
                            months: 'flex w-full justify-center',
                            month: 'w-full max-w-xl',
                            month_caption: 'mb-3 flex h-9 items-center justify-center',
                            caption_label: 'text-base font-semibold capitalize',
                            weekdays: 'mb-2 flex w-full justify-between',
                            weekday: 'w-10 text-center text-sm',
                            week: 'mt-2 flex w-full justify-between',
                            day: 'h-10 w-10 text-center',
                            day_button: 'h-10 w-10 p-0 text-base font-medium aria-selected:opacity-100',
                            disabled: 'text-muted-foreground opacity-40'
                        }}
                        components={{
                            DayButton: ({ day, modifiers, ...props }) => {
                                const isDisabled = Boolean(modifiers.disabled)
                                const dayKey = formatInTimeZone(day.date, businessTimezone, 'yyyy-MM-dd')
                                const hasSlots = Boolean(slotsByDate[dayKey]?.length)

                                const button = <button {...props} />

                                if (!isDisabled || hasSlots) {
                                    return button
                                }

                                return (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className='inline-flex'>{button}</span>
                                        </TooltipTrigger>
                                        <TooltipContent>No hay turnos disponibles este día</TooltipContent>
                                    </Tooltip>
                                )
                            }
                        }}
                    />
                </TooltipProvider>
            </div>

            {selectedDateKey ? (
                <div className='space-y-4'>
                    <div className='flex items-center justify-between gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => goToNextAvailableDate('previous')}
                            disabled={!adjacentDateKeys.previousDateKey}
                            className='gap-1'
                        >
                            <ChevronLeft className='h-4 w-4' />
                            Día con turnos anterior
                        </Button>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => goToNextAvailableDate('next')}
                            disabled={!adjacentDateKeys.nextDateKey}
                            className='gap-1'
                        >
                            Día con turnos siguiente
                            <ChevronRight className='h-4 w-4' />
                        </Button>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-[0.95fr_1.1fr_0.95fr]'>
                        <DaySlotsPanel
                            title='Día anterior'
                            dateKey={adjacentDateKeys.previousDateKey}
                            slots={
                                adjacentDateKeys.previousDateKey
                                    ? (slotsByDate[adjacentDateKeys.previousDateKey] ?? [])
                                    : []
                            }
                            businessTimezone={businessTimezone}
                            onSlotClick={handleSlotClick}
                            className='order-2 lg:order-1'
                        />
                        <DaySlotsPanel
                            title='Día seleccionado'
                            dateKey={selectedDateKey}
                            slots={slotsByDate[selectedDateKey] ?? []}
                            businessTimezone={businessTimezone}
                            onSlotClick={handleSlotClick}
                            className='order-1 lg:order-2 lg:scale-[1.05]'
                            highlighted
                        />
                        <DaySlotsPanel
                            title='Día posterior'
                            dateKey={adjacentDateKeys.nextDateKey}
                            slots={
                                adjacentDateKeys.nextDateKey ? (slotsByDate[adjacentDateKeys.nextDateKey] ?? []) : []
                            }
                            businessTimezone={businessTimezone}
                            onSlotClick={handleSlotClick}
                            className='order-3 lg:order-3'
                        />
                    </div>
                </div>
            ) : (
                <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900'>
                    <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                        No hay días con turnos disponibles en los próximos 30 días.
                    </p>
                </div>
            )}
        </div>
    )
}

type DaySlotsPanelProps = {
    title: string
    dateKey: string | null
    slots: Slot[]
    businessTimezone: string
    onSlotClick: (slot: Slot) => void
    className?: string
    highlighted?: boolean
}

function DaySlotsPanel({
    title,
    dateKey,
    slots,
    businessTimezone,
    onSlotClick,
    className,
    highlighted = false
}: DaySlotsPanelProps) {
    const panelClassName = highlighted
        ? 'border-zinc-400 bg-zinc-50 shadow-lg ring-2 ring-zinc-200 dark:border-zinc-600 dark:bg-zinc-900 dark:ring-zinc-700'
        : 'border-zinc-200 dark:border-zinc-800'

    const titleClassName = highlighted
        ? 'mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200'
        : 'mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500'

    const dateClassName = highlighted
        ? 'mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50'
        : 'mb-3 font-medium text-zinc-900 dark:text-zinc-50'

    return (
        <div className={`rounded-lg border p-4 transition-transform ${panelClassName} ${className ?? ''}`}>
            <p className={titleClassName}>{title}</p>
            <h3 className={dateClassName}>
                {dateKey ? getDateHeader(dateKey, businessTimezone) : 'Sin disponibilidad'}
            </h3>

            {slots.length > 0 ? (
                <div className='grid grid-cols-3 gap-2'>
                    {slots.map(slot => (
                        <Button
                            key={slot.startAt}
                            variant='outline'
                            onClick={() => onSlotClick(slot)}
                            className='cursor-pointer hover:border-zinc-900 hover:bg-zinc-100 dark:hover:border-zinc-50 dark:hover:bg-zinc-800'
                        >
                            {slot.displayTime}
                        </Button>
                    ))}
                </div>
            ) : (
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>No hay horarios disponibles.</p>
            )}
        </div>
    )
}
