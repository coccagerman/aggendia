import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/domain/common/errors'

import * as mercadopagoClient from '@/lib/payments/mercadopago/mercadopago.client'

describe('MercadoPago client - Unit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('retries preapproval creation with auto_recurring when card_token_id is required', async () => {
        const requestSpy = vi.spyOn(global, 'fetch')

        requestSpy
            .mockResolvedValueOnce({
                ok: false,
                text: async () => JSON.stringify({ message: 'card_token_id is required' })
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                text: async () =>
                    JSON.stringify({
                        id: 'mp_plan_123',
                        auto_recurring: {
                            frequency: 1,
                            frequency_type: 'months',
                            transaction_amount: 12000,
                            currency_id: 'ARS'
                        }
                    })
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                text: async () => JSON.stringify({ id: 'pre_123', init_point: 'https://mp.test/checkout' })
            } as Response)

        process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST_TOKEN'

        const response = await mercadopagoClient.createMercadoPagoPreapproval({
            preapprovalPlanId: 'mp_plan_123',
            externalReference: 'user-1',
            reason: 'Suscripción user-1',
            backUrl: 'https://app.test/subscription?checkout=success',
            email: 'user@test.com'
        })

        expect(response.id).toBe('pre_123')
        expect(response.init_point).toBe('https://mp.test/checkout')
        expect(requestSpy).toHaveBeenCalledTimes(3)

        const firstBody = JSON.parse((requestSpy.mock.calls[0][1]?.body as string) ?? '{}')
        expect(firstBody.preapproval_plan_id).toBe('mp_plan_123')

        const thirdBody = JSON.parse((requestSpy.mock.calls[2][1]?.body as string) ?? '{}')
        expect(thirdBody.preapproval_plan_id).toBeUndefined()
        expect(thirdBody.auto_recurring).toEqual({
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: 12000,
            currency_id: 'ARS'
        })

        requestSpy.mockRestore()
    })

    it('does not retry when error is different from card_token_id requirement', async () => {
        const requestSpy = vi.spyOn(global, 'fetch')

        requestSpy.mockResolvedValueOnce({
            ok: false,
            text: async () => JSON.stringify({ message: 'invalid plan' })
        } as Response)

        const getPlanSpy = vi.spyOn(mercadopagoClient, 'getMercadoPagoPreapprovalPlan')

        process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST_TOKEN'

        await expect(
            mercadopagoClient.createMercadoPagoPreapproval({
                preapprovalPlanId: 'mp_plan_123',
                externalReference: 'user-1',
                reason: 'Suscripción user-1',
                backUrl: 'https://app.test/subscription?checkout=success',
                email: 'user@test.com'
            })
        ).rejects.toBeInstanceOf(AppError)

        expect(requestSpy).toHaveBeenCalledTimes(1)
        expect(getPlanSpy).not.toHaveBeenCalled()

        getPlanSpy.mockRestore()
        requestSpy.mockRestore()
    })
})
