'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MoreHorizontal, Pencil, Power, PowerOff } from 'lucide-react'
import { type Service, DURATION_STEP, DURATION_OPTIONS } from '@/domain/services/service.types'

interface ServiceActionsProps {
    service: Service
}

interface FormErrors {
    name?: string
    durationMinutes?: string
    bufferMinutes?: string
    priceCents?: string
    general?: string
}

export function ServiceActions({ service }: ServiceActionsProps) {
    const router = useRouter()
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [isToggleOpen, setIsToggleOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isToggling, setIsToggling] = useState(false)
    const [errors, setErrors] = useState<FormErrors>({})
    const [useCustomDuration, setUseCustomDuration] = useState(false)

    const [formData, setFormData] = useState({
        name: service.name,
        description: service.description ?? '',
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        priceAmount: service.priceCents !== null ? (service.priceCents / 100).toString() : ''
    })

    const resetForm = () => {
        setFormData({
            name: service.name,
            description: service.description ?? '',
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
            priceAmount: service.priceCents !== null ? (service.priceCents / 100).toString() : ''
        })
        setErrors({})
        // Check if current duration is in predefined options
        setUseCustomDuration(!DURATION_OPTIONS.some(opt => opt.value === service.durationMinutes))
    }

    const handleOpenEdit = () => {
        resetForm()
        setIsEditOpen(true)
    }

    const handleToggleActive = async () => {
        setIsToggling(true)

        try {
            const response = await fetch(`/api/v1/businesses/${service.businessId}/services/${service.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ active: !service.active })
            })

            if (!response.ok) {
                const data = await response.json()
                toast.error(data.error?.message || 'Ocurrió un error al cambiar el estado del servicio.')
                setIsToggling(false)
                return
            }

            // Cerrar modal primero, luego mostrar toast y refrescar
            setIsToggleOpen(false)
            setIsToggling(false)
            toast.success(service.active ? 'Servicio desactivado' : 'Servicio activado')
            router.refresh()
        } catch (error) {
            console.error('Error al cambiar estado del servicio:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
            setIsToggling(false)
        }
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

        // Solo enviar campos que cambiaron
        const updatePayload: Record<string, unknown> = {}

        if (formData.name !== service.name) {
            updatePayload.name = formData.name
        }
        if ((formData.description || null) !== service.description) {
            updatePayload.description = formData.description || null
        }
        if (formData.durationMinutes !== service.durationMinutes) {
            updatePayload.durationMinutes = formData.durationMinutes
        }
        if (formData.bufferMinutes !== service.bufferMinutes) {
            updatePayload.bufferMinutes = formData.bufferMinutes
        }
        if (priceCents !== service.priceCents) {
            updatePayload.priceCents = priceCents
        }

        // Si no hay cambios, cerrar modal
        if (Object.keys(updatePayload).length === 0) {
            setIsEditOpen(false)
            setIsSubmitting(false)
            return
        }

        try {
            const response = await fetch(`/api/v1/businesses/${service.businessId}/services/${service.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatePayload)
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 409) {
                    setErrors({
                        name: 'Ya existe un servicio con ese nombre en este negocio.'
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
                        if (fieldErrors.bufferMinutes?.[0]) {
                            validationErrors.bufferMinutes = fieldErrors.bufferMinutes[0]
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
                } else if (response.status === 404) {
                    setErrors({ general: 'Servicio no encontrado.' })
                } else {
                    setErrors({
                        general: data.error?.message || 'Ocurrió un error al actualizar el servicio.'
                    })
                }
                return
            }

            // Éxito
            toast.success('Servicio actualizado exitosamente')
            setIsEditOpen(false)
            router.refresh()
        } catch (error) {
            console.error('Error al actualizar servicio:', error)
            toast.error('Error de conexión. Intentá nuevamente.')
            setErrors({
                general: 'Ocurrió un error inesperado. Verificá tu conexión e intentá nuevamente.'
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='sm' className='h-8 w-8 cursor-pointer p-0'>
                        <span className='sr-only'>Abrir menú</span>
                        <MoreHorizontal className='h-4 w-4' />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={handleOpenEdit} className='cursor-pointer'>
                        <Pencil className='mr-2 h-4 w-4' />
                        Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setIsToggleOpen(true)}
                        className={`cursor-pointer ${
                            service.active ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}
                    >
                        {service.active ? (
                            <>
                                <PowerOff className='mr-2 h-4 w-4' />
                                Desactivar
                            </>
                        ) : (
                            <>
                                <Power className='mr-2 h-4 w-4' />
                                Activar
                            </>
                        )}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Modal de edición */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className='sm:max-w-125'>
                    <DialogHeader>
                        <DialogTitle>Editar servicio</DialogTitle>
                        <DialogDescription>
                            Modificá los datos del servicio. Los cambios afectarán a las nuevas reservas; las existentes
                            no se modificarán.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className='space-y-4'>
                        {/* Error general */}
                        {errors.general && (
                            <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                                {errors.general}
                            </div>
                        )}

                        {/* Warning informativo */}
                        <div className='rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'>
                            ⚠️ Este cambio afecta nuevas reservas; las existentes no cambian.
                        </div>

                        {/* Nombre */}
                        <div className='space-y-2'>
                            <Label htmlFor='edit-service-name'>
                                Nombre del servicio <span className='text-red-500'>*</span>
                            </Label>
                            <Input
                                id='edit-service-name'
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
                            <Label htmlFor='edit-service-description'>Descripción</Label>
                            <Textarea
                                id='edit-service-description'
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
                            <Label htmlFor='edit-service-duration'>
                                Duración <span className='text-red-500'>*</span>
                            </Label>
                            {!useCustomDuration ? (
                                <div className='space-y-2'>
                                    <select
                                        id='edit-service-duration'
                                        value={formData.durationMinutes}
                                        onChange={e =>
                                            setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })
                                        }
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
                                            id='edit-service-duration'
                                            type='number'
                                            min='5'
                                            max='480'
                                            step='5'
                                            value={formData.durationMinutes}
                                            onChange={e =>
                                                setFormData({
                                                    ...formData,
                                                    durationMinutes: parseInt(e.target.value) || 0
                                                })
                                            }
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
                                            // Reset to nearest predefined option
                                            const nearestOption =
                                                DURATION_OPTIONS.find(opt => opt.value >= formData.durationMinutes) ||
                                                DURATION_OPTIONS[0]
                                            setFormData({ ...formData, durationMinutes: nearestOption.value })
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

                        {/* Buffer */}
                        <div className='space-y-2'>
                            <Label htmlFor='edit-service-buffer'>Tiempo entre turnos (buffer)</Label>
                            <div className='flex items-center gap-2'>
                                <Input
                                    id='edit-service-buffer'
                                    type='number'
                                    min='0'
                                    max='120'
                                    step='5'
                                    value={formData.bufferMinutes}
                                    onChange={e =>
                                        setFormData({ ...formData, bufferMinutes: parseInt(e.target.value) || 0 })
                                    }
                                    disabled={isSubmitting}
                                    className='w-24'
                                />
                                <span className='text-sm text-zinc-500'>minutos</span>
                            </div>
                            <p className='text-xs text-zinc-500 dark:text-zinc-400'>
                                Tiempo de preparación entre un turno y el siguiente
                            </p>
                            {errors.bufferMinutes && (
                                <p className='text-sm text-red-600 dark:text-red-400'>{errors.bufferMinutes}</p>
                            )}
                        </div>

                        {/* Precio */}
                        <div className='space-y-2'>
                            <Label htmlFor='edit-service-price'>Precio (opcional)</Label>
                            <div className='flex items-center gap-2'>
                                <span className='text-sm text-zinc-500'>$</span>
                                <Input
                                    id='edit-service-price'
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

                        <DialogFooter className='gap-3 pt-4'>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => setIsEditOpen(false)}
                                disabled={isSubmitting}
                                className='cursor-pointer'
                            >
                                Cancelar
                            </Button>
                            <Button type='submit' disabled={isSubmitting} className='cursor-pointer'>
                                {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación para toggle activo/inactivo */}
            <Dialog open={isToggleOpen} onOpenChange={setIsToggleOpen}>
                <DialogContent className='sm:max-w-md'>
                    <DialogHeader>
                        <DialogTitle>{service.active ? 'Desactivar servicio' : 'Activar servicio'}</DialogTitle>
                        <DialogDescription>
                            {service.active
                                ? 'El servicio dejará de aparecer en tu página pública y no podrá ser reservado. Los turnos ya creados no se verán afectados.'
                                : 'El servicio volverá a estar disponible para reservas en tu página pública.'}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className='gap-3 pt-4'>
                        <Button
                            type='button'
                            variant='outline'
                            onClick={() => setIsToggleOpen(false)}
                            disabled={isToggling}
                            className='cursor-pointer'
                        >
                            Cancelar
                        </Button>
                        <Button
                            type='button'
                            onClick={handleToggleActive}
                            disabled={isToggling}
                            variant={service.active ? 'destructive' : 'default'}
                            className='cursor-pointer'
                        >
                            {isToggling
                                ? service.active
                                    ? 'Desactivando...'
                                    : 'Activando...'
                                : service.active
                                ? 'Desactivar'
                                : 'Activar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
