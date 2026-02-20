'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { formatDateTimeInTimezone, localInputToISO } from '@/lib/timezone'

interface ResourceBlock {
    id: string
    resourceId: string
    startAt: string
    endAt: string
    reason: string | null
    createdAt: string
}

interface BlockEditorProps {
    businessId: string
    resourceId: string
    initialBlocks: ResourceBlock[]
    timezone: string
}

/**
 * Formatea una fecha ISO a formato legible en la timezone del negocio
 */
function formatDateTime(isoString: string, timezone: string): string {
    return formatDateTimeInTimezone(isoString, timezone)
}

/**
 * Calcula la duración entre dos fechas y la formatea
 */
function formatDuration(startAt: string, endAt: string): string {
    const start = new Date(startAt)
    const end = new Date(endAt)
    const minutes = (end.getTime() - start.getTime()) / (1000 * 60)

    if (minutes < 60) {
        return `${Math.round(minutes)} min`
    }

    const hours = minutes / 60
    if (hours < 24) {
        if (hours === 1) return '1 hora'
        // Show integer if whole number, otherwise 1 decimal
        const hoursStr = hours % 1 === 0 ? hours.toString() : hours.toFixed(1)
        return `${hoursStr} horas`
    }

    const days = hours / 24
    return days === 1 ? '1 día' : `${days.toFixed(1)} días`
}

export function BlockEditor({ businessId, resourceId, initialBlocks, timezone }: BlockEditorProps) {
    const router = useRouter()
    const [blocks, setBlocks] = useState<ResourceBlock[]>(initialBlocks)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Form state
    const [startDate, setStartDate] = useState('')
    const [startTime, setStartTime] = useState('09:00')
    const [endDate, setEndDate] = useState('')
    const [endTime, setEndTime] = useState('18:00')
    const [reason, setReason] = useState('')
    const [formError, setFormError] = useState<string | null>(null)

    const resetForm = () => {
        setStartDate('')
        setStartTime('09:00')
        setEndDate('')
        setEndTime('18:00')
        setReason('')
        setFormError(null)
    }

    const handleCreate = async () => {
        setFormError(null)

        // Validaciones locales
        if (!startDate || !endDate) {
            setFormError('Las fechas de inicio y fin son requeridas.')
            return
        }

        const startAtISO = localInputToISO(startDate, startTime, timezone)
        const endAtISO = localInputToISO(endDate, endTime, timezone)

        if (new Date(startAtISO) >= new Date(endAtISO)) {
            setFormError('La fecha/hora de inicio debe ser anterior a la de fin.')
            return
        }

        setIsCreating(true)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/resources/${resourceId}/blocks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startAt: startAtISO,
                    endAt: endAtISO,
                    reason: reason.trim() || undefined
                })
            })

            const data = await response.json()

            if (!response.ok) {
                const errorMessage = data.error?.message || 'Error al crear el bloqueo.'
                setFormError(errorMessage)
                return
            }

            // Agregar bloqueo a la lista local
            setBlocks(prev =>
                [...prev, data.data].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            )

            toast.success('Bloqueo creado correctamente')
            setIsDialogOpen(false)
            resetForm()
            router.refresh()
        } catch (error) {
            console.error('Error al crear bloqueo:', error)
            setFormError('Error de conexión. Intentá nuevamente.')
        } finally {
            setIsCreating(false)
        }
    }

    const handleDelete = async (blockId: string) => {
        setDeletingId(blockId)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/resources/${resourceId}/blocks/${blockId}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Error al eliminar el bloqueo.')
                return
            }

            // Remover de la lista local
            setBlocks(prev => prev.filter(b => b.id !== blockId))
            toast.success('Bloqueo eliminado')
            router.refresh()
        } catch (error) {
            console.error('Error al eliminar bloqueo:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
        } finally {
            setDeletingId(null)
        }
    }

    // Separar bloqueos pasados y futuros
    const now = new Date()
    const futureBlocks = blocks.filter(b => new Date(b.endAt) > now)
    const pastBlocks = blocks.filter(b => new Date(b.endAt) <= now)

    return (
        <div className='space-y-6'>
            {/* Header con botón de crear */}
            <div className='flex items-center justify-between'>
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                    Los bloqueos impiden que se ofrezcan turnos en esos horarios.
                </p>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            className='cursor-pointer'
                            onClick={() => {
                                resetForm()
                                setIsDialogOpen(true)
                            }}
                        >
                            <Plus className='h-4 w-4 mr-1' />
                            Agregar bloqueo
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nuevo bloqueo</DialogTitle>
                            <DialogDescription>
                                Definí el período en que este recurso / prestador no estará disponible.
                            </DialogDescription>
                        </DialogHeader>

                        <div className='space-y-4 py-4'>
                            {formError && (
                                <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400'>
                                    <AlertTriangle className='h-4 w-4 shrink-0' />
                                    {formError}
                                </div>
                            )}

                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'>
                                    <Label htmlFor='startDate'>Fecha inicio</Label>
                                    <Input
                                        id='startDate'
                                        type='date'
                                        value={startDate}
                                        onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='startTime'>Hora inicio</Label>
                                    <Input
                                        id='startTime'
                                        type='time'
                                        value={startTime}
                                        onChange={e => setStartTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'>
                                    <Label htmlFor='endDate'>Fecha fin</Label>
                                    <Input
                                        id='endDate'
                                        type='date'
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='endTime'>Hora fin</Label>
                                    <Input
                                        id='endTime'
                                        type='time'
                                        value={endTime}
                                        onChange={e => setEndTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className='space-y-2'>
                                <Label htmlFor='reason'>Motivo (opcional)</Label>
                                <Textarea
                                    id='reason'
                                    placeholder='Ej: Feriado, Mantenimiento, Vacaciones...'
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    maxLength={500}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant='outline' onClick={() => setIsDialogOpen(false)} className='cursor-pointer'>
                                Cancelar
                            </Button>
                            <Button onClick={handleCreate} disabled={isCreating} className='cursor-pointer'>
                                {isCreating ? 'Creando...' : 'Crear bloqueo'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Lista de bloqueos futuros */}
            {futureBlocks.length === 0 && pastBlocks.length === 0 ? (
                <div className='rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700'>
                    <p className='text-sm text-zinc-500 dark:text-zinc-400'>No hay bloqueos definidos.</p>
                    <p className='mt-1 text-xs text-zinc-400 dark:text-zinc-500'>
                        Agregá bloqueos para feriados, mantenimiento o períodos sin disponibilidad.
                    </p>
                </div>
            ) : (
                <div className='space-y-4'>
                    {futureBlocks.length > 0 && (
                        <div className='space-y-2'>
                            <h4 className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>Próximos bloqueos</h4>
                            <div className='space-y-2'>
                                {futureBlocks.map(block => (
                                    <div
                                        key={block.id}
                                        className='flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'
                                    >
                                        <div className='space-y-1'>
                                            <div className='flex items-center gap-2'>
                                                <span className='font-medium text-zinc-900 dark:text-zinc-50'>
                                                    {formatDateTime(block.startAt, timezone)}
                                                </span>
                                                <span className='text-zinc-400'>→</span>
                                                <span className='font-medium text-zinc-900 dark:text-zinc-50'>
                                                    {formatDateTime(block.endAt, timezone)}
                                                </span>
                                                <span className='rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'>
                                                    {formatDuration(block.startAt, block.endAt)}
                                                </span>
                                            </div>
                                            {block.reason && (
                                                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                                                    {block.reason}
                                                </p>
                                            )}
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    className='cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950'
                                                    disabled={deletingId === block.id}
                                                >
                                                    <Trash2 className='h-4 w-4' />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar bloqueo?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción no se puede deshacer. El horario volverá a estar
                                                        disponible para reservas.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className='cursor-pointer'>
                                                        Cancelar
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(block.id)}
                                                        className='cursor-pointer bg-red-600 hover:bg-red-700'
                                                    >
                                                        Eliminar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {pastBlocks.length > 0 && (
                        <div className='space-y-2'>
                            <h4 className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>Bloqueos pasados</h4>
                            <div className='space-y-2 opacity-60'>
                                {pastBlocks.slice(0, 5).map(block => (
                                    <div
                                        key={block.id}
                                        className='flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50'
                                    >
                                        <div className='space-y-0.5'>
                                            <div className='flex items-center gap-2 text-sm'>
                                                <span className='text-zinc-600 dark:text-zinc-400'>
                                                    {formatDateTime(block.startAt, timezone)}
                                                </span>
                                                <span className='text-zinc-400'>→</span>
                                                <span className='text-zinc-600 dark:text-zinc-400'>
                                                    {formatDateTime(block.endAt, timezone)}
                                                </span>
                                            </div>
                                            {block.reason && (
                                                <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                                                    {block.reason}
                                                </p>
                                            )}
                                        </div>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant='ghost'
                                                    size='sm'
                                                    className='cursor-pointer text-zinc-400 hover:text-red-600'
                                                    disabled={deletingId === block.id}
                                                >
                                                    <Trash2 className='h-4 w-4' />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar bloqueo?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Este bloqueo ya pasó. ¿Querés eliminarlo del historial?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel className='cursor-pointer'>
                                                        Cancelar
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(block.id)}
                                                        className='cursor-pointer bg-red-600 hover:bg-red-700'
                                                    >
                                                        Eliminar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                                {pastBlocks.length > 5 && (
                                    <p className='text-center text-xs text-zinc-400'>
                                        +{pastBlocks.length - 5} bloqueos anteriores
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
