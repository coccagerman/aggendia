'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogout = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/v1/auth/logout', {
                method: 'POST'
            })

            if (!response.ok) {
                throw new Error('Logout failed')
            }

            // Redirigir al login
            router.push('/login')
            router.refresh()
        } catch {
            // Fix I1: Mostrar error al usuario si logout falla
            setError('Error al cerrar sesión. Intentá nuevamente.')
            setLoading(false)
        }
    }

    return (
        <div className='flex flex-col items-end gap-2'>
            <Button onClick={handleLogout} variant='outline' disabled={loading}>
                {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
            </Button>
            {error && <p className='text-xs text-red-600 dark:text-red-400'>{error}</p>}
        </div>
    )
}
