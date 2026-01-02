import { AppError, AuthErrorCodes } from '@/domain/common/errors'
import { prisma } from '@/data/prisma/prisma'
import { BusinessRole } from '@prisma/client'

/**
 * Helper para Route Handlers que requieren acceso a un negocio específico.
 * Valida que el usuario tenga membresía activa en el negocio.
 *
 * @param userId - ID del usuario autenticado
 * @param businessId - ID del negocio al que se intenta acceder
 * @returns {role, businessId} - Rol del usuario en el negocio
 * @throws {AppError} AUTH_FORBIDDEN si no tiene acceso
 */
export async function requireBusinessAccess(
    userId: string,
    businessId: string
): Promise<{ role: BusinessRole; businessId: string }> {
    const member = await prisma.businessMember.findFirst({
        where: {
            businessId,
            userId
        }
    })

    if (!member) {
        throw new AppError(AuthErrorCodes.FORBIDDEN, 'No tenés acceso a este negocio.', 403)
    }

    return {
        role: member.role,
        businessId: member.businessId
    }
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
