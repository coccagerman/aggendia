'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AgendaFiltersProps {
    resources: { id: string; name: string; status: string }[]
    selectedDate: string
    selectedResourceId?: string
    resourceLabel: string
}

export function AgendaFilters({ resources, selectedDate, selectedResourceId, resourceLabel }: AgendaFiltersProps) {
    const router = useRouter()
    const pathname = usePathname()

    const updateFilters = useCallback(
        (date: string, resourceId?: string) => {
            const params = new URLSearchParams()
            params.set('date', date)
            if (resourceId) {
                params.set('resourceId', resourceId)
            }
            router.push(`${pathname}?${params.toString()}`)
        },
        [router, pathname]
    )

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value
        if (newDate) {
            updateFilters(newDate, selectedResourceId)
        }
    }

    const handleResourceChange = (value: string) => {
        const resourceId = value === 'all' ? undefined : value
        updateFilters(selectedDate, resourceId)
    }

    return (
        <div className='flex flex-col gap-4 sm:flex-row sm:items-end'>
            <div className='flex-1 space-y-2'>
                <Label htmlFor='date'>Fecha</Label>
                <Input
                    id='date'
                    type='date'
                    value={selectedDate}
                    onChange={handleDateChange}
                    className='w-full sm:w-auto'
                />
            </div>

            <div className='flex-1 space-y-2'>
                <Label htmlFor='resource'>{resourceLabel}</Label>
                <Select value={selectedResourceId || 'all'} onValueChange={handleResourceChange}>
                    <SelectTrigger id='resource' className='w-full'>
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
    )
}
