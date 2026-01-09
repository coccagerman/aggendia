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
import { CheckCircle } from 'lucide-react'

interface CompleteAppointmentDialogProps {
    appointmentId: string
    businessId: string
    customerName: string
    serviceName: string
    timeRange: string
}

/**
 * Dialog to confirm marking an appointment as completed
 * @see docs/user-stories.md - US-6.4 Marcar completado
 */
export function CompleteAppointmentDialog({
    appointmentId,
    businessId,
    customerName,
    serviceName,
    timeRange
}: CompleteAppointmentDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleComplete() {
        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/appointments/${appointmentId}/complete`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error?.message || 'Error al marcar el turno como completado')
            }

            // Close dialog and refresh page to show updated status
            setOpen(false)
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al marcar el turno como completado')
        } finally {
            setIsLoading(false)
        }
    }

    function handleOpenChange(newOpen: boolean) {
        if (!isLoading) {
            setOpen(newOpen)
            if (!newOpen) {
                setError(null)
            }
        }
    }

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogTrigger asChild>
                <Button
                    variant='ghost'
                    size='sm'
                    className='text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20'
                >
                    <CheckCircle className='h-4 w-4 mr-1' />
                    Completado
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Marcar este turno como completado?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className='space-y-2'>
                            <p>
                                Estás por marcar el turno de <strong>{customerName}</strong> para{' '}
                                <strong>{serviceName}</strong> a las <strong>{timeRange}</strong> como completado.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

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
                            handleComplete()
                        }}
                        disabled={isLoading}
                        className='bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                    >
                        {isLoading ? 'Procesando...' : 'Sí, marcar como completado'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
