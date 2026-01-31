'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Loader2, MessageCircle, MessageCircleOff, Info } from 'lucide-react'
import axios from 'axios'

interface WhatsAppSettingsProps {
    businessId: string
    initialEnabled: boolean
}

/**
 * Component for managing WhatsApp notification settings per business.
 *
 * US-10.1: Allows admin to enable/disable WhatsApp as a notification channel.
 *
 * Note: This is a configuration toggle only. Actual message sending
 * will be implemented in US-10.2+.
 */
export function WhatsAppSettings({ businessId, initialEnabled }: WhatsAppSettingsProps) {
    const [enabled, setEnabled] = useState(initialEnabled)
    const [savedValue, setSavedValue] = useState(initialEnabled) // Track last saved value
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    const handleSave = async () => {
        setLoading(true)
        setMessage(null)
        try {
            await axios.patch(`/api/v1/businesses/${businessId}`, {
                whatsappNotificationsEnabled: enabled
            })

            setSavedValue(enabled) // Update saved value on success
            setMessage({ type: 'success', text: 'Configuración guardada correctamente.' })
        } catch (error) {
            console.error('Error saving WhatsApp settings:', error)
            setMessage({ type: 'error', text: 'No pudimos guardar la configuración. Intentá de nuevo.' })
        } finally {
            setLoading(false)
        }
    }

    const hasChanges = enabled !== savedValue

    return (
        <Card data-testid='whatsapp-settings'>
            <CardHeader>
                <div className='flex items-center gap-2'>
                    {enabled ? (
                        <MessageCircle className='h-5 w-5 text-green-500' />
                    ) : (
                        <MessageCircleOff className='h-5 w-5 text-muted-foreground' />
                    )}
                    <CardTitle>Notificaciones por WhatsApp</CardTitle>
                </div>
                <CardDescription>Enviá confirmaciones y recordatorios a tus clientes por WhatsApp.</CardDescription>
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
                        id='whatsapp-enabled'
                        checked={enabled}
                        onCheckedChange={checked => setEnabled(checked === true)}
                    />
                    <div className='grid gap-0.5 leading-none'>
                        <Label htmlFor='whatsapp-enabled' className='text-base font-medium'>
                            Activar notificaciones por WhatsApp
                        </Label>
                        <p className='text-sm text-muted-foreground'>
                            Los clientes recibirán confirmaciones y recordatorios por WhatsApp.
                        </p>
                    </div>
                </div>

                {/* Info message: Coming soon */}
                <div className='flex items-start gap-3 p-4 bg-blue-50 rounded-md'>
                    <Info className='h-5 w-5 text-blue-500 shrink-0 mt-0.5' />
                    <div className='text-sm text-blue-800'>
                        <p className='font-medium'>Próximamente disponible</p>
                        <p className='mt-1'>
                            El envío de mensajes por WhatsApp se habilitará próximamente. Podés activar esta opción
                            ahora para estar listo cuando la funcionalidad esté disponible.
                        </p>
                    </div>
                </div>

                {/* Save button */}
                <div className='flex justify-end'>
                    <Button onClick={handleSave} disabled={loading || !hasChanges}>
                        {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                        {loading ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
