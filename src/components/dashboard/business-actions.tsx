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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, MoreHorizontal, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'

const TIMEZONES = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
    { value: 'America/Santiago', label: 'Santiago (GMT-3/GMT-4)' },
    { value: 'America/Lima', label: 'Lima (GMT-5)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
    { value: 'UTC', label: 'UTC (GMT+0)' }
]

interface Business {
    id: string
    name: string
    timezone: string
    address: string | null
    area: string | null
    status: string
}

interface BusinessActionsProps {
    business: Business
}

export function BusinessActions({ business }: BusinessActionsProps) {
    const router = useRouter()
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editName, setEditName] = useState(business.name)
    const [editTimezone, setEditTimezone] = useState(business.timezone)
    const [editAddress, setEditAddress] = useState(business.address ?? '')
    const [editArea, setEditArea] = useState(business.area ?? '')
    const [error, setError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [isToggling, setIsToggling] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [futureAppointmentsCount, setFutureAppointmentsCount] = useState<number | null>(null)
    const [isCheckingAppointments, setIsCheckingAppointments] = useState(false)

    const isActive = business.status === 'ACTIVE'

    const handleEdit = async () => {
        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${business.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName,
                    timezone: editTimezone,
                    address: editAddress || null,
                    area: editArea || null
                })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'Error al actualizar.')
                return
            }

            setIsEditOpen(false)
            toast.success('Negocio actualizado correctamente.')
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
            const response = await fetch(`/api/v1/businesses/${business.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Error al cambiar el estado del negocio.')
                return
            }

            setIsDeactivateOpen(false)
            toast.success(isActive ? 'Negocio desactivado.' : 'Negocio activado.')
            router.refresh()
        } catch {
            toast.error('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsSubmitting(false)
            setIsToggling(false)
        }
    }

    const handleOpenEdit = () => {
        setEditName(business.name)
        setEditTimezone(business.timezone)
        setEditAddress(business.address ?? '')
        setEditArea(business.area ?? '')
        setError(null)
        setIsEditOpen(true)
    }

    const handleOpenDelete = async () => {
        setDeleteError(null)
        setFutureAppointmentsCount(null)
        setIsCheckingAppointments(true)
        setIsDeleteOpen(true)

        try {
            const response = await fetch(`/api/v1/businesses/${business.id}/future-appointments-count`)
            if (response.ok) {
                const data = await response.json()
                setFutureAppointmentsCount(data.data.count)
            }
        } catch {
            // Si falla el check, dejamos count en null (el botón queda habilitado, el backend valida igual)
        } finally {
            setIsCheckingAppointments(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        setDeleteError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${business.id}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                const data = await response.json()
                if (response.status === 409 && data.error?.code === 'BUSINESS_HAS_FUTURE_APPOINTMENTS') {
                    setDeleteError(data.error.message)
                } else {
                    setDeleteError(data.error?.message || 'Error al eliminar.')
                }
                return
            }

            setIsDeleteOpen(false)
            toast.success('Negocio eliminado correctamente.')
            router.refresh()
        } catch {
            setDeleteError('Error de conexión. Intentá nuevamente.')
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
                        <DialogTitle>Editar negocio</DialogTitle>
                        <DialogDescription>Modificá los datos del negocio.</DialogDescription>
                    </DialogHeader>

                    <div className='space-y-4 py-4'>
                        {error && (
                            <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                                {error}
                            </div>
                        )}

                        <div className='space-y-2'>
                            <Label htmlFor='edit-business-name'>Nombre</Label>
                            <Input
                                id='edit-business-name'
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                placeholder='Nombre del negocio'
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='edit-business-timezone'>Zona horaria</Label>
                            <Select value={editTimezone} onValueChange={setEditTimezone} disabled={isSubmitting}>
                                <SelectTrigger id='edit-business-timezone'>
                                    <SelectValue placeholder='Seleccioná tu zona horaria' />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIMEZONES.map(tz => (
                                        <SelectItem key={tz.value} value={tz.value}>
                                            {tz.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='edit-business-address'>Dirección (opcional)</Label>
                            <Input
                                id='edit-business-address'
                                value={editAddress}
                                onChange={e => setEditAddress(e.target.value)}
                                placeholder='Dirección del negocio'
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className='space-y-2'>
                            <Label htmlFor='edit-business-area'>Ciudad/Zona (opcional)</Label>
                            <Input
                                id='edit-business-area'
                                value={editArea}
                                onChange={e => setEditArea(e.target.value)}
                                placeholder='Ciudad o zona'
                                disabled={isSubmitting}
                            />
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
                        <AlertDialogTitle>¿Desactivar negocio «{business.name}»?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El negocio dejará de ser visible en la página pública y no se podrán crear nuevas reservas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className='rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'>
                        ⚠️ Los turnos existentes se mantendrán activos: se enviarán recordatorios y notificaciones
                        normalmente. Si no querés que eso pase, cancelá los turnos desde la agenda antes de desactivar.
                    </div>
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
                        <AlertDialogTitle>¿Eliminar negocio «{business.name}»?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. El negocio desaparecerá del listado y de la página
                            pública.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {isCheckingAppointments && (
                        <div className='flex items-center gap-2 text-sm text-zinc-500'>
                            <Loader2 className='h-4 w-4 animate-spin' />
                            Verificando turnos activos…
                        </div>
                    )}

                    {!isCheckingAppointments && futureAppointmentsCount !== null && futureAppointmentsCount > 0 && (
                        <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                            Este negocio tiene <strong>{futureAppointmentsCount}</strong> turno
                            {futureAppointmentsCount > 1 ? 's' : ''} activo{futureAppointmentsCount > 1 ? 's' : ''}.{' '}
                            <a
                                href={`/dashboard/business/${business.id}/agenda`}
                                className='font-medium underline hover:text-red-900 dark:hover:text-red-100'
                            >
                                Cancelalos desde la agenda
                            </a>{' '}
                            antes de eliminar el negocio.
                        </div>
                    )}

                    {!isCheckingAppointments && (futureAppointmentsCount === null || futureAppointmentsCount === 0) && (
                        <div className='rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'>
                            ⚠️ Esta acción eliminará el negocio de forma permanente.
                        </div>
                    )}

                    {deleteError && (
                        <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                            {deleteError}
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={
                                isDeleting ||
                                isCheckingAppointments ||
                                (futureAppointmentsCount !== null && futureAppointmentsCount > 0)
                            }
                            className='bg-red-600 hover:bg-red-700 disabled:opacity-50'
                        >
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
