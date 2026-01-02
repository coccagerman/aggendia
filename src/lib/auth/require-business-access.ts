import { AppError, AuthErrorCodes } from '@/domain/common/errors'
// import { prisma } from '@/data/prisma/prisma'

/**
 * Helper para Route Handlers que requieren acceso a un negocio específico.
 * Valida que el usuario tenga membresía activa en el negocio.
 *
 * @param userId - ID del usuario autenticado
 * @param businessId - ID del negocio al que se intenta acceder
 * @returns {role, businessId} - Rol del usuario en el negocio
 * @throws {AppError} AUTH_FORBIDDEN si no tiene acceso
 *
 * IMPORTANTE: Implementar cuando se agregue Prisma schema con business_members.
 * Por ahora es un placeholder para la estructura correcta.
 */
export async function requireBusinessAccess(
    userId: string, // eslint-disable-line @typescript-eslint/no-unused-vars
    businessId: string // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<{ role: 'OWNER' | 'ADMIN' | 'STAFF'; businessId: string }> {
    // TODO: Implementar cuando esté el schema de Prisma con business_members
    // Ejemplo de implementación futura:
    //
    // const member = await prisma.businessMember.findFirst({
    //     where: {
    //         userId,
    //         businessId,
    //         isActive: true
    //     }
    // })
    //
    // if (!member) {
    //     throw new AppError(
    //         AuthErrorCodes.FORBIDDEN,
    //         'No tenés acceso a este negocio.',
    //         403
    //     )
    // }
    //
    // return {
    //     role: member.role as 'OWNER' | 'ADMIN' | 'STAFF',
    //     businessId: member.businessId
    // }

    // Por ahora, lanzar error indicando que no está implementado
    throw new AppError(
        AuthErrorCodes.FORBIDDEN,
        'Validación de acceso multi-tenant pendiente de implementación (US-1.2).',
        501 // Not Implemented
    )
}

/**
 * Helper que valida acceso y además verifica permisos mínimos.
 * Útil para endpoints que requieren roles específicos.
 *
 * @param userId - ID del usuario autenticado
 * @param businessId - ID del negocio
 * @param minRole - Rol mínimo requerido ('STAFF' | 'ADMIN' | 'OWNER')
 * @throws {AppError} AUTH_FORBIDDEN si no tiene el rol requerido
 */
export async function requireBusinessRole(
    userId: string,
    businessId: string,
    minRole: 'STAFF' | 'ADMIN' | 'OWNER'
): Promise<{ role: 'OWNER' | 'ADMIN' | 'STAFF'; businessId: string }> {
    const access = await requireBusinessAccess(userId, businessId)

    const roleHierarchy = { STAFF: 1, ADMIN: 2, OWNER: 3 }
    const userLevel = roleHierarchy[access.role]
    const requiredLevel = roleHierarchy[minRole]

    if (userLevel < requiredLevel) {
        throw new AppError(AuthErrorCodes.FORBIDDEN, 'No tenés permisos suficientes para realizar esta acción.', 403)
    }

    return access
}
