import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isAllowedPathWhenAppDisabled, isAppDisabledInProd } from '@/lib/app-disabled'

/**
 * Middleware para proteger rutas privadas (/dashboard/**).
 * Redirige a /login si el usuario no está autenticado.
 *
 * Nota: No podemos importar @/lib/env aquí porque middleware corre en Edge Runtime.
 * Las variables se validan en build-time por lib/env.ts usado en otros módulos.
 */
export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const isAppDisabled = isAppDisabledInProd()

    const diagnosticHeaders = {
        'x-middleware-active': 'true',
        'x-app-disabled-evaluated': isAppDisabled ? 'true' : 'false'
    }

    if (isAppDisabled) {
        if (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/cron/')) {
            return NextResponse.json(
                {
                    error: {
                        code: 'APP_DISABLED',
                        message: 'Aplicación temporalmente deshabilitada en producción.',
                        details: {
                            reason: 'MAINTENANCE_MODE'
                        }
                    }
                },
                {
                    status: 503,
                    headers: {
                        ...diagnosticHeaders,
                        'x-app-disabled-mode': 'true'
                    }
                }
            )
        }

        if (!isAllowedPathWhenAppDisabled(pathname)) {
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/maintenance'
            redirectUrl.search = ''
            const response = NextResponse.redirect(redirectUrl)
            response.headers.set('x-middleware-active', 'true')
            response.headers.set('x-app-disabled-evaluated', 'true')
            response.headers.set('x-app-disabled-mode', 'true')
            return response
        }
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-pathname', pathname)

    if (!pathname.startsWith('/dashboard')) {
        const passthroughResponse = NextResponse.next({
            request: {
                headers: requestHeaders
            }
        })
        passthroughResponse.headers.set('x-pathname', pathname)
        passthroughResponse.headers.set('x-middleware-active', 'true')
        passthroughResponse.headers.set('x-app-disabled-evaluated', isAppDisabled ? 'true' : 'false')
        if (isAppDisabled) {
            passthroughResponse.headers.set('x-app-disabled-mode', 'true')
        }
        return passthroughResponse
    }

    let supabaseResponse = NextResponse.next({
        request: {
            headers: requestHeaders
        }
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request: {
                            headers: requestHeaders
                        }
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                }
            }
        }
    )

    // Verificar sesión
    let user
    try {
        const { data } = await supabase.auth.getUser()
        user = data.user
    } catch (error) {
        // Si getUser() falla (ej: token malformado), tratar como no autenticado
        console.error('Error verificando sesión en middleware:', error)
        user = null
    }

    // I1: Validar que el usuario tenga email (consistencia con requireAuth)
    // M3: Loguear path bloqueado para debugging
    if (!user || !user.email) {
        console.log('Unauthorized access attempt to:', pathname)
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        return NextResponse.redirect(redirectUrl)
    }

    // Keep response header as a debug aid; layout reads request header.
    supabaseResponse.headers.set('x-pathname', pathname)
    supabaseResponse.headers.set('x-middleware-active', 'true')
    supabaseResponse.headers.set('x-app-disabled-evaluated', isAppDisabled ? 'true' : 'false')

    return supabaseResponse
}

export const config = {
    matcher: ['/:path*']
}
