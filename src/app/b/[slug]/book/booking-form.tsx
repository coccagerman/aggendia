'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2 } from 'lucide-react'

interface BookingFormProps {
    slug: string
    serviceId: string
    resourceId: string
    startAt: string
    businessName: string
    serviceName: string
    resourceName: string
    formattedDate: string
    businessTimezone: string
}

interface AppointmentResponse {
    appointmentId: string
    status: string
    startAt: string
    endAt: string
    service: { id: string; name: string }
    resource: { id: string; name: string }
    business: { name: string; timezone: string }
    customer: { fullName: string }
}

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export function BookingForm({
    slug,
    serviceId,
    resourceId,
    startAt,
    businessName,
    serviceName,
    resourceName,
    formattedDate
}: BookingFormProps) {
    const router = useRouter()
    const [formState, setFormState] = useState<FormState>('idle')
    const [appointment, setAppointment] = useState<AppointmentResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isSlotTaken, setIsSlotTaken] = useState(false)

    // Form fields
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [notes, setNotes] = useState('')

    // Validation
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {}

        if (!fullName.trim()) {
            errors.fullName = 'El nombre es requerido'
        }

        if (!email.trim() && !phone.trim()) {
            errors.contact = 'Debes proporcionar email o teléfono'
        }

        if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = 'Email inválido'
        }

        if (phone.trim() && phone.length < 6) {
            errors.phone = 'Teléfono muy corto'
        }

        setFieldErrors(errors)
        return Object.keys(errors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setFormState('submitting')
        setError(null)
        setIsSlotTaken(false)

        try {
            const response = await fetch('/api/v1/public/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    slug,
                    serviceId,
                    resourceId,
                    startAt,
                    customer: {
                        fullName: fullName.trim(),
                        email: email.trim() || undefined,
                        phone: phone.trim() || undefined
                    },
                    notes: notes.trim() || undefined
                })
            })

            const data = await response.json()

            if (!response.ok) {
                // Handle specific errors
                if (data.error?.code === 'APPOINTMENT_SLOT_TAKEN') {
                    setIsSlotTaken(true)
                    setError('El horario seleccionado ya no está disponible')
                } else {
                    setError(data.error?.message || 'Error al crear la reserva')
                }
                setFormState('error')
                return
            }

            setAppointment(data.data)
            setFormState('success')
        } catch {
            setError('Error de conexión. Intentá de nuevo.')
            setFormState('error')
        }
    }

    // Success state
    if (formState === 'success' && appointment) {
        return (
            <Card className='border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'>
                <CardHeader className='text-center'>
                    <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900'>
                        <CheckCircle2 className='h-8 w-8 text-green-600 dark:text-green-400' />
                    </div>
                    <CardTitle className='text-xl text-green-800 dark:text-green-200'>¡Reserva confirmada!</CardTitle>
                    <CardDescription className='text-green-700 dark:text-green-300'>
                        Tu turno ha sido registrado exitosamente
                    </CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <div className='rounded-lg bg-white p-4 dark:bg-zinc-900'>
                        <h3 className='mb-3 font-semibold'>Detalles de tu reserva</h3>
                        <div className='space-y-2 text-sm'>
                            <div className='flex justify-between'>
                                <span className='text-zinc-600 dark:text-zinc-400'>Negocio</span>
                                <span className='font-medium'>{businessName}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-zinc-600 dark:text-zinc-400'>Servicio</span>
                                <span className='font-medium'>{serviceName}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-zinc-600 dark:text-zinc-400'>Recurso</span>
                                <span className='font-medium'>{resourceName}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-zinc-600 dark:text-zinc-400'>Fecha y hora</span>
                                <span className='font-medium capitalize'>{formattedDate}</span>
                            </div>
                            <div className='flex justify-between'>
                                <span className='text-zinc-600 dark:text-zinc-400'>Cliente</span>
                                <span className='font-medium'>{appointment.customer.fullName}</span>
                            </div>
                        </div>
                    </div>

                    <p className='text-center text-sm text-green-700 dark:text-green-300'>
                        Te enviamos una confirmación por email.
                    </p>

                    <Button
                        variant='outline'
                        className='w-full cursor-pointer'
                        onClick={() => router.push(`/b/${slug}`)}
                    >
                        Volver al inicio
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-lg'>Tus datos</CardTitle>
                <CardDescription>Completá tus datos para confirmar la reserva</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className='space-y-4'>
                    {/* Full name */}
                    <div className='space-y-2'>
                        <Label htmlFor='fullName'>
                            Nombre completo <span className='text-red-500'>*</span>
                        </Label>
                        <Input
                            id='fullName'
                            type='text'
                            placeholder='Tu nombre'
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            disabled={formState === 'submitting'}
                            className={fieldErrors.fullName ? 'border-red-500' : ''}
                        />
                        {fieldErrors.fullName && <p className='text-sm text-red-500'>{fieldErrors.fullName}</p>}
                    </div>

                    {/* Email */}
                    <div className='space-y-2'>
                        <Label htmlFor='email'>Email</Label>
                        <Input
                            id='email'
                            type='email'
                            placeholder='tu@email.com'
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={formState === 'submitting'}
                            className={fieldErrors.email ? 'border-red-500' : ''}
                        />
                        {fieldErrors.email && <p className='text-sm text-red-500'>{fieldErrors.email}</p>}
                    </div>

                    {/* Phone */}
                    <div className='space-y-2'>
                        <Label htmlFor='phone'>Teléfono</Label>
                        <Input
                            id='phone'
                            type='tel'
                            placeholder='+54 11 1234-5678'
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            disabled={formState === 'submitting'}
                            className={fieldErrors.phone ? 'border-red-500' : ''}
                        />
                        {fieldErrors.phone && <p className='text-sm text-red-500'>{fieldErrors.phone}</p>}
                    </div>

                    {/* Contact validation error */}
                    {fieldErrors.contact && <p className='text-sm text-red-500'>{fieldErrors.contact}</p>}

                    {/* Notes */}
                    <div className='space-y-2'>
                        <Label htmlFor='notes'>Notas (opcional)</Label>
                        <Textarea
                            id='notes'
                            placeholder='Algún comentario o solicitud especial...'
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            disabled={formState === 'submitting'}
                            rows={3}
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className='rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950'>
                            <p className='text-sm text-red-800 dark:text-red-200'>{error}</p>
                            {isSlotTaken && (
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    className='mt-3 cursor-pointer'
                                    onClick={() =>
                                        router.push(`/b/${slug}/service/${serviceId}/resource/${resourceId}/slots`)
                                    }
                                >
                                    Elegir otro horario
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Submit button */}
                    <Button type='submit' className='w-full cursor-pointer' disabled={formState === 'submitting'}>
                        {formState === 'submitting' ? (
                            <>
                                <span className='mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                                Confirmando...
                            </>
                        ) : (
                            'Confirmar reserva'
                        )}
                    </Button>

                    <p className='text-center text-xs text-zinc-500'>
                        Al confirmar, aceptás las políticas del establecimiento.
                    </p>
                </form>
            </CardContent>
        </Card>
    )
}
