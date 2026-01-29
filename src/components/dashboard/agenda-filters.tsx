'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DatePicker } from '@/components/ui/date-picker'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { addDaysToDateString, addMonthsToDateString, getWeekStartDate, getMonthStartDate } from '@/lib/timezone'
import { APPOINTMENT_STATUSES, statusConfig, serializeStatusFilter } from '@/lib/appointments'
import type { AppointmentStatus } from '@prisma/client'

export type AgendaView = 'day' | 'week' | 'month'

const viewLabels: Record<AgendaView, string> = {
    day: 'Día',
    week: 'Semana',
    month: 'Mes'
}

interface AgendaFiltersProps {
    resources: { id: string; name: string; status: string }[]
    selectedDate: string
    selectedResourceId?: string
    selectedView: AgendaView
    resourceLabel: string
    /** Active status filters */
    activeStatuses: AppointmentStatus[]
    /** Counts of appointments by status (for badges) */
    statusCounts?: Record<AppointmentStatus, number>
}

export function AgendaFilters({
    resources,
    selectedDate,
    selectedResourceId,
    selectedView,
    resourceLabel,
    activeStatuses,
    statusCounts = { SCHEDULED: 0, CANCELLED: 0, RESCHEDULED: 0, COMPLETED: 0 }
}: AgendaFiltersProps) {
    const router = useRouter()
    const pathname = usePathname()

    const updateFilters = useCallback(
        (date: string, resourceId?: string, view?: AgendaView, statuses?: AppointmentStatus[]) => {
            const params = new URLSearchParams()
            params.set('date', date)
            if (resourceId) {
                params.set('resourceId', resourceId)
            }
            if (view && view !== 'day') {
                params.set('view', view)
            }
            const statusParam = serializeStatusFilter(statuses ?? activeStatuses)
            if (statusParam) {
                params.set('status', statusParam)
            }
            router.push(`${pathname}?${params.toString()}`)
        },
        [router, pathname, activeStatuses]
    )

    // Convert string date to Date object for the picker
    const dateValue = useMemo(() => {
        return new Date(selectedDate + 'T12:00:00')
    }, [selectedDate])

    const handleDatePickerChange = (date: Date) => {
        const newDate = date.toISOString().split('T')[0]
        updateFilters(newDate, selectedResourceId, selectedView, activeStatuses)
    }

    const handleResourceChange = (value: string) => {
        const resourceId = value === 'all' ? undefined : value
        updateFilters(selectedDate, resourceId, selectedView, activeStatuses)
    }

    const handleViewChange = (value: AgendaView) => {
        // When changing view, adjust date to appropriate start
        let adjustedDate = selectedDate
        if (value === 'week') {
            adjustedDate = getWeekStartDate(selectedDate)
        } else if (value === 'month') {
            adjustedDate = getMonthStartDate(selectedDate)
        }
        updateFilters(adjustedDate, selectedResourceId, value, activeStatuses)
    }

    const handleStatusToggle = (status: AppointmentStatus) => {
        let newStatuses: AppointmentStatus[]

        if (activeStatuses.includes(status)) {
            // Don't allow deselecting the last status
            if (activeStatuses.length === 1) {
                return
            }
            newStatuses = activeStatuses.filter(s => s !== status)
        } else {
            newStatuses = [...activeStatuses, status]
        }

        updateFilters(selectedDate, selectedResourceId, selectedView, newStatuses)
    }

    const handleSelectAllStatuses = (checked: boolean) => {
        // When clicking "Todos", always select all statuses
        if (checked || !allStatusesSelected) {
            updateFilters(selectedDate, selectedResourceId, selectedView, [...APPOINTMENT_STATUSES])
        }
    }

    const allStatusesSelected = activeStatuses.length === APPOINTMENT_STATUSES.length

    const handlePrevious = () => {
        let newDate: string
        switch (selectedView) {
            case 'day':
                newDate = addDaysToDateString(selectedDate, -1)
                break
            case 'week':
                newDate = addDaysToDateString(selectedDate, -7)
                break
            case 'month':
                newDate = addMonthsToDateString(selectedDate, -1)
                break
        }
        updateFilters(newDate, selectedResourceId, selectedView, activeStatuses)
    }

    const handleNext = () => {
        let newDate: string
        switch (selectedView) {
            case 'day':
                newDate = addDaysToDateString(selectedDate, 1)
                break
            case 'week':
                newDate = addDaysToDateString(selectedDate, 7)
                break
            case 'month':
                newDate = addMonthsToDateString(selectedDate, 1)
                break
        }
        updateFilters(newDate, selectedResourceId, selectedView, activeStatuses)
    }

    const viewLabel = viewLabels[selectedView]
    const prevTooltip = `${viewLabel} anterior`
    const nextTooltip = `${viewLabel} siguiente`

    return (
        <div className='space-y-4'>
            {/* Date, navigation buttons, and resource/view filters */}
            <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                {/* Left side: Date picker with arrows + Granularity below */}
                <div className='space-y-2'>
                    {/* Date picker with navigation buttons on the right */}
                    <div className='space-y-2'>
                        <Label>{viewLabel}</Label>
                        <div className='flex items-center gap-2'>
                            <DatePicker
                                value={dateValue}
                                onChange={handleDatePickerChange}
                                mode={selectedView}
                                className='w-full sm:w-auto'
                            />
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant='outline'
                                        size='icon'
                                        onClick={handlePrevious}
                                        aria-label={prevTooltip}
                                    >
                                        <ChevronLeft className='h-4 w-4' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side='bottom'>{prevTooltip}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant='outline' size='icon' onClick={handleNext} aria-label={nextTooltip}>
                                        <ChevronRight className='h-4 w-4' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side='bottom'>{nextTooltip}</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* View selector (granularity) below date */}
                    <div className='space-y-2'>
                        <Label htmlFor='view'>Granularidad</Label>
                        <Select value={selectedView} onValueChange={handleViewChange}>
                            <SelectTrigger id='view' className='w-full cursor-pointer sm:w-32'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='day'>Día</SelectItem>
                                <SelectItem value='week'>Semana</SelectItem>
                                <SelectItem value='month'>Mes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Right side: Resource filter + Status filter */}
                <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4'>
                    {/* Status filter dropdown */}
                    <div className='space-y-2'>
                        <Label>Estado</Label>
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                                <Button variant='outline' className='w-full cursor-pointer justify-between sm:w-48'>
                                    <span className='flex items-center gap-2'>
                                        <Filter className='h-4 w-4' />
                                        {allStatusesSelected
                                            ? 'Todos'
                                            : activeStatuses.length === 1
                                              ? statusConfig[activeStatuses[0]].label
                                              : `${activeStatuses.length} seleccionados`}
                                    </span>
                                    <ChevronDown className='h-4 w-4 opacity-50' />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end' className='w-56'>
                                <DropdownMenuCheckboxItem
                                    checked={allStatusesSelected}
                                    onCheckedChange={handleSelectAllStatuses}
                                    onSelect={e => e.preventDefault()}
                                >
                                    <span className='font-medium'>Todos</span>
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                {APPOINTMENT_STATUSES.map(status => {
                                    const config = statusConfig[status]
                                    const isActive = activeStatuses.includes(status)
                                    const count = statusCounts[status]

                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={status}
                                            checked={isActive}
                                            onCheckedChange={() => handleStatusToggle(status)}
                                            onSelect={e => e.preventDefault()}
                                        >
                                            <span className='flex items-center gap-2'>
                                                <span
                                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
                                                >
                                                    {config.label}
                                                </span>
                                                {count > 0 && <span className='text-xs text-zinc-500'>({count})</span>}
                                            </span>
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Resource filter */}
                    <div className='space-y-2 sm:w-64'>
                        <Label htmlFor='resource'>{resourceLabel}</Label>
                        <Select value={selectedResourceId || 'all'} onValueChange={handleResourceChange}>
                            <SelectTrigger id='resource' className='w-full cursor-pointer'>
                                <SelectValue placeholder={`Todos los ${resourceLabel.toLowerCase()}s`} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>Todos</SelectItem>
                                {resources.map(resource => (
                                    <SelectItem key={resource.id} value={resource.id}>
                                        {resource.name}
                                        {resource.status === 'INACTIVE' && (
                                            <span className='ml-2 text-xs text-zinc-400'>(inactivo)</span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </div>
    )
}
