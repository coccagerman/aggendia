import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionByUserId } from '@/data/repositories/subscription.repo'
import { startTrial } from '@/domain/subscriptions/subscription.service'
import { SUBSCRIPTION_DEFAULTS } from '@/domain/subscriptions/subscription.types'
import { countryRequiresTimezoneSelection } from '@/lib/country'

/**
 * GET /auth/callback
 *
 * Completa el flujo OAuth PKCE de Supabase.
 * Supabase redirige aquí con un `code` después del consent screen de Google.
 * Intercambiamos el code por una sesión (cookies httpOnly).
 *
 * After successful authentication, ensures the user has a subscription.
 * New users get a TRIALING subscription automatically (30-day trial).
 *
 * Este Route Handler no usa el server client de lib/supabase/server.ts
 * porque necesitamos control explícito sobre la respuesta (NextResponse)
 * para setear las cookies de sesión antes del redirect.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Si Google devolvió un error (ej: usuario canceló el consent)
    if (errorParam) {
        const message = errorDescription || errorParam
        const loginUrl = new URL('/login', origin)
        loginUrl.searchParams.set('error', message)
        return NextResponse.redirect(loginUrl)
    }

    // Sin code = acceso directo inválido al callback
    if (!code) {
        const loginUrl = new URL('/login', origin)
        loginUrl.searchParams.set('error', 'No se recibió el código de autorización.')
        return NextResponse.redirect(loginUrl)
    }

    // Crear un Supabase client con control de cookies sobre la response
    const supabaseResponse = NextResponse.redirect(new URL('/dashboard', origin))

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        supabaseResponse.cookies.set(name, value, options)
                    })
                }
            }
        }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
        console.error('OAuth callback: error exchanging code for session', error.message)
        const loginUrl = new URL('/login', origin)
        loginUrl.searchParams.set('error', 'Error al completar la autenticación. Intentá nuevamente.')
        return NextResponse.redirect(loginUrl)
    }

    // Ensure user has a subscription (create trial for new users)
    if (data.user) {
        try {
            const existing = await getSubscriptionByUserId(prisma, data.user.id)
            if (!existing) {
                await startTrial(prisma, data.user.id, SUBSCRIPTION_DEFAULTS.DEFAULT_TRIAL_DAYS, 'STANDARD')
                console.info(`[Auth:Callback] Created trial subscription for new user ${data.user.id}`)
            }

            const currentSubscription = await getSubscriptionByUserId(prisma, data.user.id)
            const needsCountry = currentSubscription && !currentSubscription.countryIso2
            const needsTimezoneSelection =
                currentSubscription &&
                countryRequiresTimezoneSelection(currentSubscription.countryIso2) &&
                !currentSubscription.accountTimezone

            if (needsCountry || needsTimezoneSelection) {
                supabaseResponse.headers.set('Location', new URL('/onboarding/country', origin).toString())
            }
        } catch (subError) {
            // Non-blocking: log the error but don't prevent login.
            // The dashboard layout will redirect to subscription-expired if no sub.
            console.error(
                '[Auth:Callback] Error creating trial subscription:',
                subError instanceof Error ? subError.message : 'UNKNOWN'
            )
        }
    }

    return supabaseResponse
}
