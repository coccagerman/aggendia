'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

function SignupPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(searchParams.get('error'))
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Preserve trial code from URL (e.g. /signup?trial=campana-2025) in localStorage
    // so the business creation form can pick it up later.
    const trialCode = searchParams.get('trial')
    useState(() => {
        if (trialCode) {
            try {
                localStorage.setItem('trialCode', trialCode)
            } catch {
                /* SSR guard */
            }
        }
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)

        // Validación básica client-side (server-side se hace en el endpoint)
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.')
            return
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/v1/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, confirmPassword })
            })

            const data = await response.json()

            // CRÍTICO 2: Manejar caso de email confirmation requerida (status 202)
            if (response.status === 202 || data.error?.code === 'AUTH_EMAIL_CONFIRMATION_REQUIRED') {
                setSuccessMessage(data.error.message)
                setLoading(false)
                return
            }

            if (!response.ok) {
                // Manejo especial para rate limit
                if (response.status === 429) {
                    const retryAfter = data.error?.details?.retryAfter || 60
                    const minutes = Math.ceil(retryAfter / 60)
                    setError(`${data.error?.message || 'Demasiados intentos.'} Esperá ${minutes} minutos.`)
                } else {
                    setError(data.error?.message || 'Error al crear la cuenta')
                }
                setLoading(false)
                return
            }

            // Después del registro, el siguiente paso es confirmar país
            router.push('/onboarding/country')
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
                    <CardTitle className='text-2xl'>Crear cuenta</CardTitle>
                    <CardDescription>Completá los datos para crear tu cuenta de Aggendia</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <GoogleSignInButton />
                    <div className='relative'>
                        <div className='absolute inset-0 flex items-center'>
                            <span className='w-full border-t' />
                        </div>
                        <div className='relative flex justify-center text-xs uppercase'>
                            <span className='bg-card px-2 text-muted-foreground'>o</span>
                        </div>
                    </div>
                </CardContent>
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
                            <p className='text-xs text-zinc-600 dark:text-zinc-400'>Mínimo 6 caracteres</p>
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='confirmPassword'>Confirmar contraseña</Label>
                            <div className='relative'>
                                <Input
                                    id='confirmPassword'
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder='••••••••'
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    minLength={6}
                                    className='pr-10'
                                />
                                <button
                                    type='button'
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer'
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                                </button>
                            </div>
                        </div>
                        {successMessage && (
                            <div className='rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200'>
                                {successMessage}
                            </div>
                        )}
                        {error && (
                            <div className='rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200'>
                                {error}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className='flex flex-col space-y-4 pt-6'>
                        <Button type='submit' className='w-full' disabled={loading}>
                            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                        </Button>
                        <p className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
                            ¿Ya tenés cuenta?{' '}
                            <Link href='/login' className='font-medium text-zinc-900 hover:underline dark:text-zinc-50'>
                                Iniciá sesión
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

function SignupPageFallback() {
    return (
        <div className='flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950'>
            <Card className='w-full max-w-md'>
                <CardHeader>
                    <CardTitle className='text-2xl'>Crear cuenta</CardTitle>
                    <CardDescription>Cargando...</CardDescription>
                </CardHeader>
            </Card>
        </div>
    )
}

export default function SignupPage() {
    return (
        <Suspense fallback={<SignupPageFallback />}>
            <SignupPageContent />
        </Suspense>
    )
}
