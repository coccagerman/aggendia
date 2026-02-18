'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COUNTRY_OPTIONS, inferCountryFromBrowser, isSupportedCountryIso2 } from '@/lib/country'

interface CompleteCountryFormProps {
    initialCountryIso2: string | null
}

export function CompleteCountryForm({ initialCountryIso2 }: CompleteCountryFormProps) {
    const router = useRouter()
    const [countryIso2, setCountryIso2] = useState<string>(() => {
        if (isSupportedCountryIso2(initialCountryIso2)) {
            return initialCountryIso2 ?? ''
        }

        const detectedCountry = inferCountryFromBrowser()
        return isSupportedCountryIso2(detectedCountry) ? (detectedCountry ?? '') : ''
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        setError(null)

        if (!isSupportedCountryIso2(countryIso2)) {
            setError('Seleccioná tu país para continuar.')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/v1/auth/country', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ countryIso2 })
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

    return (
        <div className='flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950'>
            <Card className='w-full max-w-md'>
                <CardHeader>
                    <CardTitle className='text-2xl'>Confirmá tu país</CardTitle>
                    <CardDescription>Lo usamos para configurar el proveedor de pagos correcto.</CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='countryIso2'>País</Label>
                            <Select value={countryIso2} onValueChange={setCountryIso2} disabled={loading}>
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
                            disabled={loading || !isSupportedCountryIso2(countryIso2)}
                        >
                            {loading ? 'Guardando...' : 'Continuar'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
