/**
 * E2E Helper - Unique ID Generation
 *
 * Genera identificadores únicos para evitar colisiones en tests paralelos.
 */

/**
 * Genera un ID único usando crypto.randomUUID().
 * Seguro para uso en paralelo con múltiples workers.
 *
 * @returns UUID v4 string (ej: "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateUniqueId(): string {
    // crypto.randomUUID() está disponible en Node.js 16+ y navegadores modernos
    return crypto.randomUUID()
}

/**
 * Genera un email único para tests E2E.
 *
 * @param prefix Prefijo opcional para el email (default: "e2e")
 * @returns Email único (ej: "e2e-550e8400-e29b-41d4@test.turnosapp.local")
 */
export function generateTestEmail(prefix: string = 'e2e'): string {
    const uniqueId = generateUniqueId()
    return `${prefix}-${uniqueId}@test.turnosapp.local`
}

/**
 * Genera un nombre único para entidades de test.
 *
 * @param baseName Nombre base (ej: "Business", "Resource")
 * @returns Nombre único con sufijo corto (ej: "Business 550e8400")
 */
export function generateUniqueName(baseName: string): string {
    const uniqueId = generateUniqueId()
    return `${baseName} ${uniqueId.slice(0, 8)}`
}
