import crypto from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MercadoPagoProvider, normalizeTopicForRouting } from '@/lib/payments/mercadopago/mercadopago.provider'

// Mock the external MP API calls used inside constructWebhookEvent
vi.mock('@/lib/payments/mercadopago/mercadopago.client', () => ({
    getMercadoPagoPreapproval: vi.fn().mockResolvedValue({
        id: 'preapproval_123',
        status: 'authorized',
        external_reference: 'biz_1',
        payer_email: 'payer@test.com',
        payer_id: 12345,
        date_created: '2025-01-01T00:00:00.000-03:00',
        date_last_modified: '2025-01-01T00:00:00.000-03:00',
        next_payment_date: '2025-02-01T00:00:00.000-03:00',
        auto_recurring: { transaction_amount: 5000, currency_id: 'ARS' }
    }),
    getMercadoPagoPayment: vi.fn().mockResolvedValue(null),
    createMercadoPagoAuthorizedPreapproval: vi.fn(),
    updateMercadoPagoPreapproval: vi.fn()
}))

const SECRET = 'test_webhook_secret_abc123'

function buildSignature(dataId: string | undefined, requestId: string | undefined, ts: string): string {
    let manifest = ''
    if (dataId) manifest += `id:${dataId};`
    if (requestId) manifest += `request-id:${requestId};`
    manifest += `ts:${ts};`

    const v1 = crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')
    return `ts=${ts},v1=${v1}`
}

describe('MercadoPagoProvider - webhook signature validation', () => {
    const provider = new MercadoPagoProvider()

    beforeEach(() => {
        vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', SECRET)
    })

    const samplePayload = Buffer.from(
        JSON.stringify({
            id: 12345,
            type: 'preapproval',
            action: 'updated',
            data: { id: 'preapproval_123' }
        })
    )

    it('accepts valid signature with dataId and requestId', async () => {
        const ts = '1704908010'
        const dataId = 'preapproval_123'
        const requestId = 'req-abc-456'
        const signature = buildSignature(dataId, requestId, ts)

        const result = await provider.constructWebhookEvent(samplePayload, signature, {
            dataId,
            requestId
        })

        expect(result).toBeDefined()
        expect((result as { topic: string }).topic).toBe('preapproval')
    })

    it('accepts valid signature without requestId', async () => {
        const ts = '1704908010'
        const dataId = 'preapproval_123'
        const signature = buildSignature(dataId, undefined, ts)

        const result = await provider.constructWebhookEvent(samplePayload, signature, {
            dataId
        })

        expect(result).toBeDefined()
    })

    it('accepts valid signature without dataId', async () => {
        const ts = '1704908010'
        const requestId = 'req-xyz'
        const signature = buildSignature(undefined, requestId, ts)

        const result = await provider.constructWebhookEvent(samplePayload, signature, {
            requestId
        })

        expect(result).toBeDefined()
    })

    it('rejects signature with wrong secret', async () => {
        const ts = '1704908010'
        const dataId = 'preapproval_123'
        // Build with wrong secret
        const wrongV1 = crypto.createHmac('sha256', 'wrong_secret').update(`id:${dataId};ts:${ts};`).digest('hex')
        const signature = `ts=${ts},v1=${wrongV1}`

        await expect(provider.constructWebhookEvent(samplePayload, signature, { dataId })).rejects.toThrow(
            'Verificación de firma de Mercado Pago fallida.'
        )
    })

    it('rejects signature with missing ts', async () => {
        const signature = 'v1=abc123'

        await expect(
            provider.constructWebhookEvent(samplePayload, signature, { dataId: 'preapproval_123' })
        ).rejects.toThrow('Firma de webhook de Mercado Pago inválida.')
    })

    it('rejects signature with missing v1', async () => {
        const signature = 'ts=1704908010'

        await expect(
            provider.constructWebhookEvent(samplePayload, signature, { dataId: 'preapproval_123' })
        ).rejects.toThrow('Firma de webhook de Mercado Pago inválida.')
    })

    it('skips validation when no webhook secret is configured', async () => {
        vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', '')

        const result = await provider.constructWebhookEvent(samplePayload, 'ts=123,v1=fake', {
            dataId: 'preapproval_123'
        })

        expect(result).toBeDefined()
        expect((result as { topic: string }).topic).toBe('preapproval')
    })

    it('normalizes subscription_preapproval topic from dashboard webhook', async () => {
        vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', '')

        const dashboardPayload = Buffer.from(
            JSON.stringify({
                id: 99999,
                type: 'subscription_preapproval',
                action: 'updated',
                data: { id: 'preapproval_123' }
            })
        )

        const result = await provider.constructWebhookEvent(dashboardPayload, 'ts=123,v1=fake', {
            dataId: 'preapproval_123'
        })

        expect(result).toBeDefined()
        // Topic should be normalized from "subscription_preapproval" to "preapproval"
        expect((result as { topic: string }).topic).toBe('preapproval')
        expect((result as { preapprovalDetails: unknown }).preapprovalDetails).not.toBeNull()
    })
})

describe('normalizeTopicForRouting', () => {
    it('maps subscription_preapproval to preapproval', () => {
        expect(normalizeTopicForRouting('subscription_preapproval')).toBe('preapproval')
    })

    it('maps subscription_authorized_payment to payment', () => {
        expect(normalizeTopicForRouting('subscription_authorized_payment')).toBe('payment')
    })

    it('maps subscription_preapproval_plan to preapproval_plan', () => {
        expect(normalizeTopicForRouting('subscription_preapproval_plan')).toBe('preapproval_plan')
    })

    it('passes through unknown topics unchanged', () => {
        expect(normalizeTopicForRouting('payment')).toBe('payment')
        expect(normalizeTopicForRouting('preapproval')).toBe('preapproval')
        expect(normalizeTopicForRouting('something_else')).toBe('something_else')
    })
})

describe('MercadoPagoProvider - normalizeEvent', () => {
    const provider = new MercadoPagoProvider()

    it('maps preapproval authorized to payment_succeeded', () => {
        const event = provider.normalizeEvent({
            payload: { id: 111, type: 'preapproval', action: 'updated', data: { id: 'pre_1' } },
            topic: 'preapproval',
            action: 'updated',
            resourceId: 'pre_1',
            preapprovalDetails: {
                id: 'pre_1',
                status: 'authorized',
                external_reference: 'biz_1',
                payer_email: 'p@test.com',
                payer_id: 1,
                date_created: '2025-01-01T00:00:00.000Z',
                date_last_modified: '2025-01-01T00:00:00.000Z',
                next_payment_date: '2025-02-01T00:00:00.000Z',
                auto_recurring: { transaction_amount: 5000, currency_id: 'ARS' }
            },
            paymentDetails: null
        })

        expect(event).not.toBeNull()
        expect(event!.type).toBe('payment_succeeded')
        expect(event!.providerSubscriptionId).toBe('pre_1')
        expect(event!.provider).toBe('MERCADOPAGO')
    })

    it('maps preapproval cancelled to subscription_canceled', () => {
        const event = provider.normalizeEvent({
            payload: { id: 222, type: 'preapproval', action: 'updated', data: { id: 'pre_2' } },
            topic: 'preapproval',
            action: 'updated',
            resourceId: 'pre_2',
            preapprovalDetails: {
                id: 'pre_2',
                status: 'cancelled',
                external_reference: 'biz_2',
                payer_email: 'p@test.com',
                payer_id: 2,
                date_created: '2025-01-01T00:00:00.000Z',
                date_last_modified: '2025-01-01T00:00:00.000Z',
                auto_recurring: { transaction_amount: 5000, currency_id: 'ARS' }
            },
            paymentDetails: null
        })

        expect(event).not.toBeNull()
        expect(event!.type).toBe('subscription_canceled')
    })

    it('returns null for unknown topic', () => {
        const event = provider.normalizeEvent({
            payload: { id: 333, type: 'unknown_topic' },
            topic: 'unknown_topic',
            action: '',
            resourceId: null,
            preapprovalDetails: null,
            paymentDetails: null
        })

        expect(event).toBeNull()
    })
})
