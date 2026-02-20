'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface Service {
    id: string
    name: string
    durationMinutes: number
    status: string
}

interface Resource {
    resourceId: string
    resourceName: string
    resourceStatus: string
}

interface Slot {
    startAt: string
    endAt: string
    displayTime: string
}

interface CreateAppointmentDialogProps {
    businessId: string
    timezone: string
    resourceLabel: string
}

export function CreateAppointmentDialog({ businessId, timezone, resourceLabel }: CreateAppointmentDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isLoadingServices, setIsLoadingServices] = useState(false)
    const [isLoadingResources, setIsLoadingResources] = useState(false)
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // AbortController refs to cancel previous requests
    const servicesAbortControllerRef = useRef<AbortController | null>(null)
    const resourcesAbortControllerRef = useRef<AbortController | null>(null)
    const slotsAbortControllerRef = useRef<AbortController | null>(null)

    // Form data
    const [services, setServices] = useState<Service[]>([])
    const [resources, setResources] = useState<Resource[]>([])
    const [slots, setSlots] = useState<Slot[]>([])

    // Selected values
    const [selectedServiceId, setSelectedServiceId] = useState<string>('')
    const [selectedResourceId, setSelectedResourceId] = useState<string>('')
    const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)

    // Customer data
    const [customerName, setCustomerName] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [notes, setNotes] = useState('')

    // Date selection
    const getTodayInBusinessTz = useCallback(() => {
        const nowInTz = toZonedTime(new Date(), timezone)
        return format(nowInTz, 'yyyy-MM-dd')
    }, [timezone])

    const [selectedDate, setSelectedDate] = useState<string>(() => getTodayInBusinessTz())

    // Fetch active services when dialog opens
    const fetchServices = useCallback(async () => {
        // Cancel any previous services request
        if (servicesAbortControllerRef.current) {
            servicesAbortControllerRef.current.abort()
        }

        if (!open) {
            setIsLoadingServices(false)
            return
        }

        // Create new abort controller for this request
        const abortController = new AbortController()
        servicesAbortControllerRef.current = abortController

        setIsLoadingServices(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/services`, {
                signal: abortController.signal
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error?.message || 'Error al cargar servicios')
            }

            const data = await response.json()
            // Filter only ACTIVE services
            const activeServices = (data.data || []).filter((s: Service) => s.status === 'ACTIVE')
            setServices(activeServices)
        } catch (err) {
            // Ignore abort errors (expected when dialog closes quickly)
            if (err instanceof Error && err.name === 'AbortError') {
                return
            }
            setError(err instanceof Error ? err.message : 'Error al cargar servicios')
            setServices([])
        } finally {
            // Only update loading state if this request wasn't aborted
            if (!abortController.signal.aborted) {
                setIsLoadingServices(false)
            }
        }
    }, [open, businessId])

    // Fetch resources when service changes
    const fetchResources = useCallback(async () => {
        // Cancel any previous resources request
        if (resourcesAbortControllerRef.current) {
            resourcesAbortControllerRef.current.abort()
        }

        if (!selectedServiceId) {
            setResources([])
            setIsLoadingResources(false)
            return
        }

        // Create new abort controller for this request
        const abortController = new AbortController()
        resourcesAbortControllerRef.current = abortController

        setIsLoadingResources(true)
        setError(null)
        setSelectedResourceId('')
        setSelectedSlot(null)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/services/${selectedServiceId}/resources`, {
                signal: abortController.signal
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error?.message || 'Error al cargar recursos / prestadores')
            }

            const data = await response.json()
            // Filter only ACTIVE resources
            const activeResources = (data.data || []).filter((r: Resource) => r.resourceStatus === 'ACTIVE')
            setResources(activeResources)
        } catch (err) {
            // Ignore abort errors (expected when user changes selection quickly)
            if (err instanceof Error && err.name === 'AbortError') {
                return
            }
            setError(err instanceof Error ? err.message : 'Error al cargar recursos / prestadores')
            setResources([])
        } finally {
            // Only update loading state if this request wasn't aborted
            if (!abortController.signal.aborted) {
                setIsLoadingResources(false)
            }
        }
    }, [selectedServiceId, businessId])

    // Fetch slots when resource/date changes
    const fetchSlots = useCallback(async () => {
        // Cancel any previous slots request
        if (slotsAbortControllerRef.current) {
            slotsAbortControllerRef.current.abort()
        }

        if (!selectedServiceId || !selectedResourceId) {
            setSlots([])
            setIsLoadingSlots(false)
            return
        }

        // Create new abort controller for this request
        const abortController = new AbortController()
        slotsAbortControllerRef.current = abortController

        setIsLoadingSlots(true)
        setError(null)
        setSelectedSlot(null)

        try {
            // Convert selected date to UTC range
            const fromDateInTz = fromZonedTime(`${selectedDate}T00:00:00`, timezone)
            const toDate = addDays(fromDateInTz, 1)

            const params = new URLSearchParams({
                serviceId: selectedServiceId,
                resourceId: selectedResourceId,
                fromDate: fromDateInTz.toISOString(),
                toDate: toDate.toISOString()
            })

            // Use private endpoint (no min booking notice)
            const response = await fetch(`/api/v1/businesses/${businessId}/slots?${params}`, {
                signal: abortController.signal
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error?.message || 'Error al cargar horarios')
            }

            const data = await response.json()
            setSlots(data.data || [])
        } catch (err) {
            // Ignore abort errors (expected when user changes selection quickly)
            if (err instanceof Error && err.name === 'AbortError') {
                return
            }
            setError(err instanceof Error ? err.message : 'Error al cargar horarios')
            setSlots([])
        } finally {
            // Only update loading state if this request wasn't aborted
            if (!abortController.signal.aborted) {
                setIsLoadingSlots(false)
            }
        }
    }, [selectedServiceId, selectedResourceId, selectedDate, businessId, timezone])

    // Effects
    useEffect(() => {
        fetchServices()
    }, [fetchServices])

    useEffect(() => {
        fetchResources()
    }, [fetchResources])

    useEffect(() => {
        fetchSlots()
    }, [fetchSlots])

    // Handlers
    async function handleSubmit() {
        if (!selectedSlot || !customerName.trim()) return
        if (!customerEmail.trim() && !customerPhone.trim()) {
            setError('Debe proporcionar email o teléfono')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/businesses/${businessId}/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serviceId: selectedServiceId,
                    resourceId: selectedResourceId,
                    startAt: selectedSlot.startAt,
                    customer: {
                        fullName: customerName.trim(),
                        email: customerEmail.trim() || undefined,
                        phone: customerPhone.trim() || undefined
                    },
                    notes: notes.trim() || undefined
                })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error?.message || 'Error al crear el turno')
            }

            // Success - close dialog and refresh
            setOpen(false)
            resetForm()
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al crear el turno')
        } finally {
            setIsSubmitting(false)
        }
    }

    function resetForm() {
        setSelectedServiceId('')
        setSelectedResourceId('')
        setSelectedSlot(null)
        setCustomerName('')
        setCustomerEmail('')
        setCustomerPhone('')
        setNotes('')
        setSelectedDate(getTodayInBusinessTz())
        setError(null)
    }

    function handleOpenChange(newOpen: boolean) {
        if (!isSubmitting) {
            setOpen(newOpen)
            if (!newOpen) {
                resetForm()
            }
        }
    }

    // Date navigation - uses business timezone to avoid DST issues
    function handlePreviousDay() {
        const today = getTodayInBusinessTz()
        // Parse selectedDate in business timezone, subtract a day, format back
        const currentDateInTz = toZonedTime(fromZonedTime(`${selectedDate}T12:00:00`, timezone), timezone)
        const previousDay = subDays(currentDateInTz, 1)
        const previousDayStr = format(previousDay, 'yyyy-MM-dd')

        if (previousDayStr >= today) {
            setSelectedDate(previousDayStr)
        }
    }

    function handleNextDay() {
        // Parse selectedDate in business timezone, add a day, format back
        const currentDateInTz = toZonedTime(fromZonedTime(`${selectedDate}T12:00:00`, timezone), timezone)
        const nextDay = addDays(currentDateInTz, 1)
        const nextDayStr = format(nextDay, 'yyyy-MM-dd')
        setSelectedDate(nextDayStr)
    }

    function handleDatePickerChange(date: Date) {
        const newDateStr = format(date, 'yyyy-MM-dd')
        const today = getTodayInBusinessTz()
        if (newDateStr >= today) {
            setSelectedDate(newDateStr)
        }
    }

    const minDate = getTodayInBusinessTz()
    const isPreviousDisabled = selectedDate <= minDate

    // Convert selectedDate string to Date object for DatePicker
    const dateValue = parseISO(selectedDate + 'T12:00:00')
    const minDateValue = parseISO(minDate + 'T00:00:00')

    // Check if form is valid for submit
    const isFormValid =
        selectedServiceId &&
        selectedResourceId &&
        selectedSlot &&
        customerName.trim() &&
        (customerEmail.trim() || customerPhone.trim())

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className='h-4 w-4 mr-2' />
                    Crear turno
                </Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-lg max-h-[90vh] overflow-y-auto'>
                <DialogHeader>
                    <DialogTitle>Crear turno manualmente</DialogTitle>
                    <DialogDescription>
                        Creá un turno para una reserva tomada por teléfono o en persona.
                    </DialogDescription>
                </DialogHeader>

                <div className='space-y-4 py-4'>
                    {/* Service selector */}
                    <div className='space-y-2'>
                        <Label htmlFor='service'>Servicio</Label>
                        <Select
                            value={selectedServiceId}
                            onValueChange={setSelectedServiceId}
                            disabled={isLoadingServices}
                        >
                            <SelectTrigger id='service'>
                                <SelectValue placeholder='Seleccionar servicio' />
                            </SelectTrigger>
                            <SelectContent>
                                {services.map(service => (
                                    <SelectItem key={service.id} value={service.id}>
                                        {service.name} ({service.durationMinutes} min)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isLoadingServices && <p className='text-sm text-zinc-500'>Cargando servicios...</p>}
                        {!isLoadingServices && services.length === 0 && (
                            <p className='text-sm text-zinc-500'>No hay servicios activos disponibles</p>
                        )}
                    </div>

                    {/* Resource selector */}
                    <div className='space-y-2'>
                        <Label htmlFor='resource'>{resourceLabel}</Label>
                        <Select
                            value={selectedResourceId}
                            onValueChange={setSelectedResourceId}
                            disabled={!selectedServiceId || isLoadingResources}
                        >
                            <SelectTrigger id='resource' aria-label='Seleccionar recurso / prestador'>
                                <SelectValue placeholder={`Seleccionar ${resourceLabel.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {resources.map(resource => (
                                    <SelectItem key={resource.resourceId} value={resource.resourceId}>
                                        {resource.resourceName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isLoadingResources && (
                            <p className='text-sm text-zinc-500'>Cargando {resourceLabel.toLowerCase()}s...</p>
                        )}
                        {selectedServiceId && !isLoadingResources && resources.length === 0 && (
                            <p className='text-sm text-zinc-500'>
                                No hay {resourceLabel.toLowerCase()}s disponibles para este servicio
                            </p>
                        )}
                    </div>

                    {/* Date selector */}
                    {selectedResourceId && (
                        <div className='space-y-2'>
                            <Label>Fecha</Label>
                            <div className='flex items-center gap-2'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='icon'
                                    onClick={handlePreviousDay}
                                    disabled={isPreviousDisabled || isLoadingSlots}
                                    aria-label='Día anterior'
                                    className='cursor-pointer'
                                >
                                    <ChevronLeft className='h-4 w-4' />
                                </Button>
                                <DatePicker
                                    value={dateValue}
                                    onChange={handleDatePickerChange}
                                    mode='day'
                                    minDate={minDateValue}
                                    disabled={isLoadingSlots}
                                    className='flex-1'
                                />
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='icon'
                                    onClick={handleNextDay}
                                    disabled={isLoadingSlots}
                                    aria-label='Día siguiente'
                                    className='cursor-pointer'
                                >
                                    <ChevronRight className='h-4 w-4' />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Slots grid */}
                    {selectedResourceId && (
                        <div className='space-y-2'>
                            <Label>Horarios disponibles</Label>

                            {isLoadingSlots && (
                                <div className='flex justify-center py-8'>
                                    <Loader2 className='h-6 w-6 animate-spin text-zinc-400' />
                                </div>
                            )}

                            {!isLoadingSlots && slots.length === 0 && (
                                <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-900'>
                                    <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                                        No hay horarios disponibles para este día.
                                    </p>
                                </div>
                            )}

                            {!isLoadingSlots && slots.length > 0 && (
                                <div className='grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1'>
                                    {slots.map(slot => (
                                        <Button
                                            key={slot.startAt}
                                            type='button'
                                            variant={selectedSlot?.startAt === slot.startAt ? 'default' : 'outline'}
                                            size='sm'
                                            onClick={() => setSelectedSlot(slot)}
                                            className='text-sm'
                                        >
                                            {slot.displayTime}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customer data */}
                    {selectedSlot && (
                        <>
                            <div className='border-t border-zinc-200 dark:border-zinc-800 pt-4'>
                                <h4 className='text-sm font-medium mb-3'>Datos del cliente</h4>
                            </div>

                            <div className='space-y-2'>
                                <Label htmlFor='customerName'>Nombre completo *</Label>
                                <Input
                                    id='customerName'
                                    type='text'
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder='Juan Pérez'
                                    maxLength={100}
                                />
                            </div>

                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'>
                                    <Label htmlFor='customerEmail'>Email</Label>
                                    <Input
                                        id='customerEmail'
                                        type='email'
                                        value={customerEmail}
                                        onChange={e => setCustomerEmail(e.target.value)}
                                        placeholder='juan@email.com'
                                    />
                                </div>
                                <div className='space-y-2'>
                                    <Label htmlFor='customerPhone'>Teléfono</Label>
                                    <Input
                                        id='customerPhone'
                                        type='tel'
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        placeholder='+54 11 1234-5678'
                                        maxLength={20}
                                    />
                                </div>
                            </div>
                            <p className='text-xs text-zinc-500'>* Debe proporcionar email o teléfono</p>

                            <div className='space-y-2'>
                                <Label htmlFor='notes'>Notas (opcional)</Label>
                                <Textarea
                                    id='notes'
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder='Notas adicionales sobre el turno...'
                                    maxLength={500}
                                    rows={2}
                                />
                            </div>
                        </>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className='rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950'>
                            <p className='text-sm text-red-800 dark:text-red-200'>{error}</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button type='button' onClick={handleSubmit} disabled={!isFormValid || isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                                Creando...
                            </>
                        ) : (
                            'Crear turno'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
