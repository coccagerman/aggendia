import { z } from 'zod'

/**
 * DTOs for user-level subscription endpoints
 */

// GET /api/v1/subscription
export const subscriptionResponseSchema = z.object({
    id: z.string().uuid(),
    countryIso2: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .nullable(),
    status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED']),
    trialStartsAt: z.date().nullable(),
    trialEndsAt: z.date().nullable(),
    trialType: z.enum(['STANDARD', 'SPECIAL']),
    currentPeriodStart: z.date().nullable(),
    currentPeriodEnd: z.date().nullable(),
    cancelAt: z.date().nullable(),
    canceledAt: z.date().nullable(),
    paymentProvider: z.enum(['STRIPE']).nullable(),
    createdAt: z.date()
})

// POST /api/v1/subscription/checkout
export const createCheckoutRequestSchema = z.object({
    planId: z.string().uuid('Plan inválido')
})

// POST /api/v1/subscription/cancel
export const cancelSubscriptionRequestSchema = z.object({
    immediate: z.boolean().default(false)
})

// POST /api/v1/subscription/sync-checkout
export const syncCheckoutRequestSchema = z.object({
    sessionId: z.string().trim().min(1).optional()
})

// POST /api/v1/subscription/change-plan
export const changePlanRequestSchema = z.object({
    planId: z.string().uuid('Plan inválido')
})

// POST /api/v1/subscription/reactivate
export const reactivateSubscriptionRequestSchema = z.object({
    planId: z.string().uuid('Plan inválido')
})
