import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Middleware para proteger rutas privadas (/dashboard/**).
 * Redirige a /login si el usuario no está autenticado.
 *
 * Nota: No podemos importar @/lib/env aquí porque middleware corre en Edge Runtime.
 * Las variables se validan en build-time por lib/env.ts usado en otros módulos.
 */
export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request
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
                        request
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
    if ((!user || !user.email) && request.nextUrl.pathname.startsWith('/dashboard')) {
        console.log('Unauthorized access attempt to:', request.nextUrl.pathname)
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        return NextResponse.redirect(redirectUrl)
    }

    // Pass current pathname to layouts for conditional rendering
    supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname)

    return supabaseResponse
}

export const config = {
    matcher: ['/dashboard/:path*']
}
