import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'

/**
 * Crea un cliente de Supabase para uso en Client Components.
 * Maneja cookies automáticamente en el navegador.
 */
export function createClient() {
    return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
