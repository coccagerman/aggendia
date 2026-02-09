import { AppError, ValidationErrorCodes } from '@/domain/common/errors'
import { UpdateBusinessInput } from './business.types'

/**
 * Genera un slug a partir de un nombre:
 * - lowercase
 * - reemplaza espacios y guiones bajos por guión
 * - remueve caracteres especiales
 * - colapsa múltiples guiones
 */
export function generateSlug(name: string): string {
    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remover acentos
        .replace(/[^a-z0-9\s_-]/g, '') // solo letras, números, espacios, guiones
        .replace(/[\s_]+/g, '-') // espacios y underscores a guión
        .replace(/-+/g, '-') // colapsar múltiples guiones
        .replace(/^-+|-+$/g, '') // trim guiones inicio/fin

    if (!slug) {
        return 'business'
    }

    return slug
}

/**
 * Genera un slug único verificando colisiones.
 * Si el slug ya existe, agrega sufijo -2, -3, etc.
 *
 * @param name - nombre del negocio
 * @param checkExists - función que verifica si un slug ya existe
 * @returns slug único
 */
export async function generateUniqueSlug(
    name: string,
    checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
    const baseSlug = generateSlug(name)
    let slug = baseSlug
    let attempt = 1
    const MAX_ATTEMPTS = 50

    while (attempt <= MAX_ATTEMPTS) {
        const exists = await checkExists(slug)
        if (!exists) {
            return slug
        }

        attempt++
        slug = `${baseSlug}-${attempt}`
    }

    throw new AppError(
        ValidationErrorCodes.VALIDATION_ERROR,
        'No se pudo generar un slug único para el negocio.',
        500,
        { baseSlug, attempts: MAX_ATTEMPTS }
    )
}

/**
 * Valida que el timezone sea una string válida (no vacía).
 * MVP: solo verifica que no sea vacía, no valida contra lista IANA completa.
 */
export function validateTimezone(timezone: string): void {
    if (!timezone || timezone.trim().length === 0) {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            'El timezone es requerido y no puede estar vacío.',
            400
        )
    }
}

/**
 * Valida los datos de entrada para crear un negocio.
 */
export function validateCreateBusinessInput(input: { name?: string; timezone?: string }): void {
    if (!input.name || input.name.trim().length === 0) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El nombre del negocio es requerido.', 400)
    }

    if (!input.timezone) {
        throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El timezone es requerido.', 400)
    }

    validateTimezone(input.timezone)
}

/**
 * Valida los datos de entrada para actualizar un negocio.
 */
export function validateUpdateBusinessInput(input: UpdateBusinessInput): void {
    if (input.name !== undefined) {
        if (input.name.trim().length === 0) {
            throw new AppError(ValidationErrorCodes.VALIDATION_ERROR, 'El nombre del negocio es requerido.', 400)
        }

        if (input.name.trim().length > 100) {
            throw new AppError(
                ValidationErrorCodes.VALIDATION_ERROR,
                'El nombre del negocio no puede exceder 100 caracteres.',
                400
            )
        }
    }

    if (input.timezone !== undefined) {
        validateTimezone(input.timezone)
    }

    if (input.status === 'DELETED') {
        throw new AppError(
            ValidationErrorCodes.VALIDATION_ERROR,
            'No se puede establecer el estado DELETED directamente.',
            400
        )
    }
}
