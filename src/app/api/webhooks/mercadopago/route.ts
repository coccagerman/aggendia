import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/data/prisma/prisma'
import { MercadoPagoProvider } from '@/lib/payments/mercadopago/mercadopago.provider'
import { isMercadoPagoEnabled } from '@/lib/payments/mercadopago/mercadopago.client'
import { paymentEventExists } from '@/data/repositories/payment-transaction.repo'
import {
    handlePaymentSucceeded,
    handlePaymentFailed,
    handleProviderSubscriptionCanceled
} from '@/domain/subscriptions/subscription.service'

const mercadopagoProvider = new MercadoPagoProvider()

/**
 * POST /api/webhooks/mercadopago
 */
export async function POST(request: NextRequest) {
    console.log('[Webhook:MercadoPago] Headers:', Object.fromEntries(request.headers.entries()))

    if (!isMercadoPagoEnabled()) {
        return NextResponse.json(
            { error: { code: 'CONFIG_ERROR', message: 'Mercado Pago no está configurado.' } },
            { status: 500 }
        )
    }

    const rawBody = Buffer.from(await request.arrayBuffer())
    const signature = request.headers.get('x-signature')

    if (!signature) {
        return NextResponse.json(
            { error: { code: 'INVALID_REQUEST', message: 'Missing x-signature header' } },
            { status: 400 }
        )
    }

    let rawEvent: unknown

    try {
        rawEvent = await mercadopagoProvider.constructWebhookEvent(rawBody, signature)
    } catch (error) {
        console.error('[Webhook:MercadoPago] Signature verification failed:', error)
        return NextResponse.json(
            { error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } },
            { status: 400 }
        )
    }

    const event = mercadopagoProvider.normalizeEvent(rawEvent)

    if (!event) {
        return NextResponse.json({ data: { received: true, processed: false } })
    }

    const alreadyProcessed = await paymentEventExists(prisma, event.providerEventId)
    if (alreadyProcessed) {
        return NextResponse.json({ data: { received: true, duplicate: true } })
    }

    try {
        switch (event.type) {
            case 'payment_succeeded':
                await handlePaymentSucceeded(prisma, event)
                break

            case 'payment_failed':
                await handlePaymentFailed(prisma, event)
                break

            case 'subscription_canceled':
                await handleProviderSubscriptionCanceled(prisma, event)
                break

            default:
                break
        }
    } catch (error) {
        console.error('[Webhook:MercadoPago] Error processing event:', {
            type: event.type,
            providerEventId: event.providerEventId,
            error: error instanceof Error ? error.message : 'UNKNOWN'
        })

        return NextResponse.json(
            { error: { code: 'PROCESSING_ERROR', message: 'Error processing webhook event' } },
            { status: 500 }
        )
    }

    return NextResponse.json({ data: { received: true, processed: true } })
}
