import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { signupRequestSchema } from '../dto'
import { mapAuthError } from '@/lib/auth/map-auth-error'
import { AppError, ValidationErrorCodes, SystemErrorCodes } from '@/domain/common/errors'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { startTrial } from '@/domain/subscriptions/subscription.service'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'
import { getAppDisabledErrorPayload, isAppDisabledInProd } from '@/lib/app-disabled'

/**
 * POST /api/v1/auth/signup
 * Registra un nuevo usuario con email y contraseña.
 * Rate limit: 3 intentos por hora por IP.
 */
export async function POST(request: Request) {
    try {
        if (isAppDisabledInProd()) {
            return NextResponse.json(getAppDisabledErrorPayload(), { status: 503 })
        }

        const body = await request.json()

        // Validación con Zod (primero validar, luego rate limit)
        const parseResult = signupRequestSchema.safeParse(body)

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

        // Rate limiting: 3 intentos por hora (solo después de validación exitosa)
        const ip = getClientIp(request)
        const rateLimitResult = checkRateLimit(ip, 3, 60 * 60 * 1000)

        if (!rateLimitResult.success) {
            // M1: Eliminar duplicación - calcular una vez
            const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            const resetInMinutes = Math.ceil(retryAfterSeconds / 60)
            // M2: Logging cuando rate limit es excedido
            console.warn('Rate limit exceeded:', { ip, endpoint: 'signup', email })
            return NextResponse.json(
                {
                    error: {
                        code: SystemErrorCodes.RATE_LIMIT_EXCEEDED,
                        message: `Demasiados intentos de registro. Intentá nuevamente en ${resetInMinutes} minutos.`,
                        details: { retryAfter: retryAfterSeconds }
                    }
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': retryAfterSeconds.toString(),
                        'X-RateLimit-Limit': '3',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
                    }
                }
            )
        }

        const supabase = await createClient()

        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password
        })

        if (signUpError) {
            const appError = mapAuthError(signUpError)
            return NextResponse.json(appError.toJSON(), { status: appError.httpStatus })
        }

        // Ensure new user has a TRIALING subscription (same as auth callback for OAuth)
        if (data.user) {
            try {
                const existing = await getSubscriptionByUserId(prisma, data.user.id)
                if (!existing) {
                    await startTrial(prisma, data.user.id, SUBSCRIPTION_DEFAULTS.DEFAULT_TRIAL_DAYS, 'STANDARD')
                    console.info(`[Auth:Signup] Created trial subscription for new user ${data.user.id}`)
                }
            } catch (subError) {
                // Non-blocking: log but don't prevent signup completion.
                // Dashboard layout will redirect to subscription-expired if no sub.
                console.error(
                    '[Auth:Signup] Error creating trial subscription:',
                    subError instanceof Error ? subError.message : 'UNKNOWN'
                )
            }
        }

        // CRÍTICO 2: Detectar si email confirmation está habilitada
        // Si el usuario fue creado pero no hay sesión, significa que necesita confirmar email
        if (data.user && !data.session) {
            return NextResponse.json(
                {
                    error: {
                        code: 'AUTH_EMAIL_CONFIRMATION_REQUIRED',
                        message: 'Te enviamos un email. Confirmá tu cuenta para continuar.',
                        details: { requiresConfirmation: true }
                    }
                },
                {
                    status: 202, // Accepted: usuario creado pero requiere confirmación de email
                    headers: {
                        'X-RateLimit-Limit': '3',
                        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                        'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
                    }
                }
            )
        }

        return NextResponse.json(
            {
                data: { success: true }
            },
            {
                headers: {
                    'X-RateLimit-Limit': '3',
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
                }
            }
        )
    } catch (error) {
        console.error('Signup error:', error instanceof AppError ? error.code : 'UNKNOWN')

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
