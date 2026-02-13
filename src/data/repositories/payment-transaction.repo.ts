/**
 * Repository for PaymentTransaction entity.
 *
 * Logs all payment events from providers with idempotency.
 */

import { PrismaClient } from '@prisma/client'
import type {
    PaymentTransaction,
    PaymentProviderType,
    PaymentTransactionType,
    PaymentTransactionStatus
} from '@/domain/subscriptions/subscription.types'

/**
 * Check if a payment event has already been processed (idempotency).
 */
export async function paymentEventExists(prisma: PrismaClient, providerEventId: string): Promise<boolean> {
    const existing = await prisma.paymentTransaction.findUnique({
        where: { providerEventId },
        select: { id: true }
    })
    return existing !== null
}

/**
 * Create a payment transaction record.
 * Fails silently on duplicate providerEventId (idempotency).
 */
export async function createPaymentTransaction(
    prisma: PrismaClient,
    input: {
        subscriptionId: string
        provider: PaymentProviderType
        providerEventId: string
        providerPaymentId?: string | null
        type: PaymentTransactionType
        amountCents: number
        currency: string
        status: PaymentTransactionStatus
        metadata?: Record<string, unknown> | null
    }
): Promise<PaymentTransaction | null> {
    try {
        const result = await prisma.paymentTransaction.create({
            data: {
                subscriptionId: input.subscriptionId,
                provider: input.provider,
                providerEventId: input.providerEventId,
                providerPaymentId: input.providerPaymentId ?? null,
                type: input.type,
                amountCents: input.amountCents,
                currency: input.currency,
                status: input.status,
                metadata:
                    input.metadata !== undefined
                        ? (input.metadata as Parameters<typeof prisma.paymentTransaction.create>[0]['data']['metadata'])
                        : undefined
            }
        })
        return { ...result, metadata: result.metadata as Record<string, unknown> | null }
    } catch (error: unknown) {
        // P2002 = unique constraint violation → duplicate event, skip
        if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
            console.info(`[PaymentTransaction] Duplicate event ignored: ${input.providerEventId}`)
            return null
        }
        throw error
    }
}
