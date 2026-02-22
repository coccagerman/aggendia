import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/domain/common/errors'

import * as mercadopagoClient from '@/lib/payments/mercadopago/mercadopago.client'

describe('MercadoPago client - Unit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates authorized preapproval with card token', async () => {
        const requestSpy = vi.spyOn(global, 'fetch')

        requestSpy.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ id: 'pre_123' }) } as Response)

        process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST_TOKEN'

        const response = await mercadopagoClient.createMercadoPagoAuthorizedPreapproval({
            preapprovalPlanId: 'mp_plan_123',
            externalReference: 'user-1',
            reason: 'Suscripción user-1',
            email: 'user@test.com',
            cardTokenId: 'card_token_123'
        })

        expect(response.id).toBe('pre_123')
        expect(requestSpy).toHaveBeenCalledTimes(1)

        const firstBody = JSON.parse((requestSpy.mock.calls[0][1]?.body as string) ?? '{}')
        expect(firstBody.preapproval_plan_id).toBe('mp_plan_123')
        expect(firstBody.card_token_id).toBe('card_token_123')
        expect(firstBody.status).toBe('authorized')

        requestSpy.mockRestore()
    })

    it('throws AppError when Mercado Pago responds with an error', async () => {
        const requestSpy = vi.spyOn(global, 'fetch')

        requestSpy.mockResolvedValueOnce({
            ok: false,
            text: async () => JSON.stringify({ message: 'invalid plan' })
        } as Response)

        process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST_TOKEN'

        await expect(
            mercadopagoClient.createMercadoPagoAuthorizedPreapproval({
                preapprovalPlanId: 'mp_plan_123',
                externalReference: 'user-1',
                reason: 'Suscripción user-1',
                email: 'user@test.com',
                cardTokenId: 'card_token_123'
            })
        ).rejects.toBeInstanceOf(AppError)

        expect(requestSpy).toHaveBeenCalledTimes(1)

        requestSpy.mockRestore()
    })
})
