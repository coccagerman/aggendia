'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Users } from 'lucide-react'
import { type Service } from '@/domain/services/service.types'
import { type Resource } from '@/domain/resources/resource.types'

interface AssignResourcesDialogProps {
    service: Service
    allResources: Resource[]
    assignedResourceIds: string[]
    resourceCount?: number
}

export function AssignResourcesDialog({
    service,
    allResources,
    assignedResourceIds,
    resourceCount
}: AssignResourcesDialogProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(assignedResourceIds))

    // Track previous assignedResourceIds to detect changes
    const [prevAssignedIds, setPrevAssignedIds] = useState(assignedResourceIds)
    if (prevAssignedIds !== assignedResourceIds) {
        setPrevAssignedIds(assignedResourceIds)
        setSelectedIds(new Set(assignedResourceIds))
    }

    const [open, setOpen] = useState(false)

    const handleToggle = (resourceId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(resourceId)) {
                next.delete(resourceId)
            } else {
                next.add(resourceId)
            }
            return next
        })
    }

    const handleSelectAll = () => {
        if (selectedIds.size === allResources.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(allResources.map(r => r.id)))
        }
    }

    const handleSubmit = async () => {
        setIsSubmitting(true)

        try {
            const response = await fetch(`/api/v1/businesses/${service.businessId}/services/${service.id}/resources`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ resourceIds: Array.from(selectedIds) })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Ocurrió un error al asignar recursos / prestadores.')
                setIsSubmitting(false)
                return
            }

            setOpen(false)
            setIsSubmitting(false)
            toast.success('Recursos / prestadores actualizados correctamente')
            router.refresh()
        } catch (error) {
            console.error('Error al asignar recursos / prestadores:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
            setIsSubmitting(false)
        }
    }

    const hasChanges = (() => {
        if (selectedIds.size !== assignedResourceIds.length) return true
        return !assignedResourceIds.every(id => selectedIds.has(id))
    })()

    // Separar recursos / prestadores activos e inactivos
    const activeResources = allResources.filter(r => r.status === 'ACTIVE')
    const inactiveResources = allResources.filter(r => r.status === 'INACTIVE')

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type='button'
                    data-testid={`assign-resources-${service.id}`}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        typeof resourceCount === 'number'
                            ? resourceCount > 0
                                ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                            : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-300 dark:hover:bg-zinc-900/50'
                    }`}
                >
                    <Users className='h-3 w-3' />
                    {typeof resourceCount === 'number'
                        ? resourceCount > 0
                            ? `${resourceCount} recurso / prestador${resourceCount !== 1 ? 's' : ''}`
                            : 'Sin recursos / prestadores'
                        : 'Asignar recursos / prestadores'}
                </button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                    <DialogTitle>Asignar recursos / prestadores al servicio</DialogTitle>
                    <DialogDescription>Seleccioná los recursos / prestadores que pueden ofrecer este servicio.</DialogDescription>
                </DialogHeader>

                <div className='space-y-4 py-4'>
                    {allResources.length === 0 ? (
                        <div className='text-center py-6'>
                            <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                                No hay recursos / prestadores disponibles. Creá recursos / prestadores primero para poder asignarlos a servicios.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Botón seleccionar todos */}
                            <div className='flex items-center justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800'>
                                <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                                    {selectedIds.size} de {allResources.length} seleccionados
                                </span>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={handleSelectAll}
                                    className='cursor-pointer'
                                >
                                    {selectedIds.size === allResources.length
                                        ? 'Deseleccionar todos'
                                        : 'Seleccionar todos'}
                                </Button>
                            </div>

                            {/* Lista de recursos / prestadores activos */}
                            {activeResources.length > 0 && (
                                <div className='space-y-3'>
                                    <h4 className='text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400'>
                                        Recursos / prestadores activos
                                    </h4>
                                    <div className='space-y-2 max-h-48 overflow-y-auto'>
                                        {activeResources.map(resource => (
                                            <div
                                                key={resource.id}
                                                className='flex items-center space-x-3 rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                            >
                                                <Checkbox
                                                    id={`resource-${resource.id}`}
                                                    checked={selectedIds.has(resource.id)}
                                                    onCheckedChange={() => handleToggle(resource.id)}
                                                    className='cursor-pointer'
                                                />
                                                <Label
                                                    htmlFor={`resource-${resource.id}`}
                                                    className='flex-1 cursor-pointer text-sm font-medium'
                                                >
                                                    {resource.name}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Lista de recursos / prestadores inactivos */}
                            {inactiveResources.length > 0 && (
                                <div className='space-y-3'>
                                    <h4 className='text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400'>
                                        Recursos / prestadores inactivos
                                    </h4>
                                    <div className='space-y-2 max-h-32 overflow-y-auto'>
                                        {inactiveResources.map(resource => (
                                            <div
                                                key={resource.id}
                                                className='flex items-center space-x-3 rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-60'
                                            >
                                                <Checkbox
                                                    id={`resource-${resource.id}`}
                                                    checked={selectedIds.has(resource.id)}
                                                    onCheckedChange={() => handleToggle(resource.id)}
                                                    className='cursor-pointer'
                                                />
                                                <Label
                                                    htmlFor={`resource-${resource.id}`}
                                                    className='flex-1 cursor-pointer text-sm font-medium'
                                                >
                                                    {resource.name}
                                                    <span className='ml-2 text-xs text-zinc-400'>(inactivo)</span>
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <DialogFooter className='gap-3'>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => setOpen(false)}
                        disabled={isSubmitting}
                        className='cursor-pointer'
                    >
                        Cancelar
                    </Button>
                    <Button
                        type='button'
                        onClick={handleSubmit}
                        disabled={isSubmitting || !hasChanges || allResources.length === 0}
                        className='cursor-pointer'
                    >
                        {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
