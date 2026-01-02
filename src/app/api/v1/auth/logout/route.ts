import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/v1/auth/logout
 * Cierra la sesión del usuario y limpia las cookies.
 */
export async function POST() {
    try {
        const supabase = await createClient()

        // Cerrar sesión en Supabase
        const { error } = await supabase.auth.signOut()

        if (error) {
            return NextResponse.json(
                {
                    error: {
                        code: 'AUTH_LOGOUT_FAILED',
                        message: 'Error al cerrar sesión. Intentá nuevamente.'
                    }
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            data: { success: true }
        })
    } catch {
        // Fix C1: No loguear detalles del error (puede contener PII/tokens)
        console.error('Logout failed with code: AUTH_LOGOUT_ERROR')
        return NextResponse.json(
            {
                error: {
                    code: 'INTERNAL_ERROR',
                    message: 'Ocurrió un error inesperado. Intentá nuevamente.'
                }
            },
            { status: 500 }
        )
    }
}
