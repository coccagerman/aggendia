import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { loginRequestSchema } from '../dto'
import { mapAuthError } from '@/lib/auth/map-auth-error'
import { AppError, ValidationErrorCodes, SystemErrorCodes } from '@/domain/common/errors'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { getAppDisabledErrorPayload, isAppDisabledInProd } from '@/lib/app-disabled'

/**
 * POST /api/v1/auth/login
 * Autentica un usuario con email y contraseña.
 * Rate limit: 5 intentos por 15 minutos por IP.
 */
export async function POST(request: Request) {
    try {
        if (isAppDisabledInProd()) {
            return NextResponse.json(getAppDisabledErrorPayload(), { status: 503 })
        }

        const body = await request.json()

        // Validación con Zod (primero validar, luego rate limit)
        const parseResult = loginRequestSchema.safeParse(body)

        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0]
            return NextResponse.json(
                {
                    error: {
                        code: ValidationErrorCodes.VALIDATION_ERROR,
                        message: firstError.message,
                        details: { field: firstError.path.join('.') }
                    }
                },
                { status: 400 }
            )
        }

        const { email, password } = parseResult.data

        // Rate limiting: 5 intentos por 15 minutos (solo después de validación exitosa)
        const ip = getClientIp(request)
        const rateLimitResult = checkRateLimit(ip, 5, 15 * 60 * 1000)

        if (!rateLimitResult.success) {
            const resetInSeconds = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            // M2: Logging cuando rate limit es excedido
            console.warn('Rate limit exceeded:', { ip, endpoint: 'login', email })
            return NextResponse.json(
                {
                    error: {
                        code: SystemErrorCodes.RATE_LIMIT_EXCEEDED,
                        message: `Demasiados intentos de inicio de sesión. Intentá nuevamente en ${resetInSeconds} segundos.`,
                        details: { retryAfter: resetInSeconds }
                    }
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': resetInSeconds.toString(),
                        'X-RateLimit-Limit': '5',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
                    }
                }
            )
        }

        const supabase = await createClient()

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (signInError) {
            const appError = mapAuthError(signInError)
            return NextResponse.json(appError.toJSON(), { status: appError.httpStatus })
        }

        return NextResponse.json(
            {
                data: { success: true }
            },
            {
                headers: {
                    'X-RateLimit-Limit': '5',
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
                }
            }
        )
    } catch (error) {
        console.error('Login error:', error instanceof AppError ? error.code : 'UNKNOWN')

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
