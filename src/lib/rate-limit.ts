/**
 * Rate limiter simple basado en memoria (in-memory).
 * Útil para entornos de desarrollo y producción con un solo proceso.
 *
 * NOTA: En producción con múltiples instancias, considerar usar Redis/Upstash.
 * Por ahora es suficiente para mitigar brute force básico.
 */

interface RateLimitEntry {
    count: number
    resetAt: number
}

// Mapa de IP -> { count, resetAt }
const requestCounts = new Map<string, RateLimitEntry>()

// Limpieza periódica de entradas expiradas (cada 10 minutos)
// Guardar referencia para evitar memory leak en HMR
let cleanupInterval: NodeJS.Timeout | null = null
if (typeof window === 'undefined' && !cleanupInterval) {
    cleanupInterval = setInterval(() => {
        const now = Date.now()
        for (const [ip, entry] of requestCounts.entries()) {
            if (entry.resetAt < now) {
                requestCounts.delete(ip)
            }
        }
    }, 10 * 60 * 1000)
}

/**
 * Rate limiter basado en token bucket.
 *
 * @param identifier - Identificador único (IP, userId, etc.)
 * @param limit - Número máximo de requests permitidos
 * @param windowMs - Ventana de tiempo en milisegundos
 * @returns {success: boolean, remaining: number, resetAt: number}
 */
export function checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = requestCounts.get(identifier)

    // Si no existe o expiró, crear nueva entrada
    if (!entry || entry.resetAt < now) {
        const newEntry: RateLimitEntry = {
            count: 1,
            resetAt: now + windowMs
        }
        requestCounts.set(identifier, newEntry)
        return {
            success: true,
            remaining: limit - 1,
            resetAt: newEntry.resetAt
        }
    }

    // Si ya alcanzó el límite
    if (entry.count >= limit) {
        return {
            success: false,
            remaining: 0,
            resetAt: entry.resetAt
        }
    }

    // Incrementar contador
    entry.count++
    return {
        success: true,
        remaining: limit - entry.count,
        resetAt: entry.resetAt
    }
}

/**
 * Extrae IP del request de Next.js.
 * Considera headers de proxies (x-forwarded-for, x-real-ip).
 *
 * NOTA: En desarrollo local, la IP será 'unknown' ya que no hay headers de proxy.
 * En producción (Vercel/Cloudflare), los headers son configurados automáticamente.
 */
export function getClientIp(request: Request): string {
    const headers = request.headers

    // Intentar obtener IP de headers de proxy
    const forwarded = headers.get('x-forwarded-for')
    if (forwarded) {
        // x-forwarded-for puede ser "client, proxy1, proxy2"
        return forwarded.split(',')[0].trim()
    }

    const realIp = headers.get('x-real-ip')
    if (realIp) {
        return realIp.trim()
    }

    // Fallback: En desarrollo o entornos sin proxy
    // IMPORTANTE: En desarrollo, desactivar rate limiting o todos los requests
    // compartirán el mismo bucket
    if (process.env.NODE_ENV === 'development') {
        console.warn('Rate limit: IP unknown (desarrollo local)')
    }
    return 'unknown'
}
