'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, Bell, BellOff } from 'lucide-react'
import axios from 'axios'

interface ReminderSettingsProps {
    businessId: string
    initialEnabled: boolean
    initialOffsets: number[]
}

const OFFSET_OPTIONS = [
    { value: 1440, label: '24 horas antes', description: 'El día anterior al turno' },
    { value: 120, label: '2 horas antes', description: 'Poco antes del turno' }
] as const

export function ReminderSettings({ businessId, initialEnabled, initialOffsets }: ReminderSettingsProps) {
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

    return (
        <Card>
            <CardHeader>
                <div className='flex items-center gap-2'>
                    {enabled ? (
                        <Bell className='h-5 w-5 text-amber-500' />
                    ) : (
                        <BellOff className='h-5 w-5 text-muted-foreground' />
                    )}
                    <CardTitle>Recordatorios automáticos</CardTitle>
                </div>
                <CardDescription>
                    Enviá recordatorios por email a tus clientes antes de su turno para reducir ausencias.
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
                {/* Message feedback */}
                {message && (
                    <div
                        className={`p-3 rounded-md text-sm ${
                            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                {/* Enable/Disable toggle */}
                <div className='flex items-start space-x-3'>
                    <Checkbox
                        id='reminders-enabled'
                        checked={enabled}
                        onCheckedChange={checked => setEnabled(checked === true)}
                    />
                    <div className='grid gap-0.5 leading-none'>
                        <Label htmlFor='reminders-enabled' className='text-base font-medium'>
                            Activar recordatorios
                        </Label>
                        <p className='text-sm text-muted-foreground'>
                            Los clientes recibirán emails de recordatorio automáticamente.
                        </p>
                    </div>
                </div>

                {/* Offset selection */}
                <div className={`space-y-4 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className='space-y-0.5'>
                        <Label className='text-base'>Cuándo enviar recordatorios</Label>
                        <p className='text-sm text-muted-foreground'>
                            Seleccioná cuándo querés que se envíen los recordatorios.
                        </p>
                    </div>

                    <div className='space-y-3'>
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
                </div>

                {/* Save button */}
                <div className='flex justify-end'>
                    <Button onClick={handleSave} disabled={loading || !hasChanges || (enabled && offsets.length === 0)}>
                        {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                        {loading ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
