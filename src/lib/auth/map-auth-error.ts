import { AuthError } from '@supabase/supabase-js'
import { AppError, AuthErrorCodes, SystemErrorCodes } from '@/domain/common/errors'

/**
 * Mapea errores de Supabase Auth a AppError con códigos y mensajes consistentes.
 */
export function mapAuthError(error: unknown): AppError {
    if (error instanceof AuthError) {
        // Errores comunes de Supabase Auth
        const message = error.message.toLowerCase()

        // Fix I2: Checks más específicos primero para evitar falsos positivos
        if (message.includes('invalid login credentials') || message.includes('invalid email or password')) {
            return new AppError(
                AuthErrorCodes.INVALID_CREDENTIALS,
                'Credenciales inválidas. Verificá tu email y contraseña.',
                401
            )
        }

        if (message.includes('user already registered') || message.includes('already registered')) {
            return new AppError(
                AuthErrorCodes.USER_ALREADY_EXISTS,
                'El usuario ya está registrado. Intentá iniciar sesión.',
                400
            )
        }

        if (message.includes('password') && message.includes('weak')) {
            return new AppError(
                AuthErrorCodes.WEAK_PASSWORD,
                'La contraseña es muy débil. Usá al menos 6 caracteres.',
                400
            )
        }

        if (message.includes('email') && message.includes('invalid')) {
            return new AppError(AuthErrorCodes.INVALID_CREDENTIALS, 'El formato del email no es válido.', 400)
        }

        if (message.includes('email not confirmed') || message.includes('confirm your email')) {
            return new AppError(
                AuthErrorCodes.FORBIDDEN,
                'Confirmá tu email para continuar. Revisá tu bandeja de entrada.',
                403
            )
        }

        if (message.includes('rate limit') || message.includes('too many requests')) {
            return new AppError(
                SystemErrorCodes.RATE_LIMIT_EXCEEDED,
                'Demasiados intentos. Esperá un momento e intentá nuevamente.',
                429
            )
        }

        if (
            message.includes('oauth') ||
            message.includes('provider') ||
            message.includes('pkce') ||
            message.includes('code verifier') ||
            message.includes('both auth code and code verifier')
        ) {
            return new AppError(
                AuthErrorCodes.FORBIDDEN,
                'Error al completar la autenticación con el proveedor externo. Intentá nuevamente.',
                400
            )
        }

        // Error genérico de auth
        return new AppError(
            SystemErrorCodes.INTERNAL_ERROR,
            'Error al procesar la autenticación. Intentá nuevamente.',
            500
        )
    }

    // Error desconocido
    return new AppError(SystemErrorCodes.INTERNAL_ERROR, 'Ocurrió un error inesperado. Intentá nuevamente.', 500)
}
