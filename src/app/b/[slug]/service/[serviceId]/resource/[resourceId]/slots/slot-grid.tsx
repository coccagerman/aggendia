'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

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

export function SlotGrid({ slug, serviceId, resourceId, fromDate, toDate }: SlotGridProps) {
    const router = useRouter()
    const [slots, setSlots] = useState<Slot[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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

    // Group slots by date
    const slotsByDate = slots.reduce((acc, slot) => {
        const date = format(parseISO(slot.startAt), 'yyyy-MM-dd')
        if (!acc[date]) {
            acc[date] = []
        }
        acc[date].push(slot)
        return acc
    }, {} as Record<string, Slot[]>)

    const dates = Object.keys(slotsByDate).sort()

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
            {dates.map(date => {
                const dateSlots = slotsByDate[date]
                const dateObj = parseISO(date)

                return (
                    <div key={date}>
                        {/* Date header */}
                        <h3 className='mb-3 font-medium text-zinc-900 dark:text-zinc-50'>
                            {format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
                        </h3>

                        {/* Slots grid */}
                        <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6'>
                            {dateSlots.map(slot => (
                                <Button
                                    key={slot.startAt}
                                    variant='outline'
                                    onClick={() => handleSlotClick(slot)}
                                    className='cursor-pointer hover:border-zinc-900 hover:bg-zinc-100 dark:hover:border-zinc-50 dark:hover:bg-zinc-800'
                                >
                                    {slot.displayTime}
                                </Button>
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
