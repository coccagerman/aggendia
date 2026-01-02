import { z } from 'zod'

/**
 * Schema de validación para variables de entorno.
 * Todas las variables requeridas para la aplicación deben estar aquí.
 */
const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida'),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY es requerida')
})

/**
 * Variables de entorno validadas y tipadas.
 * Falla en build-time si falta alguna variable o tiene formato inválido.
 */
export const env = envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
})
