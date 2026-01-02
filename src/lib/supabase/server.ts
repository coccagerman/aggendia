import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

/**
 * Crea un cliente de Supabase para uso en Server Components y Route Handlers.
 * Maneja cookies de forma segura para mantener la sesión del usuario.
 */
export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
                } catch {
                    // La cookie puede fallar en middleware, pero no es crítico
                }
            }
        }
    })
}
