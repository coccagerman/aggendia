'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'

interface CancelAppointmentDialogProps {
    appointmentId: string
    businessId: string
    customerName: string
    serviceName: string
    timeRange: string
}

export function CancelAppointmentDialog({
    appointmentId,
    businessId,
    customerName,
    serviceName,
    timeRange
}: CancelAppointmentDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [cancellationReason, setCancellationReason] = useState('')

    async function handleCancel() {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/cancel`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cancellationReason: cancellationReason.trim() || undefined
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error?.message || 'Error al cancelar el turno')
            }

            // Close dialog and refresh page to show updated status
            setOpen(false)
            setCancellationReason('')
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cancelar el turno')
        } finally {
            setIsLoading(false)
        }
    }

    function handleOpenChange(newOpen: boolean) {
        if (!isLoading) {
            setOpen(newOpen)
            if (!newOpen) {
                setError(null)
                setCancellationReason('')
            }
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20'
                >
                    <X className='h-4 w-4 mr-1' />
                    Cancelar
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Cancelar este turno?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className='space-y-2'>
                            <p>
                                Estás por cancelar el turno de <strong>{customerName}</strong> para{' '}
                                <strong>{serviceName}</strong> a las <strong>{timeRange}</strong>.
                            </p>
                            <p>El horario volverá a estar disponible para nuevas reservas.</p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className='space-y-2'>
                    <Label htmlFor='cancellation-reason'>Motivo de cancelación (opcional)</Label>
                    <Textarea
                        id='cancellation-reason'
                        placeholder='Ej: Cliente canceló por WhatsApp'
                        value={cancellationReason}
                        onChange={e => setCancellationReason(e.target.value)}
                        maxLength={500}
                        disabled={isLoading}
                        className='resize-none'
                        rows={3}
                    />
                    <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                        {cancellationReason.length}/500 caracteres
                    </p>
                </div>

                {error && (
                    <div className='rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400'>
                        {error}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isLoading}>Volver</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={e => {
                            e.preventDefault()
                            handleCancel()
                        }}
                        disabled={isLoading}
                        className='bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700'
                    >
                        {isLoading ? 'Cancelando...' : 'Sí, cancelar turno'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
