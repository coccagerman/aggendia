/**
 * Repository for customers table
 * Handles customer CRUD operations with business-scoped deduplication
 */

import { PrismaClient, Customer } from '@prisma/client'

export interface CustomerInput {
    fullName: string
    email?: string | null
    phone?: string | null
}

/**
 * Normalize email for consistent matching
 * - Trims whitespace
 * - Converts to lowercase
 */
function normalizeEmail(email: string | null | undefined): string | null {
    if (!email || email.trim() === '') return null
    return email.trim().toLowerCase()
}

/**
 * Upsert a customer by email or phone within a business
 * - If email is provided: match by (businessId, normalizedEmail)
 * - If only phone is provided: match by (businessId, phone)
 * - Updates fullName and secondary contact if customer exists
 */
export async function upsertCustomer(
    prisma: PrismaClient,
    businessId: string,
    input: CustomerInput
): Promise<Customer> {
    const { fullName, phone } = input
    const normalizedEmail = normalizeEmail(input.email)

    // Determine matching strategy
    let existingCustomer: Customer | null = null

    if (normalizedEmail) {
        // Primary match: by normalized email
        existingCustomer = await prisma.customer.findFirst({
            where: {
                businessId,
                email: normalizedEmail
            }
        })
    } else if (phone) {
        // Fallback match: by phone (only if no email provided)
        existingCustomer = await prisma.customer.findFirst({
            where: {
                businessId,
                phone
            }
        })
    }

    if (existingCustomer) {
        // Update existing customer
        return prisma.customer.update({
            where: { id: existingCustomer.id },
            data: {
                fullName,
                // Only update phone if provided and different
                ...(phone && phone !== existingCustomer.phone ? { phone } : {}),
                // Only update email if provided and different (already normalized)
                ...(normalizedEmail && normalizedEmail !== existingCustomer.email ? { email: normalizedEmail } : {})
            }
        })
    }

    // Create new customer with normalized email
    return prisma.customer.create({
        data: {
            businessId,
            fullName,
            email: normalizedEmail,
            phone: phone || null
        }
    })
}

/**
 * Get a customer by ID
 */
export async function getCustomerById(
    prisma: PrismaClient,
    businessId: string,
    customerId: string
): Promise<Customer | null> {
    return prisma.customer.findFirst({
        where: {
            id: customerId,
            businessId
        }
    })
}

/**
 * Find customer by email within a business
 * Email is normalized (lowercase) for matching
 */
export async function findCustomerByEmail(
    prisma: PrismaClient,
    businessId: string,
    email: string
): Promise<Customer | null> {
    const normalizedEmail = normalizeEmail(email)
    if (!normalizedEmail) return null

    return prisma.customer.findFirst({
        where: {
            businessId,
            email: normalizedEmail
        }
    })
}

/**
 * Find customer by phone within a business
 */
export async function findCustomerByPhone(
    prisma: PrismaClient,
    businessId: string,
    phone: string
): Promise<Customer | null> {
    return prisma.customer.findFirst({
        where: {
            businessId,
            phone
        }
    })
}
