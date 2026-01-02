import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogoutButton } from './logout-button'

export default async function DashboardPage() {
    const supabase = await createClient()

    let user
    try {
        const { data } = await supabase.auth.getUser()
        user = data.user
    } catch (error) {
        // Si falla getUser(), redirigir a login (podría ser token inválido/expirado)
        // I5: Loguear solo mensaje, no objeto completo (evitar stack traces en logs)
        console.error('Error al obtener usuario:', error instanceof Error ? error.message : 'UNKNOWN')
        redirect('/login')
    }

    // Si no hay usuario (no debería pasar por el middleware, pero por seguridad)
    if (!user) {
        redirect('/login')
    }

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8'>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>TurnosApp</h1>
                    <LogoutButton />
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-4xl space-y-8'>
                        {/* Welcome card */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Bienvenido al Dashboard</CardTitle>
                                <CardDescription>Gestioná tu negocio desde acá</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='space-y-4'>
                                    <div>
                                        <p className='text-sm font-medium text-zinc-600 dark:text-zinc-400'>
                                            Email de la cuenta
                                        </p>
                                        <p className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                                            {user.email || 'No disponible'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Placeholder for future features */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Próximos pasos</CardTitle>
                                <CardDescription>
                                    Pronto podrás configurar tu negocio, recursos y servicios
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className='space-y-2 text-sm text-zinc-600 dark:text-zinc-400'>
                                    <p>✓ Cuenta creada</p>
                                    <p className='text-zinc-400 dark:text-zinc-600'>○ Crear negocio (próximamente)</p>
                                    <p className='text-zinc-400 dark:text-zinc-600'>
                                        ○ Agregar recursos (próximamente)
                                    </p>
                                    <p className='text-zinc-400 dark:text-zinc-600'>
                                        ○ Definir servicios (próximamente)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
