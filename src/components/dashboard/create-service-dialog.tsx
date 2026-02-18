'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DURATION_STEP, DURATION_OPTIONS, MAX_BOOKING_NOTICE_MINUTES } from '@/domain/services/service.types'

interface CreateServiceDialogProps {
    businessId: string
    triggerVariant?: 'default' | 'outline'
    triggerSize?: 'default' | 'sm'
}

interface FormErrors {
    name?: string
    durationMinutes?: string
    slotIntervalMinutes?: string
    minBookingNoticeMinutes?: string
    priceCents?: string
    general?: string
}

export function CreateServiceDialog({
    businessId,
    triggerVariant = 'default',
    triggerSize = 'default'
}: CreateServiceDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<FormErrors>({})
    const [useCustomDuration, setUseCustomDuration] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        durationMinutes: 30,
        slotIntervalMinutes: 30, // Por defecto = durationMinutes
        minBookingNoticeMinutes: 120, // Por defecto 2 horas
        priceAmount: '' // Input como string para manejar decimales
    })

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            durationMinutes: 30,
            slotIntervalMinutes: 30,
            minBookingNoticeMinutes: 120,
            priceAmount: ''
        })
        setErrors({})
        setUseCustomDuration(false)
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        // Validación local de duración múltiplo de DURATION_STEP
        if (formData.durationMinutes % DURATION_STEP !== 0) {
            setErrors({ durationMinutes: `La duración debe ser múltiplo de ${DURATION_STEP} minutos` })
            setIsSubmitting(false)
            return
        }

        // Convertir precio a centavos si se ingresó
        let priceCents: number | null = null
        if (formData.priceAmount.trim() !== '') {
            const priceNumber = parseFloat(formData.priceAmount.replace(',', '.'))
            if (isNaN(priceNumber) || priceNumber < 0) {
                setErrors({ priceCents: 'Ingresá un precio válido' })
                setIsSubmitting(false)
                return
            }
            priceCents = Math.round(priceNumber * 100)
        }

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/services`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    description: formData.description || null,
                    durationMinutes: formData.durationMinutes,
                    slotIntervalMinutes: formData.slotIntervalMinutes,
                    minBookingNoticeMinutes: formData.minBookingNoticeMinutes,
                    priceCents
                })
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 409) {
                    setErrors({
                        name: 'Ya existe un servicio con ese nombre en este negocio o sede.'
                    })
                } else if (response.status === 400) {
                    if (data.error?.details?.fieldErrors) {
                        const fieldErrors = data.error.details.fieldErrors
                        const validationErrors: FormErrors = {}
                        if (fieldErrors.name?.[0]) {
                            validationErrors.name = fieldErrors.name[0]
                        }
                        if (fieldErrors.durationMinutes?.[0]) {
                            validationErrors.durationMinutes = fieldErrors.durationMinutes[0]
                        }
                        if (fieldErrors.slotIntervalMinutes?.[0]) {
                            validationErrors.slotIntervalMinutes = fieldErrors.slotIntervalMinutes[0]
                        }
                        if (fieldErrors.minBookingNoticeMinutes?.[0]) {
                            validationErrors.minBookingNoticeMinutes = fieldErrors.minBookingNoticeMinutes[0]
                        }
                        if (fieldErrors.priceCents?.[0]) {
                            validationErrors.priceCents = fieldErrors.priceCents[0]
                        }
                        if (Object.keys(validationErrors).length > 0) {
                            setErrors(validationErrors)
                        } else {
                            setErrors({ general: data.error?.message || 'Datos inválidos.' })
                        }
                    } else {
                        setErrors({ general: data.error?.message || 'Datos inválidos.' })
                    }
                } else {
                    setErrors({
                        general: data.error?.message || 'Ocurrió un error al crear el servicio.'
                    })
                }
                return
            }

            // Éxito
            toast.success('Servicio creado exitosamente')
            setOpen(false)
            resetForm()
            router.refresh()
        } catch (error) {
            console.error('Error al crear servicio:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
            setErrors({
                general: 'Ocurrió un error inesperado. Verificá tu conexión e intentá nuevamente.'
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={triggerVariant} size={triggerSize} className='cursor-pointer'>
                    {triggerVariant !== 'outline' && <Plus className='mr-2 h-4 w-4' />}
                    Crear servicio
                </Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-125'>
                <DialogHeader>
                    <DialogTitle>Crear servicio</DialogTitle>
                    <DialogDescription>
                        Los servicios activos se mostrarán en tu página pública para que los clientes puedan reservar.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className='space-y-4'>
                    {/* Error general */}
                    {errors.general && (
                        <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                            {errors.general}
                        </div>
                    )}

                    {/* Nombre */}
                    <div className='space-y-2'>
                        <Label htmlFor='service-name'>
                            Nombre del servicio <span className='text-red-500'>*</span>
                        </Label>
                        <Input
                            id='service-name'
                            type='text'
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder='Ej: Corte de pelo, Clase de yoga'
                            required
                            disabled={isSubmitting}
                            aria-invalid={!!errors.name}
                        />
                        {errors.name && <p className='text-sm text-red-600 dark:text-red-400'>{errors.name}</p>}
                    </div>

                    {/* Descripción */}
                    <div className='space-y-2'>
                        <Label htmlFor='service-description'>Descripción</Label>
                        <Textarea
                            id='service-description'
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder='Describe brevemente el servicio (opcional)'
                            disabled={isSubmitting}
                            rows={2}
                        />
                    </div>

                    {/* Duración */}
                    <div className='space-y-2'>
                        <Label htmlFor='service-duration'>
                            Duración <span className='text-red-500'>*</span>
                        </Label>
                        {!useCustomDuration ? (
                            <div className='space-y-2'>
                                <select
                                    id='service-duration'
                                    value={formData.durationMinutes}
                                    onChange={e => {
                                        const newDuration = parseInt(e.target.value)
                                        setFormData(prev => ({
                                            ...prev,
                                            durationMinutes: newDuration,
                                            slotIntervalMinutes: newDuration
                                        }))
                                    }}
                                    disabled={isSubmitting}
                                    className='flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300'
                                >
                                    {DURATION_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type='button'
                                    onClick={() => setUseCustomDuration(true)}
                                    className='text-sm text-blue-600 hover:underline dark:text-blue-400'
                                >
                                    Usar duración personalizada
                                </button>
                            </div>
                        ) : (
                            <div className='space-y-2'>
                                <div className='flex items-center gap-2'>
                                    <Input
                                        id='service-duration'
                                        type='number'
                                        min='5'
                                        max='480'
                                        step='5'
                                        value={formData.durationMinutes}
                                        onChange={e => {
                                            const newDuration = parseInt(e.target.value) || 0
                                            setFormData(prev => ({
                                                ...prev,
                                                durationMinutes: newDuration,
                                                slotIntervalMinutes: newDuration
                                            }))
                                        }}
                                        disabled={isSubmitting}
                                        className='w-24'
                                    />
                                    <span className='text-sm text-zinc-500'>minutos</span>
                                </div>
                                <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                                    Debe ser múltiplo de 5 (ej: 15, 20, 25...)
                                </p>
                                <button
                                    type='button'
                                    onClick={() => {
                                        setUseCustomDuration(false)
                                        setFormData({ ...formData, durationMinutes: 30 })
                                    }}
                                    className='text-sm text-blue-600 hover:underline dark:text-blue-400'
                                >
                                    Volver a opciones predefinidas
                                </button>
                            </div>
                        )}
                        {errors.durationMinutes && (
                            <p className='text-sm text-red-600 dark:text-red-400'>{errors.durationMinutes}</p>
                        )}
                    </div>

                    {/* Periodicidad de turnos */}
                    <div className='space-y-2'>
                        <Label htmlFor='service-interval'>Periodicidad de turnos</Label>
                        <div className='flex items-center gap-2'>
                            <Input
                                id='service-interval'
                                type='number'
                                min={formData.durationMinutes}
                                max='480'
                                step='5'
                                value={formData.slotIntervalMinutes}
                                onChange={e =>
                                    setFormData({
                                        ...formData,
                                        slotIntervalMinutes: parseInt(e.target.value) || formData.durationMinutes
                                    })
                                }
                                disabled={isSubmitting}
                                className='w-24'
                            />
                            <span className='text-sm text-zinc-500'>minutos</span>
                        </div>
                        <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                            Cada cuántos minutos se ofrece un nuevo turno. Por defecto, igual a la duración.
                        </p>
                        {errors.slotIntervalMinutes && (
                            <p className='text-sm text-red-600 dark:text-red-400'>{errors.slotIntervalMinutes}</p>
                        )}
                    </div>

                    {/* Anticipación mínima */}
                    <div className='space-y-2'>
                        <Label htmlFor='service-notice'>Anticipación mínima para reservas</Label>
                        <div className='flex items-center gap-2'>
                            <Input
                                id='service-notice'
                                type='number'
                                min='0'
                                max={MAX_BOOKING_NOTICE_MINUTES}
                                step='15'
                                value={formData.minBookingNoticeMinutes}
                                onChange={e =>
                                    setFormData({
                                        ...formData,
                                        minBookingNoticeMinutes: parseInt(e.target.value) || 0
                                    })
                                }
                                disabled={isSubmitting}
                                className='w-24'
                            />
                            <span className='text-sm text-zinc-500'>minutos</span>
                        </div>
                        <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                            Con cuánta anticipación mínima debe reservar el cliente (0 = sin restricción, máx: 7 días)
                        </p>
                        {errors.minBookingNoticeMinutes && (
                            <p className='text-sm text-red-600 dark:text-red-400'>{errors.minBookingNoticeMinutes}</p>
                        )}
                    </div>

                    {/* )}
                    </div>

                    {/* Precio */}
                    <div className='space-y-2'>
                        <Label htmlFor='service-price'>Precio (opcional)</Label>
                        <div className='flex items-center gap-2'>
                            <span className='text-sm text-zinc-500'>$</span>
                            <Input
                                id='service-price'
                                type='text'
                                inputMode='decimal'
                                value={formData.priceAmount}
                                onChange={e => setFormData({ ...formData, priceAmount: e.target.value })}
                                placeholder='0.00'
                                disabled={isSubmitting}
                                className='w-32'
                            />
                            <span className='text-sm text-zinc-500'>ARS</span>
                        </div>
                        <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                            Dejá vacío si no querés mostrar precio
                        </p>
                        {errors.priceCents && (
                            <p className='text-sm text-red-600 dark:text-red-400'>{errors.priceCents}</p>
                        )}
                    </div>

                    {/* Botones */}
                    <div className='flex justify-end gap-3 pt-4'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => {
                                setOpen(false)
                                resetForm()
                            }}
                            disabled={isSubmitting}
                            className='cursor-pointer'
                        >
                            Cancelar
                        </Button>
                        <Button type='submit' disabled={isSubmitting} className='cursor-pointer'>
                            {isSubmitting ? 'Creando...' : 'Crear servicio'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
