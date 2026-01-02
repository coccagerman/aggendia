import { createClient } from '@/lib/supabase/server'
import { AppError, AuthErrorCodes } from '@/domain/common/errors'

/**
 * Helper para Route Handlers privados.
 * Valida que existe una sesión activa y devuelve userId + email.
 * Lanza AppError si no hay sesión (para ser capturado por el handler).
 *
 * @returns {userId, email} - Datos del usuario autenticado
 */
export async function requireAuth(): Promise<{ userId: string; email: string }> {
    const supabase = await createClient()

    const {
        data: { user },
        error
    } = await supabase.auth.getUser()

    if (error || !user || !user.email) {
        throw new AppError(AuthErrorCodes.UNAUTHORIZED, 'No estás autenticado. Iniciá sesión para continuar.', 401)
    }

    return {
        userId: user.id,
        email: user.email
    }
}
