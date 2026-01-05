/**
 * Clase estándar para errores de la aplicación.
 * Todos los errores del dominio y API deben usar esta clase.
 */
export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly httpStatus: number,
        public readonly details?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'AppError'
        Object.setPrototypeOf(this, AppError.prototype)
    }

    toJSON() {
        return {
            error: {
                code: this.code,
                message: this.message,
                ...(this.details && { details: this.details })
            }
        }
    }
}

/**
 * Códigos de error estándar para autenticación
 */
export const AuthErrorCodes = {
    UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
    INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
    USER_ALREADY_EXISTS: 'AUTH_USER_ALREADY_EXISTS',
    WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
    FORBIDDEN: 'AUTH_FORBIDDEN'
} as const

/**
 * Códigos de error estándar para validación
 */
export const ValidationErrorCodes = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_QUERY: 'INVALID_QUERY'
} as const

/**
 * Códigos de error estándar para sistema
 */
export const SystemErrorCodes = {
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    DB_ERROR: 'DB_ERROR',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const

/**
 * Códigos de error estándar para negocio
 */
export const BusinessErrorCodes = {
    BUSINESS_NOT_FOUND: 'BUSINESS_NOT_FOUND',
    BUSINESS_ACCESS_DENIED: 'BUSINESS_ACCESS_DENIED',
    BUSINESS_SLUG_CONFLICT: 'BUSINESS_SLUG_CONFLICT'
} as const

/**
 * Códigos de error estándar para recursos
 */
export const ResourceErrorCodes = {
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    RESOURCE_INACTIVE: 'RESOURCE_INACTIVE',
    RESOURCE_NAME_CONFLICT: 'RESOURCE_NAME_CONFLICT',
    RESOURCE_HAS_FUTURE_APPOINTMENTS: 'RESOURCE_HAS_FUTURE_APPOINTMENTS'
} as const

/**
 * Códigos de error estándar para servicios
 */
export const ServiceErrorCodes = {
    SERVICE_NOT_FOUND: 'SERVICE_NOT_FOUND',
    SERVICE_NAME_CONFLICT: 'SERVICE_NAME_CONFLICT'
} as const

/**
 * Códigos de error estándar para turnos
 */
export const AppointmentErrorCodes = {
    APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
    APPOINTMENT_SLOT_TAKEN: 'APPOINTMENT_SLOT_TAKEN',
    APPOINTMENT_INVALID_STATUS: 'APPOINTMENT_INVALID_STATUS',
    APPOINTMENT_OUTSIDE_AVAILABILITY: 'APPOINTMENT_OUTSIDE_AVAILABILITY'
} as const

/**
 * Códigos de error estándar para disponibilidad
 */
export const AvailabilityErrorCodes = {
    AVAILABILITY_INVALID_RANGE: 'AVAILABILITY_INVALID_RANGE',
    AVAILABILITY_OVERLAP: 'AVAILABILITY_OVERLAP',
    AVAILABILITY_TOO_MANY_RANGES: 'AVAILABILITY_TOO_MANY_RANGES'
} as const
