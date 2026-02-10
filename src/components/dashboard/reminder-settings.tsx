'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, Mail, MailX, Clock } from 'lucide-react'
import axios from 'axios'

interface ReminderSettingsProps {
    businessId: string
    initialEnabled: boolean
    initialOffsets: number[]
    children?: React.ReactNode
}

const OFFSET_OPTIONS = [
    { value: 1440, label: '24 horas antes', description: 'El día anterior al turno' },
    { value: 120, label: '2 horas antes', description: 'Poco antes del turno' }
] as const

export function ReminderSettings({ businessId, initialEnabled, initialOffsets, children }: ReminderSettingsProps) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [offsets, setOffsets] = useState<number[]>(initialOffsets)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const handleToggleOffset = (offset: number) => {
        setOffsets(prev => (prev.includes(offset) ? prev.filter(o => o !== offset) : [...prev, offset]))
    }

    const handleSave = async () => {
        setLoading(true)
        setMessage(null)
        try {
            await axios.patch(`/api/v1/businesses/${businessId}`, {
                remindersEnabled: enabled,
                reminderOffsetsMinutes: offsets
            })

            setMessage({ type: 'success', text: 'Configuración guardada correctamente.' })
        } catch (error) {
            console.error('Error saving reminder settings:', error)
            setMessage({ type: 'error', text: 'No pudimos guardar la configuración. Intentá de nuevo.' })
        } finally {
            setLoading(false)
        }
    }

    const hasChanges =
        enabled !== initialEnabled || JSON.stringify(offsets.sort()) !== JSON.stringify([...initialOffsets].sort())

    const feedbackMessage = message && (
        <div
            className={`p-3 rounded-md text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
        >
            {message.text}
        </div>
    )

    const saveButton = (
        <div className='flex justify-end'>
            <Button onClick={handleSave} disabled={loading || !hasChanges || (enabled && offsets.length === 0)}>
                {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {loading ? 'Guardando...' : 'Guardar cambios'}
            </Button>
        </div>
    )

    return (
        <>
            {/* Email notifications */}
            <Card>
                <CardHeader>
                    <div className='flex items-center gap-2'>
                        {enabled ? (
                            <Mail className='h-5 w-5 text-amber-500' />
                        ) : (
                            <MailX className='h-5 w-5 text-muted-foreground' />
                        )}
                        <CardTitle>Notificaciones por mail</CardTitle>
                    </div>
                    <CardDescription>Enviá notificaciones y recordatorios a tus clientes por mail.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                    {feedbackMessage}

                    {/* Enable/Disable toggle */}
                    <div className='flex items-start space-x-3'>
                        <Checkbox
                            id='reminders-enabled'
                            checked={enabled}
                            onCheckedChange={checked => setEnabled(checked === true)}
                        />
                        <div className='grid gap-0.5 leading-none'>
                            <Label htmlFor='reminders-enabled' className='text-base font-medium'>
                                Activar notificaciones por mail
                            </Label>
                            <p className='text-sm text-muted-foreground'>
                                Los clientes recibirán notificaciones y recordatorios por email automáticamente.
                            </p>
                        </div>
                    </div>

                    {saveButton}
                </CardContent>
            </Card>

            {children}

            {/* Notification timing */}
            <Card>
                <CardHeader>
                    <div className='flex items-center gap-2'>
                        <Clock className='h-5 w-5 text-indigo-500' />
                        <CardTitle>Cuándo enviar notificaciones</CardTitle>
                    </div>
                    <CardDescription>Seleccioná cuándo querés que se envíen las notificaciones.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                    {/* Confirmations — always on, not user-togglable */}
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className='flex items-start space-x-3 cursor-default'>
                                    <Checkbox id='confirmations' checked disabled />
                                    <div className='grid gap-0.5 leading-none'>
                                        <Label
                                            htmlFor='confirmations'
                                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                                        >
                                            Confirmaciones
                                        </Label>
                                        <p className='text-sm text-muted-foreground'>
                                            Al reservar, reprogramar o cancelar un turno.
                                        </p>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>No se puede desactivar</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    {/* Reminder offsets */}
                    <div className={`space-y-3 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Label className='text-sm font-medium'>Recordatorios</Label>
                        {OFFSET_OPTIONS.map(option => (
                            <div key={option.value} className='flex items-start space-x-3'>
                                <Checkbox
                                    id={`offset-${option.value}`}
                                    checked={offsets.includes(option.value)}
                                    onCheckedChange={() => handleToggleOffset(option.value)}
                                    disabled={!enabled}
                                />
                                <div className='grid gap-0.5 leading-none'>
                                    <Label
                                        htmlFor={`offset-${option.value}`}
                                        className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                                    >
                                        {option.label}
                                    </Label>
                                    <p className='text-sm text-muted-foreground'>{option.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {enabled && offsets.length === 0 && (
                        <p className='text-sm text-amber-600'>
                            Seleccioná al menos un momento para enviar recordatorios.
                        </p>
                    )}

                    {saveButton}
                </CardContent>
            </Card>
        </>
    )
}
