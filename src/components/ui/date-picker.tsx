'use client'

import * as React from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type DatePickerMode = 'day' | 'week' | 'month'

interface DatePickerProps {
    value: Date
    onChange: (date: Date) => void
    mode: DatePickerMode
    className?: string
}

export function DatePicker({ value, onChange, mode, className }: DatePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [viewMonth, setViewMonth] = React.useState(value)

    // Update viewMonth when value changes externally
    React.useEffect(() => {
        setViewMonth(value)
    }, [value])

    const handleSelect = (date: Date | undefined) => {
        if (!date) return

        if (mode === 'day') {
            onChange(date)
            setOpen(false)
        } else if (mode === 'week') {
            // Select the Monday of the week
            const weekStart = startOfWeek(date, { weekStartsOn: 1, locale: es })
            onChange(weekStart)
            setOpen(false)
        } else if (mode === 'month') {
            // Select the first day of the month
            const monthStart = startOfMonth(date)
            onChange(monthStart)
            setOpen(false)
        }
    }

    const formatDisplayValue = () => {
        if (mode === 'day') {
            return format(value, "d 'de' MMMM, yyyy", { locale: es })
        } else if (mode === 'week') {
            const weekStart = startOfWeek(value, { weekStartsOn: 1, locale: es })
            const weekEnd = endOfWeek(value, { weekStartsOn: 1, locale: es })
            return `${format(weekStart, "d 'de' MMM", { locale: es })} - ${format(weekEnd, "d 'de' MMM, yyyy", { locale: es })}`
        } else {
            return format(value, 'MMMM yyyy', { locale: es })
        }
    }

    const months = [
        'Enero',
        'Febrero',
        'Marzo',
        'Abril',
        'Mayo',
        'Junio',
        'Julio',
        'Agosto',
        'Septiembre',
        'Octubre',
        'Noviembre',
        'Diciembre'
    ]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant='outline'
                    className={cn('justify-start text-left font-normal', !value && 'text-muted-foreground', className)}
                >
                    <CalendarIcon className='mr-2 h-4 w-4' />
                    <span className='capitalize'>{formatDisplayValue()}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0' align='start'>
                {mode === 'month' ? (
                    // Month picker grid
                    <div className='p-3'>
                        <div className='flex items-center justify-between mb-4'>
                            <Button
                                variant='outline'
                                size='icon'
                                className='h-7 w-7'
                                onClick={() => setViewMonth(subMonths(viewMonth, 12))}
                            >
                                <ChevronLeft className='h-4 w-4' />
                            </Button>
                            <span className='text-sm font-medium'>{viewMonth.getFullYear()}</span>
                            <Button
                                variant='outline'
                                size='icon'
                                className='h-7 w-7'
                                onClick={() => setViewMonth(addMonths(viewMonth, 12))}
                            >
                                <ChevronRight className='h-4 w-4' />
                            </Button>
                        </div>
                        <div className='grid grid-cols-3 gap-2'>
                            {months.map((month, index) => {
                                const isSelected =
                                    value.getMonth() === index && value.getFullYear() === viewMonth.getFullYear()
                                const isCurrentMonth =
                                    new Date().getMonth() === index &&
                                    new Date().getFullYear() === viewMonth.getFullYear()
                                return (
                                    <Button
                                        key={month}
                                        variant={isSelected ? 'default' : isCurrentMonth ? 'secondary' : 'ghost'}
                                        className='h-9 text-sm'
                                        onClick={() => {
                                            const newDate = new Date(viewMonth.getFullYear(), index, 1)
                                            onChange(newDate)
                                            setOpen(false)
                                        }}
                                    >
                                        {month.slice(0, 3)}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                    // Day or Week picker - use Calendar
                    <Calendar
                        mode='single'
                        selected={value}
                        onSelect={handleSelect}
                        month={viewMonth}
                        onMonthChange={setViewMonth}
                        initialFocus
                        weekHover={mode === 'week'}
                        modifiers={
                            mode === 'week'
                                ? {
                                      selectedWeek: {
                                          from: startOfWeek(value, { weekStartsOn: 1, locale: es }),
                                          to: endOfWeek(value, { weekStartsOn: 1, locale: es })
                                      }
                                  }
                                : undefined
                        }
                        modifiersClassNames={
                            mode === 'week'
                                ? {
                                      selectedWeek: 'bg-accent text-accent-foreground'
                                  }
                                : undefined
                        }
                        weekStartsOn={1}
                    />
                )}
            </PopoverContent>
        </Popover>
    )
}
