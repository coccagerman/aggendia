'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIMEZONES = [
    { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
    { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
    { value: 'America/Santiago', label: 'Santiago (GMT-3/GMT-4)' },
    { value: 'America/Lima', label: 'Lima (GMT-5)' },
    { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
    { value: 'UTC', label: 'UTC (GMT+0)' }
]

export default function NewBusinessPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        name: '',
        timezone: '',
        address: '',
        area: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validación client-side
        if (!formData.name.trim()) {
            setError('El nombre del negocio es requerido.')
            return
        }

        if (!formData.timezone) {
            setError('Debés seleccionar una zona horaria.')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/v1/businesses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: formData.name,
                    timezone: formData.timezone,
                    address: formData.address || null,
                    area: formData.area || null
                })
            })

            const data = await response.json()

            if (!response.ok) {
                // Manejar errores de la API
                const errorMessage = data.error?.message || 'Ocurrió un error al crear el negocio.'
                setError(errorMessage)
                setLoading(false)
                return
            }

            // Éxito: redirigir a dashboard
            router.push('/dashboard')
            router.refresh()
        } catch (err) {
            console.error('Error al crear negocio:', err)
            setError('No se pudo conectar con el servidor. Verificá tu conexión.')
            setLoading(false)
        }
    }

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <Link
                        href='/dashboard'
                        className='text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                    >
                        ← Volver al Dashboard
                    </Link>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Crear Negocio</CardTitle>
                                <CardDescription>
                                    Completá la información de tu negocio para comenzar a recibir turnos
                                </CardDescription>
                            </CardHeader>
                            <form onSubmit={handleSubmit} noValidate>
                                <CardContent className='space-y-6'>
                                    {/* Nombre */}
                                    <div className='space-y-2'>
                                        <Label htmlFor='name'>
                                            Nombre del negocio <span className='text-red-500'>*</span>
                                        </Label>
                                        <Input
                                            id='name'
                                            type='text'
                                            placeholder='Ej: Peluquería Central'
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            disabled={loading}
                                            maxLength={100}
                                        />
                                        <p className='text-xs text-zinc-600 dark:text-zinc-400'>
                                            El nombre de tu negocio tal como querés que lo vean tus clientes
                                        </p>
                                    </div>

                                    {/* Timezone */}
                                    <div className='space-y-2'>
                                        <Label htmlFor='timezone'>
                                            Zona horaria <span className='text-red-500'>*</span>
                                        </Label>
                                        <Select
                                            value={formData.timezone}
                                            onValueChange={value => setFormData({ ...formData, timezone: value })}
                                            disabled={loading}
                                        >
                                            <SelectTrigger id='timezone'>
                                                <SelectValue placeholder='Seleccioná tu zona horaria' />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {TIMEZONES.map(tz => (
                                                    <SelectItem key={tz.value} value={tz.value}>
                                                        {tz.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className='text-xs text-zinc-600 dark:text-zinc-400'>
                                            Los horarios se mostrarán según esta zona horaria
                                        </p>
                                    </div>

                                    {/* Dirección (opcional) */}
                                    <div className='space-y-2'>
                                        <Label htmlFor='address'>Dirección (opcional)</Label>
                                        <Input
                                            id='address'
                                            type='text'
                                            placeholder='Ej: Av. Corrientes 1234'
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            disabled={loading}
                                            maxLength={200}
                                        />
                                    </div>

                                    {/* Área/Ciudad (opcional) */}
                                    <div className='space-y-2'>
                                        <Label htmlFor='area'>Ciudad / Zona (opcional)</Label>
                                        <Input
                                            id='area'
                                            type='text'
                                            placeholder='Ej: Buenos Aires, Palermo'
                                            value={formData.area}
                                            onChange={e => setFormData({ ...formData, area: e.target.value })}
                                            disabled={loading}
                                            maxLength={100}
                                        />
                                    </div>

                                    {/* Error message */}
                                    {error && (
                                        <div className='rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200'>
                                            {error}
                                        </div>
                                    )}
                                </CardContent>

                                <CardFooter className='flex gap-3 pt-6'>
                                    <Button type='button' variant='outline' asChild disabled={loading}>
                                        <Link href='/dashboard'>Cancelar</Link>
                                    </Button>
                                    <Button type='submit' disabled={loading} className='flex-1'>
                                        {loading ? 'Creando...' : 'Crear negocio'}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
