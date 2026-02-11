'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, Mail, MailX, MessageCircle, MessageCircleOff, Clock } from 'lucide-react'
import axios from 'axios'

// ── Shared constants ──────────────────────────────────────────────────────────

const OFFSET_OPTIONS = [
    { value: 1440, label: '24 horas antes', description: 'El día anterior al turno' },
    { value: 120, label: '2 horas antes', description: 'Poco antes del turno' }
] as const

const E164_REGEX = /^\+[1-9]\d{6,14}$/

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NotificationSettingsProps {
    businessId: string
    // Customer settings
    customerEmailEnabled: boolean
    customerWhatsappEnabled: boolean
    customerRemindersEnabled: boolean
    customerReminderOffsets: number[]
    // Owner settings
    ownerEmail: string | null
    ownerEmailEnabled: boolean
    ownerWhatsappEnabled: boolean
    ownerPhoneE164: string | null
    ownerRemindersEnabled: boolean
    ownerReminderOffsets: number[]
}

/**
 * Unified notification settings component with two-column layout.
 *
 * Left column: customer notifications (mail, WhatsApp, timing)
 * Right column: business owner notifications (mail, WhatsApp, timing)
 * One shared "Guardar" button at the bottom.
 *
 * Each side is independent: toggling customer settings does NOT affect
 * business settings and vice versa.
 */
export function NotificationSettings({
    businessId,
    // Customer
    customerEmailEnabled,
    customerWhatsappEnabled,
    customerRemindersEnabled,
    customerReminderOffsets,
    // Owner
    ownerEmail,
    ownerEmailEnabled,
    ownerWhatsappEnabled,
    ownerPhoneE164: initialOwnerPhone,
    ownerRemindersEnabled,
    ownerReminderOffsets
}: NotificationSettingsProps) {
    // ── Customer state ────────────────────────────────────────────────────────
    const [cEmailEnabled, setCEmailEnabled] = useState(customerEmailEnabled)
    const [cWhatsappEnabled, setCWhatsappEnabled] = useState(customerWhatsappEnabled)
    const [cRemindersEnabled, setCRemindersEnabled] = useState(customerRemindersEnabled)
    const [cOffsets, setCOffsets] = useState<number[]>(customerReminderOffsets)

    // ── Owner state ───────────────────────────────────────────────────────────
    const [oEmailEnabled, setOEmailEnabled] = useState(ownerEmailEnabled)
    const [oWhatsappEnabled, setOWhatsappEnabled] = useState(ownerWhatsappEnabled)
    const [oPhone, setOPhone] = useState(initialOwnerPhone ?? '')
    const [oRemindersEnabled, setORemindersEnabled] = useState(ownerRemindersEnabled)
    const [oOffsets, setOOffsets] = useState<number[]>(ownerReminderOffsets)

    // ── Saved values for change detection ─────────────────────────────────────
    const [saved, setSaved] = useState({
        cEmailEnabled: customerEmailEnabled,
        cWhatsappEnabled: customerWhatsappEnabled,
        cRemindersEnabled: customerRemindersEnabled,
        cOffsets: customerReminderOffsets,
        oEmailEnabled: ownerEmailEnabled,
        oWhatsappEnabled: ownerWhatsappEnabled,
        oPhone: initialOwnerPhone ?? '',
        oRemindersEnabled: ownerRemindersEnabled,
        oOffsets: ownerReminderOffsets
    })

    // ── UI state ──────────────────────────────────────────────────────────────
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // ── Derived ───────────────────────────────────────────────────────────────
    const phoneValid = !oWhatsappEnabled || E164_REGEX.test(oPhone)
    const cOffsetsValid = !cRemindersEnabled || cOffsets.length > 0
    const oOffsetsValid = !oRemindersEnabled || oOffsets.length > 0

    const hasChanges =
        cEmailEnabled !== saved.cEmailEnabled ||
        cWhatsappEnabled !== saved.cWhatsappEnabled ||
        cRemindersEnabled !== saved.cRemindersEnabled ||
        JSON.stringify([...cOffsets].sort()) !== JSON.stringify([...saved.cOffsets].sort()) ||
        oEmailEnabled !== saved.oEmailEnabled ||
        oWhatsappEnabled !== saved.oWhatsappEnabled ||
        oPhone !== saved.oPhone ||
        oRemindersEnabled !== saved.oRemindersEnabled ||
        JSON.stringify([...oOffsets].sort()) !== JSON.stringify([...saved.oOffsets].sort())

    const canSave = hasChanges && phoneValid && cOffsetsValid && oOffsetsValid && !loading

    // ── Handlers ──────────────────────────────────────────────────────────────
    const toggleCOffset = (v: number) =>
        setCOffsets(prev => (prev.includes(v) ? prev.filter(o => o !== v) : [...prev, v]))

    const toggleOOffset = (v: number) =>
        setOOffsets(prev => (prev.includes(v) ? prev.filter(o => o !== v) : [...prev, v]))

    const handleSave = async () => {
        setLoading(true)
        setMessage(null)
        try {
            await axios.patch(`/api/v1/businesses/${businessId}`, {
                // Customer
                emailNotificationsEnabled: cEmailEnabled,
                whatsappNotificationsEnabled: cWhatsappEnabled,
                remindersEnabled: cRemindersEnabled,
                reminderOffsetsMinutes: cOffsets,
                // Owner
                ownerEmailNotificationsEnabled: oEmailEnabled,
                ownerWhatsappNotificationsEnabled: oWhatsappEnabled,
                ownerPhoneE164: oPhone || null,
                ownerRemindersEnabled: oRemindersEnabled,
                ownerReminderOffsetsMinutes: oOffsets
            })

            setSaved({
                cEmailEnabled,
                cWhatsappEnabled,
                cRemindersEnabled,
                cOffsets,
                oEmailEnabled,
                oWhatsappEnabled,
                oPhone,
                oRemindersEnabled,
                oOffsets
            })
            setMessage({ type: 'success', text: 'Configuración guardada correctamente.' })
        } catch {
            setMessage({ type: 'error', text: 'No pudimos guardar la configuración. Intentá de nuevo.' })
        } finally {
            setLoading(false)
        }
    }

    // ── Render helpers ────────────────────────────────────────────────────────

    const feedbackBanner = message && (
        <div
            className={`p-3 rounded-md text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
        >
            {message.text}
        </div>
    )

    return (
        <div className='space-y-4' data-testid='notification-settings'>
            {feedbackBanner}

            <div className='grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6'>
                {/* ══════════════════════════════════════════════════════════
                    LEFT COLUMN — Notificaciones al cliente
                   ══════════════════════════════════════════════════════════ */}
                <section className='space-y-4' data-testid='customer-notification-settings'>
                    <div>
                        <h2 className='text-base font-semibold text-gray-900'>Notificaciones al cliente</h2>
                        <p className='text-xs text-muted-foreground'>
                            Configurá las notificaciones que reciben tus clientes al reservar, cancelar o reprogramar un
                            turno.
                        </p>
                    </div>

                    {/* Email card */}
                    <Card>
                        <CardHeader className='pb-3'>
                            <div className='flex items-center gap-2'>
                                {cEmailEnabled ? (
                                    <Mail className='h-4 w-4 text-amber-500' />
                                ) : (
                                    <MailX className='h-4 w-4 text-muted-foreground' />
                                )}
                                <CardTitle className='text-sm'>Notificaciones por mail</CardTitle>
                            </div>
                            <CardDescription className='text-xs'>
                                Enviá notificaciones y recordatorios a tus clientes por mail.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='pt-0'>
                            <div className='flex items-start space-x-3'>
                                <Checkbox
                                    id='c-email-enabled'
                                    checked={cEmailEnabled}
                                    onCheckedChange={checked => setCEmailEnabled(checked === true)}
                                />
                                <div className='grid gap-0.5 leading-none'>
                                    <Label htmlFor='c-email-enabled' className='text-xs font-medium'>
                                        Activar notificaciones por mail
                                    </Label>
                                    <p className='text-xs text-muted-foreground'>
                                        Los clientes recibirán notificaciones y recordatorios por email automáticamente.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* WhatsApp card */}
                    <Card data-testid='whatsapp-settings'>
                        <CardHeader className='pb-3'>
                            <div className='flex items-center gap-2'>
                                {cWhatsappEnabled ? (
                                    <MessageCircle className='h-4 w-4 text-green-500' />
                                ) : (
                                    <MessageCircleOff className='h-4 w-4 text-muted-foreground' />
                                )}
                                <CardTitle className='text-sm'>Notificaciones por WhatsApp</CardTitle>
                            </div>
                            <CardDescription className='text-xs'>
                                Enviá notificaciones y recordatorios a tus clientes por WhatsApp.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='pt-0'>
                            <div className='flex items-start space-x-3'>
                                <Checkbox
                                    id='c-whatsapp-enabled'
                                    checked={cWhatsappEnabled}
                                    onCheckedChange={checked => setCWhatsappEnabled(checked === true)}
                                />
                                <div className='grid gap-0.5 leading-none'>
                                    <Label htmlFor='c-whatsapp-enabled' className='text-xs font-medium'>
                                        Activar notificaciones por WhatsApp
                                    </Label>
                                    <p className='text-xs text-muted-foreground'>
                                        Los clientes recibirán notificaciones y recordatorios por WhatsApp
                                        automáticamente.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timing card */}
                    <TimingCard
                        prefix='c'
                        variant='customer'
                        remindersEnabled={cRemindersEnabled}
                        offsets={cOffsets}
                        onToggleReminders={setCRemindersEnabled}
                        onToggleOffset={toggleCOffset}
                    />
                </section>

                {/* ── Vertical separator ────────────────────────────────── */}
                <div className='hidden lg:block w-px bg-border' />

                {/* ══════════════════════════════════════════════════════════
                    RIGHT COLUMN — Notificaciones al negocio
                   ══════════════════════════════════════════════════════════ */}
                <section className='space-y-4' data-testid='business-notification-settings'>
                    <div>
                        <h2 className='text-base font-semibold text-gray-900'>Notificaciones al negocio</h2>
                        <p className='text-xs text-muted-foreground'>
                            Configurá las notificaciones que recibís vos cuando un cliente reserva, cancela o reprograma
                            un turno.
                        </p>
                    </div>

                    {/* Email card */}
                    <Card>
                        <CardHeader className='pb-3'>
                            <div className='flex items-center gap-2'>
                                {oEmailEnabled ? (
                                    <Mail className='h-4 w-4 text-blue-500' />
                                ) : (
                                    <MailX className='h-4 w-4 text-muted-foreground' />
                                )}
                                <CardTitle className='text-sm'>Email al negocio</CardTitle>
                            </div>
                            <CardDescription className='text-xs'>
                                Recibí un email cada vez que un cliente reserve, cancele o reprograme un turno.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-3 pt-0'>
                            <div className='flex items-start space-x-3'>
                                <Checkbox
                                    id='o-email-enabled'
                                    checked={oEmailEnabled}
                                    onCheckedChange={checked => setOEmailEnabled(checked === true)}
                                    disabled={!ownerEmail}
                                />
                                <div className='grid gap-0.5 leading-none'>
                                    <Label htmlFor='o-email-enabled' className='text-xs font-medium'>
                                        Activar notificaciones por email
                                    </Label>
                                    {ownerEmail ? (
                                        <p className='text-xs text-muted-foreground'>
                                            Se enviarán a{' '}
                                            <span className='font-medium text-foreground'>{ownerEmail}</span>
                                        </p>
                                    ) : (
                                        <p className='text-xs text-amber-600'>
                                            No hay un email de dueño configurado. Se asigna automáticamente al crear el
                                            negocio.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* WhatsApp card */}
                    <Card>
                        <CardHeader className='pb-3'>
                            <div className='flex items-center gap-2'>
                                {oWhatsappEnabled ? (
                                    <MessageCircle className='h-4 w-4 text-green-500' />
                                ) : (
                                    <MessageCircleOff className='h-4 w-4 text-muted-foreground' />
                                )}
                                <CardTitle className='text-sm'>WhatsApp al negocio</CardTitle>
                            </div>
                            <CardDescription className='text-xs'>
                                Recibí un WhatsApp cada vez que un cliente reserve, cancele o reprograme un turno.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-3 pt-0'>
                            <div className='flex items-start space-x-3'>
                                <Checkbox
                                    id='o-whatsapp-enabled'
                                    checked={oWhatsappEnabled}
                                    onCheckedChange={checked => setOWhatsappEnabled(checked === true)}
                                />
                                <div className='grid gap-0.5 leading-none'>
                                    <Label htmlFor='o-whatsapp-enabled' className='text-xs font-medium'>
                                        Activar notificaciones por WhatsApp
                                    </Label>
                                    <p className='text-xs text-muted-foreground'>
                                        Se enviará al número de teléfono que ingresés a continuación.
                                    </p>
                                </div>
                            </div>

                            {oWhatsappEnabled && (
                                <div className='space-y-1 pl-7'>
                                    <Label htmlFor='o-phone' className='text-xs'>
                                        Número de teléfono (formato E.164)
                                    </Label>
                                    <Input
                                        id='o-phone'
                                        placeholder='+5491155667788'
                                        value={oPhone}
                                        onChange={e => setOPhone(e.target.value)}
                                        className='h-8 text-sm'
                                    />
                                    {oPhone && !phoneValid && (
                                        <p className='text-xs text-red-600'>
                                            El número debe estar en formato E.164 (ej: +5491155667788).
                                        </p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Timing card */}
                    <TimingCard
                        prefix='o'
                        variant='owner'
                        remindersEnabled={oRemindersEnabled}
                        offsets={oOffsets}
                        onToggleReminders={setORemindersEnabled}
                        onToggleOffset={toggleOOffset}
                    />
                </section>
            </div>

            {/* ── Shared save button ──────────────────────────────────────── */}
            <div className='flex justify-end'>
                <Button onClick={handleSave} disabled={!canSave}>
                    {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                    {loading ? 'Guardando...' : 'Guardar cambios'}
                </Button>
            </div>
        </div>
    )
}

// ── Timing sub-component ──────────────────────────────────────────────────────

interface TimingCardProps {
    prefix: string
    variant: 'customer' | 'owner'
    remindersEnabled: boolean
    offsets: number[]
    onToggleReminders: (enabled: boolean) => void
    onToggleOffset: (offset: number) => void
}

function TimingCard({
    prefix,
    variant,
    remindersEnabled,
    offsets,
    onToggleReminders,
    onToggleOffset
}: TimingCardProps) {
    const isOwner = variant === 'owner'

    return (
        <Card>
            <CardHeader className='pb-3'>
                <div className='flex items-center gap-2'>
                    <Clock className='h-4 w-4 text-indigo-500' />
                    <CardTitle className='text-sm'>
                        {isOwner ? 'Cuándo recibir notificaciones' : 'Cuándo enviar notificaciones'}
                    </CardTitle>
                </div>
                <CardDescription className='text-xs'>
                    {isOwner
                        ? 'Seleccioná cuándo querés recibir las notificaciones.'
                        : 'Seleccioná cuándo querés que se envíen las notificaciones.'}
                </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4 pt-0'>
                {/* Confirmations — always on */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className='flex items-start space-x-3 cursor-default'>
                                <Checkbox id={`${prefix}-confirmations`} checked disabled />
                                <div className='grid gap-0.5 leading-none'>
                                    <Label
                                        htmlFor={`${prefix}-confirmations`}
                                        className='text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                                    >
                                        Confirmaciones
                                    </Label>
                                    <p className='text-xs text-muted-foreground'>
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

                {/* Reminders toggle */}
                <div className='flex items-start space-x-3'>
                    <Checkbox
                        id={`${prefix}-reminders-enabled`}
                        checked={remindersEnabled}
                        onCheckedChange={checked => onToggleReminders(checked === true)}
                    />
                    <div className='grid gap-0.5 leading-none'>
                        <Label htmlFor={`${prefix}-reminders-enabled`} className='text-xs font-medium'>
                            Recordatorios
                        </Label>
                        <p className='text-xs text-muted-foreground'>
                            {isOwner
                                ? 'Recibí recordatorios antes de cada turno.'
                                : 'Enviá recordatorios antes de cada turno.'}
                        </p>
                    </div>
                </div>

                {/* Offset options */}
                <div className={`space-y-2 pl-7 ${!remindersEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    {OFFSET_OPTIONS.map(option => (
                        <div key={option.value} className='flex items-start space-x-3'>
                            <Checkbox
                                id={`${prefix}-offset-${option.value}`}
                                checked={offsets.includes(option.value)}
                                onCheckedChange={() => onToggleOffset(option.value)}
                                disabled={!remindersEnabled}
                            />
                            <div className='grid gap-0.5 leading-none'>
                                <Label
                                    htmlFor={`${prefix}-offset-${option.value}`}
                                    className='text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                                >
                                    {option.label}
                                </Label>
                                <p className='text-xs text-muted-foreground'>{option.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {remindersEnabled && offsets.length === 0 && (
                    <p className='text-xs text-amber-600'>Seleccioná al menos un momento para enviar recordatorios.</p>
                )}
            </CardContent>
        </Card>
    )
}
