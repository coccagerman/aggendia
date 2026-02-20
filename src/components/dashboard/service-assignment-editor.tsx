'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { type Service } from '@/domain/services/service.types'

interface ServiceAssignmentEditorProps {
    businessId: string
    resourceId: string
    allServices: Service[]
    assignedServiceIds: string[]
}

export function ServiceAssignmentEditor({
    businessId,
    resourceId,
    allServices,
    assignedServiceIds
}: ServiceAssignmentEditorProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(assignedServiceIds))

    // Track previous assignedServiceIds to detect external changes
    const [prevAssignedIds, setPrevAssignedIds] = useState(assignedServiceIds)
    if (prevAssignedIds !== assignedServiceIds) {
        setPrevAssignedIds(assignedServiceIds)
        setSelectedIds(new Set(assignedServiceIds))
    }

    const handleToggle = (serviceId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(serviceId)) {
                next.delete(serviceId)
            } else {
                next.add(serviceId)
            }
            return next
        })
    }

    const handleSelectAll = () => {
        if (selectedIds.size === allServices.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(allServices.map(s => s.id)))
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/resources/${resourceId}/services`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ serviceIds: Array.from(selectedIds) })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Ocurrió un error al asignar servicios.')
                setIsSubmitting(false)
                return
            }

            setIsSubmitting(false)
            toast.success('Servicios actualizados correctamente')
            router.refresh()
        } catch (error) {
            console.error('Error al asignar servicios:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
            setIsSubmitting(false)
        }
    }

    const handleDiscard = () => {
        setSelectedIds(new Set(assignedServiceIds))
    }

    const hasChanges = (() => {
        if (selectedIds.size !== assignedServiceIds.length) return true
        return !assignedServiceIds.every(id => selectedIds.has(id))
    })()

    // Separar servicios activos e inactivos
    const activeServices = allServices.filter(s => s.status === 'ACTIVE')
    const inactiveServices = allServices.filter(s => s.status === 'INACTIVE')

    if (allServices.length === 0) {
        return (
            <div className='text-center py-8'>
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                    No hay servicios disponibles. Creá servicios primero para poder asignarlos a este recurso / prestador.
                </p>
            </div>
        )
    }

    return (
        <div className='space-y-6'>
            {/* Header con contador y seleccionar todos */}
            <div className='flex items-center justify-between border-b border-zinc-200 pb-4 dark:border-zinc-800'>
                <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                    {selectedIds.size} de {allServices.length} servicios seleccionados
                </span>
                <Button type='button' variant='ghost' size='sm' onClick={handleSelectAll} className='cursor-pointer'>
                    {selectedIds.size === allServices.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </Button>
            </div>

            {/* Lista de servicios activos */}
            {activeServices.length > 0 && (
                <div className='space-y-3'>
                    <h4 className='text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400'>
                        Servicios activos
                    </h4>
                    <div className='space-y-2'>
                        {activeServices.map(service => (
                            <div
                                key={service.id}
                                className='flex items-center space-x-3 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                            >
                                <Checkbox
                                    id={`service-${service.id}`}
                                    checked={selectedIds.has(service.id)}
                                    onCheckedChange={() => handleToggle(service.id)}
                                    className='cursor-pointer'
                                />
                                <Label
                                    htmlFor={`service-${service.id}`}
                                    className='flex-1 cursor-pointer text-sm font-medium'
                                >
                                    <span>{service.name}</span>
                                    <span className='ml-2 text-xs text-zinc-500'>
                                        ({service.durationMinutes} min
                                        {service.priceCents !== null &&
                                            ` · $${(service.priceCents / 100).toLocaleString('es-AR')}`}
                                        )
                                    </span>
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Lista de servicios inactivos */}
            {inactiveServices.length > 0 && (
                <div className='space-y-3'>
                    <h4 className='text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400'>
                        Servicios inactivos
                    </h4>
                    <div className='space-y-2'>
                        {inactiveServices.map(service => (
                            <div
                                key={service.id}
                                className='flex items-center space-x-3 rounded-md border border-zinc-200 p-3 opacity-60 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                            >
                                <Checkbox
                                    id={`service-${service.id}`}
                                    checked={selectedIds.has(service.id)}
                                    onCheckedChange={() => handleToggle(service.id)}
                                    className='cursor-pointer'
                                />
                                <Label
                                    htmlFor={`service-${service.id}`}
                                    className='flex-1 cursor-pointer text-sm font-medium'
                                >
                                    <span>{service.name}</span>
                                    <span className='ml-2 text-xs text-zinc-400'>(inactivo)</span>
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Botones de acción */}
            <div className='flex justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800'>
                <Button
                    type='button'
                    variant='outline'
                    onClick={handleDiscard}
                    disabled={!hasChanges || isSubmitting}
                    className='cursor-pointer'
                >
                    Descartar cambios
                </Button>
                <Button
                    type='button'
                    onClick={handleSubmit}
                    disabled={!hasChanges || isSubmitting}
                    className='cursor-pointer'
                >
                    {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            </div>
        </div>
    )
}
