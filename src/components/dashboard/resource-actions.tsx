'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'

interface Resource {
    id: string
    name: string
    type: string | null
    status: string
    businessId: string
}

interface ResourceActionsProps {
    resource: Resource
    resourceLabel: string
}

export function ResourceActions({ resource, resourceLabel }: ResourceActionsProps) {
    const router = useRouter()
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editName, setEditName] = useState(resource.name)
    const [editType, setEditType] = useState<'' | 'PERSON' | 'ASSET'>((resource.type as '' | 'PERSON' | 'ASSET') || '')
    const [error, setError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [isToggling, setIsToggling] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const isActive = resource.status === 'ACTIVE'

    const handleEdit = async () => {
        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${resource.businessId}/resources`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resourceId: resource.id,
                    name: editName,
                    type: editType || null
                })
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 409) {
                    setError(`Ya existe un ${resourceLabel.toLowerCase()} con ese nombre.`)
                } else {
                    setError(data.error?.message || 'Error al actualizar.')
                }
                return
            }

            setIsEditOpen(false)
            router.refresh()
        } catch {
            setError('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleStatus = async () => {
        setIsSubmitting(true)
        setIsToggling(true)

        try {
            const newStatus = isActive ? 'INACTIVE' : 'ACTIVE'
            const response = await fetch(`/api/v1/businesses/${resource.businessId}/resources`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceId: resource.id, status: newStatus })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Error al cambiar el estado del recurso / prestador.')
                return
            }

            setIsDeactivateOpen(false)
            router.refresh()
        } catch {
            toast.error('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsSubmitting(false)
            setIsToggling(false)
        }
    }

    const handleOpenEdit = () => {
        setEditName(resource.name)
        setEditType((resource.type as '' | 'PERSON' | 'ASSET') || '')
        setError(null)
        setIsEditOpen(true)
    }

    const handleOpenDelete = () => {
        setDeleteError(null)
        setIsDeleteOpen(true)
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        setDeleteError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${resource.businessId}/resources`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceId: resource.id })
            })

            if (!response.ok) {
                const data = await response.json()
                if (response.status === 409 && data.error?.code === 'RESOURCE_HAS_FUTURE_APPOINTMENTS') {
                    setDeleteError(`Este ${resourceLabel.toLowerCase()} tiene turnos futuros. Desactivalo en su lugar.`)
                } else {
                    setDeleteError(data.error?.message || 'Error al eliminar.')
                }
                return
            }

            setIsDeleteOpen(false)
            toast.success(`${resourceLabel} eliminado correctamente.`)
            router.refresh()
        } catch {
            setDeleteError('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsDeleting(false)
        }
    }

    const handleDeactivateFromDeleteError = async () => {
        setIsDeleting(true)
        try {
            const response = await fetch(`/api/v1/businesses/${resource.businessId}/resources`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resourceId: resource.id, status: 'INACTIVE' })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Error al desactivar.')
                return
            }

            setIsDeleteOpen(false)
            toast.success(`${resourceLabel} desactivado correctamente.`)
            router.refresh()
        } catch {
            toast.error('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='sm' className='h-8 w-8 p-0 cursor-pointer'>
                        <span className='sr-only'>Abrir menú</span>
                        <MoreHorizontal className='h-4 w-4' />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={handleOpenEdit} className='cursor-pointer'>
                        <Pencil className='mr-2 h-4 w-4' />
                        Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isActive ? (
                        <DropdownMenuItem
                            onClick={() => setIsDeactivateOpen(true)}
                            className='cursor-pointer text-amber-600 focus:text-amber-600'
                        >
                            <PowerOff className='mr-2 h-4 w-4' />
                            Desactivar
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem
                            onClick={handleToggleStatus}
                            disabled={isToggling}
                            className='cursor-pointer text-green-600 focus:text-green-600'
                        >
                            {isToggling ? (
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                            ) : (
                                <Power className='mr-2 h-4 w-4' />
                            )}
                            {isToggling ? 'Activando...' : 'Activar'}
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleOpenDelete}
                        className='cursor-pointer text-red-600 focus:text-red-600'
                    >
                        <Trash2 className='mr-2 h-4 w-4' />
                        Eliminar
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Modal de edición */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar {resourceLabel}</DialogTitle>
                        <DialogDescription>Modificá los datos del {resourceLabel.toLowerCase()}.</DialogDescription>
                    </DialogHeader>

                    <div className='space-y-4 py-4'>
                        {error && (
                            <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                                {error}
                            </div>
                        )}

                        <div className='space-y-2'>
                            <Label htmlFor='edit-name'>Nombre</Label>
                            <Input
                                id='edit-name'
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                placeholder={`Nombre del ${resourceLabel.toLowerCase()}`}
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='edit-type'>Tipo</Label>
                            <select
                                id='edit-type'
                                value={editType}
                                onChange={e => setEditType(e.target.value as '' | 'PERSON' | 'ASSET')}
                                disabled={isSubmitting}
                                className='flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300'
                            >
                                <option value=''>Sin especificar</option>
                                <option value='PERSON'>Persona</option>
                                <option value='ASSET'>Recurso físico</option>
                            </select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant='outline' onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleEdit} disabled={isSubmitting || !editName.trim()}>
                            {isSubmitting ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo de confirmación para desactivar */}
            <AlertDialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Desactivar {resourceLabel.toLowerCase()} «{resource.name}»?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            No estará disponible para nuevas reservas. Los turnos existentes se mantienen.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleToggleStatus}
                            disabled={isSubmitting}
                            className='bg-amber-600 hover:bg-amber-700'
                        >
                            {isSubmitting ? 'Desactivando...' : 'Desactivar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Diálogo de confirmación para eliminar */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ¿Eliminar {resourceLabel.toLowerCase()} «{resource.name}»?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El {resourceLabel.toLowerCase()} desaparecerá del listado.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {deleteError && (
                        <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                            {deleteError}
                            {deleteError.includes('turnos futuros') && (
                                <Button
                                    variant='link'
                                    size='sm'
                                    className='mt-2 h-auto p-0 text-amber-600 hover:text-amber-700'
                                    onClick={handleDeactivateFromDeleteError}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Desactivando...' : '→ Desactivar en su lugar'}
                                </Button>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className='bg-red-600 hover:bg-red-700'
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
