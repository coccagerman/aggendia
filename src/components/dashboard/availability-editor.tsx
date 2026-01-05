'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import {
    DAYS_OF_WEEK,
    DAYS_OF_WEEK_DISPLAY_ORDER,
    DAY_NAMES,
    DayOfWeek,
    minutesToTime,
    timeToMinutes,
    MAX_RANGES_PER_DAY
} from '@/domain/availability/availability.types'

interface AvailabilityRange {
    id?: string
    dayOfWeek: DayOfWeek
    startMinutes: number
    endMinutes: number
}

interface AvailabilityEditorProps {
    businessId: string
    resourceId: string
    initialRanges: AvailabilityRange[]
}

interface DayErrors {
    [rangeIndex: number]: string
}

export function AvailabilityEditor({ businessId, resourceId, initialRanges }: AvailabilityEditorProps) {
    const router = useRouter()
    const [ranges, setRanges] = useState<AvailabilityRange[]>(initialRanges)
    const [isSaving, setIsSaving] = useState(false)
    const [errors, setErrors] = useState<Record<DayOfWeek, DayErrors>>({} as Record<DayOfWeek, DayErrors>)
    const [hasChanges, setHasChanges] = useState(false)

    const getRangesForDay = (day: DayOfWeek) => {
        return ranges
            .map((r, originalIndex) => ({ ...r, originalIndex }))
            .filter(r => r.dayOfWeek === day)
            .sort((a, b) => a.startMinutes - b.startMinutes)
    }

    const handleAddRange = (day: DayOfWeek) => {
        const dayRanges = getRangesForDay(day)
        if (dayRanges.length >= MAX_RANGES_PER_DAY) {
            toast.error(`Máximo ${MAX_RANGES_PER_DAY} rangos por día`)
            return
        }

        // Default: 09:00-18:00 or after last range
        let startMinutes = 540 // 09:00
        let endMinutes = 1080 // 18:00

        if (dayRanges.length > 0) {
            const lastRange = dayRanges[dayRanges.length - 1]
            startMinutes = lastRange.endMinutes
            endMinutes = Math.min(startMinutes + 60, 1440)
        }

        setRanges([...ranges, { dayOfWeek: day, startMinutes, endMinutes }])
        setHasChanges(true)
    }

    const handleRemoveRange = (index: number) => {
        setRanges(ranges.filter((_, i) => i !== index))
        setHasChanges(true)
    }

    const handleTimeChange = (index: number, field: 'startMinutes' | 'endMinutes', timeStr: string) => {
        const minutes = timeToMinutes(timeStr)
        const newRanges = [...ranges]
        newRanges[index] = { ...newRanges[index], [field]: minutes }
        setRanges(newRanges)
        setHasChanges(true)

        // Clear error for this range
        const day = newRanges[index].dayOfWeek
        if (errors[day]) {
            const dayRangesWithIndex = getRangesForDay(day)
            const rangeIndexInDay = dayRangesWithIndex.findIndex(r => r.originalIndex === index)
            if (rangeIndexInDay >= 0 && errors[day][rangeIndexInDay]) {
                const newDayErrors = { ...errors[day] }
                delete newDayErrors[rangeIndexInDay]
                setErrors({ ...errors, [day]: newDayErrors })
            }
        }
    }

    const validateRanges = (): boolean => {
        const newErrors: Record<DayOfWeek, DayErrors> = {} as Record<DayOfWeek, DayErrors>
        let isValid = true

        for (const day of DAYS_OF_WEEK) {
            const dayRanges = getRangesForDay(day)
            const dayErrors: DayErrors = {}

            for (let i = 0; i < dayRanges.length; i++) {
                const range = dayRanges[i]

                // Check start < end
                if (range.startMinutes >= range.endMinutes) {
                    dayErrors[i] = 'El inicio debe ser menor que el fin'
                    isValid = false
                    continue
                }

                // Check overlap with previous ranges
                for (let j = 0; j < i; j++) {
                    const prev = dayRanges[j]
                    if (range.startMinutes < prev.endMinutes && prev.startMinutes < range.endMinutes) {
                        dayErrors[i] = 'Se solapa con otro rango'
                        isValid = false
                        break
                    }
                }
            }

            if (Object.keys(dayErrors).length > 0) {
                newErrors[day] = dayErrors
            }
        }

        setErrors(newErrors)
        return isValid
    }

    const handleSave = async () => {
        if (!validateRanges()) {
            toast.error('Corregí los errores antes de guardar')
            return
        }

        setIsSaving(true)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/resources/${resourceId}/availability`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ranges: ranges.map(r => ({
                        dayOfWeek: r.dayOfWeek,
                        startMinutes: r.startMinutes,
                        endMinutes: r.endMinutes
                    }))
                })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Error al guardar la disponibilidad')
                return
            }

            toast.success('Disponibilidad guardada')
            setHasChanges(false)
            router.refresh()
        } catch (error) {
            console.error('Error al guardar disponibilidad:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDiscard = () => {
        setRanges(initialRanges)
        setErrors({} as Record<DayOfWeek, DayErrors>)
        setHasChanges(false)
    }

    return (
        <div className='space-y-6'>
            {DAYS_OF_WEEK_DISPLAY_ORDER.map(day => {
                const dayRanges = getRangesForDay(day)
                const dayErrors = errors[day] || {}

                return (
                    <div key={day} className='rounded-lg border border-zinc-200 p-4 dark:border-zinc-800'>
                        <div className='flex items-center justify-between mb-3'>
                            <h3 className='font-medium text-zinc-900 dark:text-zinc-50'>{DAY_NAMES[day]}</h3>
                            <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => handleAddRange(day)}
                                disabled={dayRanges.length >= MAX_RANGES_PER_DAY}
                                className='cursor-pointer'
                            >
                                <Plus className='h-4 w-4 mr-1' />
                                Agregar
                            </Button>
                        </div>

                        {dayRanges.length === 0 ? (
                            <p className='text-sm text-zinc-500 dark:text-zinc-400 italic'>Sin horarios definidos</p>
                        ) : (
                            <div className='space-y-2'>
                                {dayRanges.map((range, indexInDay) => (
                                    <div key={range.originalIndex}>
                                        <div className='flex items-center gap-2'>
                                            <Input
                                                type='time'
                                                value={minutesToTime(range.startMinutes)}
                                                onChange={e =>
                                                    handleTimeChange(
                                                        range.originalIndex,
                                                        'startMinutes',
                                                        e.target.value
                                                    )
                                                }
                                                className='w-32'
                                            />
                                            <span className='text-zinc-500'>—</span>
                                            <Input
                                                type='time'
                                                value={minutesToTime(range.endMinutes)}
                                                onChange={e =>
                                                    handleTimeChange(range.originalIndex, 'endMinutes', e.target.value)
                                                }
                                                className='w-32'
                                            />
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => handleRemoveRange(range.originalIndex)}
                                                className='cursor-pointer text-zinc-500 hover:text-red-600'
                                            >
                                                <Trash2 className='h-4 w-4' />
                                            </Button>
                                        </div>
                                        {dayErrors[indexInDay] && (
                                            <p className='text-sm text-red-600 dark:text-red-400 mt-1'>
                                                {dayErrors[indexInDay]}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Actions */}
            <div className='flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800'>
                <Button
                    type='button'
                    variant='outline'
                    onClick={handleDiscard}
                    disabled={!hasChanges || isSaving}
                    className='cursor-pointer'
                >
                    Descartar cambios
                </Button>
                <Button
                    type='button'
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    className='cursor-pointer'
                >
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            </div>
        </div>
    )
}
