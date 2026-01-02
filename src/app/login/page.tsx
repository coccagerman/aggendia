'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            const data = await response.json()

            if (!response.ok) {
                // Manejo especial para rate limit
                if (response.status === 429) {
                    const retryAfter = data.error?.details?.retryAfter || 60
                    setError(`${data.error?.message || 'Demasiados intentos.'} Esperá ${retryAfter} segundos.`)
                } else {
                    setError(data.error?.message || 'Error al iniciar sesión')
                }
                setLoading(false)
                return
            }

            // Redirigir al dashboard tras login exitoso
            router.push('/dashboard')
            router.refresh()
            // No llamamos setLoading(false) aquí porque el componente se desmonta tras el redirect
        } catch {
            setError('Ocurrió un error inesperado. Intentá nuevamente.')
            setLoading(false)
        }
    }

    return (
        <div className='flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950'>
            <Card className='w-full max-w-md'>
                <CardHeader>
                    <CardTitle className='text-2xl'>Iniciar sesión</CardTitle>
                    <CardDescription>Ingresá tu email y contraseña para acceder a tu cuenta</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='email'>Email</Label>
                            <Input
                                id='email'
                                type='email'
                                placeholder='tu@email.com'
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='password'>Contraseña</Label>
                            <div className='relative'>
                                <Input
                                    id='password'
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder='••••••••'
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    minLength={6}
                                    className='pr-10'
                                />
                                <button
                                    type='button'
                                    onClick={() => setShowPassword(!showPassword)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer'
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                </button>
                            </div>
                        </div>
                        {error && (
                            <div className='rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200'>
                                {error}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className='flex flex-col space-y-4 pt-6'>
                        <Button type='submit' className='w-full' disabled={loading}>
                            {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                        </Button>
                        <p className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
                            ¿No tenés cuenta?{' '}
                            <Link
                                href='/signup'
                                className='font-medium text-zinc-900 hover:underline dark:text-zinc-50'
                            >
                                Registrate
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
