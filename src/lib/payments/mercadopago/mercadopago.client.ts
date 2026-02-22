import { AppError } from '@/domain/common/errors'
import { SubscriptionErrorCodes } from '@/domain/subscriptions/subscription.errors'

const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com'

function getMercadoPagoAccessToken(): string {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

    if (!accessToken) {
        throw new AppError(
            SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
            'Mercado Pago no está configurado. Definí MERCADOPAGO_ACCESS_TOKEN.',
            500
        )
    }

    return accessToken
}

async function mercadopagoRequest<T>(path: string, init: RequestInit): Promise<T> {
    const accessToken = getMercadoPagoAccessToken()

    const response = await fetch(`${MERCADOPAGO_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {})
        }
    })

    const text = await response.text()
    const data = text ? (JSON.parse(text) as T & { message?: string }) : ({} as T & { message?: string })

    if (!response.ok) {
        throw new AppError(
            SubscriptionErrorCodes.PAYMENT_PROVIDER_ERROR,
            data?.message || `Error de Mercado Pago (${response.status}).`,
            502
        )
    }

    return data as T
}

export interface MercadoPagoPreapproval {
    id: string
    status?: string
    init_point?: string
    external_reference?: string
    payer_email?: string
    payer_id?: string | number
    reason?: string
    date_created?: string
    date_last_modified?: string
    next_payment_date?: string
    auto_recurring?: {
        transaction_amount?: number
        currency_id?: string
    }
}

export interface MercadoPagoPreapprovalPlan {
    id: string
    reason?: string
    auto_recurring?: {
        frequency?: number
        frequency_type?: string
        transaction_amount?: number
        currency_id?: string
    }
}

export interface MercadoPagoPayment {
    id: string | number
    status?: string
    external_reference?: string
    preapproval_id?: string
    transaction_amount?: number
    currency_id?: string
    date_created?: string
    date_approved?: string | null
    payer?: {
        id?: string | number
        email?: string
    }
}

export async function createMercadoPagoAuthorizedPreapproval(input: {
    preapprovalPlanId: string
    externalReference: string
    reason: string
    email: string
    cardTokenId: string
}): Promise<MercadoPagoPreapproval> {
    return mercadopagoRequest<MercadoPagoPreapproval>('/preapproval', {
        method: 'POST',
        body: JSON.stringify({
            preapproval_plan_id: input.preapprovalPlanId,
            external_reference: input.externalReference,
            reason: input.reason,
            payer_email: input.email,
            card_token_id: input.cardTokenId,
            status: 'authorized'
        })
    })
}

export async function createMercadoPagoPreapproval(input: {
    preapprovalPlanId: string
    externalReference: string
    reason: string
    email: string
    cardTokenId: string
}): Promise<MercadoPagoPreapproval> {
    return createMercadoPagoAuthorizedPreapproval({
        preapprovalPlanId: input.preapprovalPlanId,
        externalReference: input.externalReference,
        reason: input.reason,
        email: input.email,
        cardTokenId: input.cardTokenId
    })
}

export async function updateMercadoPagoPreapproval(
    preapprovalId: string,
    payload: {
        status?: 'authorized' | 'paused' | 'cancelled' | 'pending'
        preapprovalPlanId?: string
    }
): Promise<MercadoPagoPreapproval> {
    return mercadopagoRequest<MercadoPagoPreapproval>(`/preapproval/${preapprovalId}`, {
        method: 'PUT',
        body: JSON.stringify({
            ...(payload.status ? { status: payload.status } : {}),
            ...(payload.preapprovalPlanId ? { preapproval_plan_id: payload.preapprovalPlanId } : {})
        })
    })
}

export async function getMercadoPagoPreapproval(preapprovalId: string): Promise<MercadoPagoPreapproval> {
    return mercadopagoRequest<MercadoPagoPreapproval>(`/preapproval/${preapprovalId}`, {
        method: 'GET'
    })
}

export async function getMercadoPagoPreapprovalPlan(preapprovalPlanId: string): Promise<MercadoPagoPreapprovalPlan> {
    return mercadopagoRequest<MercadoPagoPreapprovalPlan>(`/preapproval_plan/${preapprovalPlanId}`, {
        method: 'GET'
    })
}

export async function getMercadoPagoPayment(paymentId: string): Promise<MercadoPagoPayment> {
    return mercadopagoRequest<MercadoPagoPayment>(`/v1/payments/${paymentId}`, {
        method: 'GET'
    })
}

export function isMercadoPagoEnabled(): boolean {
    return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN)
}
