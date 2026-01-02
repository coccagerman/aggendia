/**
 * Barrel export para helpers de autenticación.
 * Facilita imports: import { requireAuth, requireBusinessAccess } from '@/lib/auth'
 */

export { requireAuth } from './require-auth'
export { requireBusinessAccess, requireBusinessRole } from './require-business-access'
export { mapAuthError } from './map-auth-error'
