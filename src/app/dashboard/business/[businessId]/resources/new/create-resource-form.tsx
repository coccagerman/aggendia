'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CreateResourceFormProps {
    businessId: string
    resourceLabel: string
}

interface FormErrors {
    name?: string
    type?: string
    general?: string
}

export function CreateResourceForm({ businessId, resourceLabel }: CreateResourceFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<FormErrors>({})

    const [formData, setFormData] = useState({
        name: '',
        type: 'PERSON' as 'PERSON' | 'ASSET'
    })

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/resources`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    type: formData.type
                })
            })

            const data = await response.json()

            if (!response.ok) {
                // Manejo de errores según el código
                if (response.status === 409) {
                    setErrors({
                        name: `Ya existe un ${resourceLabel.toLowerCase()} con ese nombre en este negocio.`
                    })
                } else if (response.status === 400 && data.error?.details) {
                    // Error de validación
                    const validationErrors: FormErrors = {}
                    if (data.error.details.name) {
                        validationErrors.name = data.error.details.name
                    }
                    if (data.error.details.type) {
                        validationErrors.type = data.error.details.type
                    }
                    setErrors(validationErrors)
                } else {
                    setErrors({
                        general: data.error?.message || 'Ocurrió un error al crear el recurso. Intentá nuevamente.'
                    })
                }
                return
            }

            // Éxito: redirigir al dashboard
            router.push('/dashboard')
            router.refresh()
        } catch (error) {
            console.error('Error al enviar formulario:', error)
            setErrors({
                general: 'Ocurrió un error inesperado. Verificá tu conexión e intentá nuevamente.'
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Error general */}
            {errors.general && (
                <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'>
                    {errors.general}
                </div>
            )}

            {/* Campo: Nombre */}
            <div className='space-y-2'>
                <Label htmlFor='name'>
                    Nombre del {resourceLabel} <span className='text-red-500'>*</span>
                </Label>
                <Input
                    id='name'
                    type='text'
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={`Ej: ${resourceLabel} 1`}
                    required
                    disabled={isSubmitting}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                    <p id='name-error' className='text-sm text-red-600 dark:text-red-400'>
                        {errors.name}
                    </p>
                )}
            </div>

            {/* Campo: Tipo */}
            <div className='space-y-2'>
                <Label htmlFor='type'>Tipo de recurso</Label>
                <select
                    id='type'
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as 'PERSON' | 'ASSET' })}
                    disabled={isSubmitting}
                    className='flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300'
                >
                    <option value='PERSON'>Persona (Ej: profesional, instructor)</option>
                    <option value='ASSET'>Recurso físico (Ej: cancha, sala, equipo)</option>
                </select>
                {errors.type && (
                    <p id='type-error' className='text-sm text-red-600 dark:text-red-400'>
                        {errors.type}
                    </p>
                )}
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                    Seleccioná si este recurso es una persona o un elemento físico.
                </p>
            </div>

            {/* Botones */}
            <div className='flex items-center justify-end gap-3'>
                <Button type='button' variant='outline' onClick={() => router.back()} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting ? 'Creando...' : `Crear ${resourceLabel}`}
                </Button>
            </div>
        </form>
    )
}
