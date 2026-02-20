'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
    countryRequiresTimezoneSelection,
    COUNTRY_OPTIONS,
    getSelectableTimezonesForCountry,
    inferCountryFromTimezoneSelection,
    inferCountryFromBrowser,
    inferTimezoneFromBrowser,
    isSupportedCountryIso2,
    isValidIanaTimezone,
    resolveTimezoneForCountry
} from '@/lib/country'

interface CompleteCountryFormProps {
    initialCountryIso2: string | null
    initialAccountTimezone: string | null
}

function normalizeTimezoneToken(value: string): string {
    return value.replace(/[_-]/g, ' ').toLowerCase()
}

function getCountrySearchTerms(countryIso2: string): string[] {
    switch (countryIso2) {
        case 'CL':
            return ['chile']
        case 'MX':
            return ['mexico', 'méxico']
        default:
            return []
    }
}

function buildTimezoneSearchKey(timezoneValue: string, countryIso2: string): string {
    const parts = timezoneValue.split('/').map(normalizeTimezoneToken)
    const extraCountryTerms = getCountrySearchTerms(countryIso2)

    return [normalizeTimezoneToken(timezoneValue), ...parts, ...extraCountryTerms].join(' ')
}

function formatTimezoneOptionLabel(timezoneValue: string, countryIso2: string): string {
    if (countryIso2 === 'CL') {
        return `Chile · ${timezoneValue}`
    }

    if (countryIso2 === 'MX') {
        return `México · ${timezoneValue}`
    }

    return timezoneValue
}

export function CompleteCountryForm({ initialCountryIso2, initialAccountTimezone }: CompleteCountryFormProps) {
    const router = useRouter()
    const [countryIso2, setCountryIso2] = useState<string>(() => {
        if (isSupportedCountryIso2(initialCountryIso2)) {
            return initialCountryIso2 ?? ''
        }

        const detectedCountry = inferCountryFromBrowser()
        return isSupportedCountryIso2(detectedCountry) ? (detectedCountry ?? '') : ''
    })
    const [timezone, setTimezone] = useState<string>(() => {
        if (initialAccountTimezone && isValidIanaTimezone(initialAccountTimezone)) {
            return initialAccountTimezone
        }

        const detectedTimezone = inferTimezoneFromBrowser()
        return detectedTimezone ?? ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [timezoneSearch, setTimezoneSearch] = useState('')
    const [timezonePopoverOpen, setTimezonePopoverOpen] = useState(false)

    const requiresTimezoneSelection = countryRequiresTimezoneSelection(countryIso2)
    const timezoneOptions = getSelectableTimezonesForCountry(countryIso2)
    const filteredTimezoneOptions = useMemo(() => {
        const normalizedSearch = timezoneSearch.trim().toLowerCase()
        if (!normalizedSearch) {
            return timezoneOptions
        }

        return timezoneOptions.filter(option => buildTimezoneSearchKey(option, countryIso2).includes(normalizedSearch))
    }, [timezoneOptions, timezoneSearch, countryIso2])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        const inferredCountryFromTimezone = countryIso2 === 'OT' ? inferCountryFromTimezoneSelection(timezone) : null
        const effectiveCountryIso2 =
            inferredCountryFromTimezone && inferredCountryFromTimezone !== 'OT'
                ? inferredCountryFromTimezone
                : countryIso2

        if (!isSupportedCountryIso2(effectiveCountryIso2)) {
            setError('Seleccioná tu país para continuar.')
            return
        }

        const effectiveRequiresTimezoneSelection = countryRequiresTimezoneSelection(effectiveCountryIso2)
        const effectiveTimezoneOptions = getSelectableTimezonesForCountry(effectiveCountryIso2)

        if (effectiveRequiresTimezoneSelection && !effectiveTimezoneOptions.includes(timezone)) {
            setError('Seleccioná una zona horaria válida para continuar.')
            return
        }

        const resolvedTimezone = resolveTimezoneForCountry(effectiveCountryIso2, timezone)
        if (!resolvedTimezone.timezone) {
            setError('No se pudo resolver la zona horaria seleccionada.')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/v1/auth/country', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ countryIso2: effectiveCountryIso2, timezone: resolvedTimezone.timezone })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'No se pudo guardar el país.')
                setLoading(false)
                return
            }

            router.push('/dashboard')
            router.refresh()
        } catch {
            setError('No se pudo conectar con el servidor.')
            setLoading(false)
        }
    }

    const handleTimezoneSelect = (selectedTimezone: string) => {
        setTimezone(selectedTimezone)
        setTimezoneSearch('')
        setTimezonePopoverOpen(false)

        if (countryIso2 !== 'OT') {
            return
        }

        const inferredCountry = inferCountryFromTimezoneSelection(selectedTimezone)
        if (!inferredCountry) {
            return
        }

        setCountryIso2(inferredCountry)

        if (!countryRequiresTimezoneSelection(inferredCountry)) {
            setTimezone('')
            return
        }

        const inferredCountryTimezones = getSelectableTimezonesForCountry(inferredCountry)
        if (!inferredCountryTimezones.includes(selectedTimezone)) {
            setTimezone(inferredCountryTimezones[0] ?? '')
        }
    }

    return (
        <div className='flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950'>
            <Card className='w-full max-w-md'>
                <CardHeader>
                    <CardTitle className='text-2xl'>Confirmá tu país</CardTitle>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='countryIso2'>País</Label>
                            <Select
                                value={countryIso2}
                                onValueChange={value => {
                                    setCountryIso2(value)

                                    if (!countryRequiresTimezoneSelection(value)) {
                                        setTimezone('')
                                        setTimezoneSearch('')
                                        return
                                    }

                                    const detectedTimezone = inferTimezoneFromBrowser()
                                    const allowedTimezones = getSelectableTimezonesForCountry(value)

                                    if (detectedTimezone && allowedTimezones.includes(detectedTimezone)) {
                                        setTimezone(detectedTimezone)
                                        setTimezoneSearch('')
                                        return
                                    }

                                    setTimezone(allowedTimezones[0] ?? '')
                                    setTimezoneSearch('')
                                }}
                                disabled={loading}
                            >
                                <SelectTrigger id='countryIso2' className='w-full cursor-pointer'>
                                    <SelectValue placeholder='Seleccioná tu país' />
                                </SelectTrigger>
                                <SelectContent>
                                    {COUNTRY_OPTIONS.map(country => (
                                        <SelectItem key={country.code} value={country.code} className='cursor-pointer'>
                                            {country.flag} {country.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {requiresTimezoneSelection && (
                            <div className='space-y-2'>
                                <Label htmlFor='timezone'>Zona horaria</Label>
                                <Popover open={timezonePopoverOpen} onOpenChange={setTimezonePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            id='timezone'
                                            type='button'
                                            variant='outline'
                                            role='combobox'
                                            disabled={loading}
                                            className='w-full justify-between font-normal'
                                        >
                                            {timezone
                                                ? formatTimezoneOptionLabel(timezone, countryIso2)
                                                : 'Seleccioná tu zona horaria'}
                                            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className='w-(--radix-popover-trigger-width) p-0'>
                                        <div className='border-b p-2'>
                                            <Input
                                                id='timezone-search'
                                                placeholder='Buscar por país, ciudad o zona horaria'
                                                value={timezoneSearch}
                                                onChange={event => setTimezoneSearch(event.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                        <div className='max-h-64 overflow-y-auto p-1'>
                                            {filteredTimezoneOptions.map(timezoneOption => {
                                                const isSelected = timezone === timezoneOption
                                                return (
                                                    <button
                                                        key={timezoneOption}
                                                        type='button'
                                                        className={cn(
                                                            'w-full cursor-pointer rounded-sm px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
                                                            isSelected &&
                                                                'bg-zinc-100 font-medium dark:bg-zinc-800 dark:text-zinc-50'
                                                        )}
                                                        onClick={() => handleTimezoneSelect(timezoneOption)}
                                                    >
                                                        {formatTimezoneOptionLabel(timezoneOption, countryIso2)}
                                                    </button>
                                                )
                                            })}
                                            {filteredTimezoneOptions.length === 0 && (
                                                <div className='px-2 py-1.5 text-sm text-zinc-500'>
                                                    No se encontraron zonas horarias.
                                                </div>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className='mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'>
                            Esta selección de país y zona horaria es irreversible. Revisá cuidadosamente antes de
                            continuar.
                        </div>

                        {error && (
                            <div className='rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200'>
                                {error}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter>
                        <Button
                            type='submit'
                            className='w-full'
                            disabled={
                                loading ||
                                !isSupportedCountryIso2(countryIso2) ||
                                (requiresTimezoneSelection && !timezoneOptions.includes(timezone))
                            }
                        >
                            {loading ? 'Guardando...' : 'Continuar'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
