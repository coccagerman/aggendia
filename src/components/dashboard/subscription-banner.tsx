'use client'

import Link from 'next/link'
import { AlertTriangle, Clock } from 'lucide-react'
import type { SubscriptionStatus } from '@/domain/subscriptions/subscription.types'

interface SubscriptionBannerProps {
    status: SubscriptionStatus
    trialDaysLeft?: number
}

/**
 * Global banner shown when subscription is in a warning state.
 * Rendered at the top of ALL dashboard views by the root dashboard layout.
 *
 * Shown for:
 * - TRIALING (throughout the whole trial) → "Te quedan X días en tu prueba gratuita"
 * - PAST_DUE → "Hay un problema con tu pago"
 * - CANCELED → "Tu suscripción fue cancelada"
 */
export function SubscriptionBanner({ status, trialDaysLeft }: SubscriptionBannerProps) {
    if (status === 'TRIALING' && trialDaysLeft !== undefined) {
        const daysText =
            trialDaysLeft === 0
                ? 'Último día'
                : trialDaysLeft === 1
                  ? 'Te queda 1 día'
                  : `Te quedan ${trialDaysLeft} días`

        return (
            <Link
                href='/subscription'
                className='block bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-sm text-amber-800 hover:bg-amber-100 transition-colors'
            >
                <Clock className='inline-block h-4 w-4 mr-1.5 -mt-0.5' />
                {daysText} en tu prueba gratuita.{' '}
                <span className='font-semibold underline'>Suscribite para no perder tus turnos</span>
            </Link>
        )
    }

    if (status === 'PAST_DUE') {
        return (
            <div className='bg-red-50 border-b border-red-200 px-4 py-2.5 text-center text-sm text-red-800'>
                <AlertTriangle className='inline-block h-4 w-4 mr-1.5 -mt-0.5' />
                Hay un problema con tu pago. Actualizá tu método de pago para no perder acceso.{' '}
                <Link href='/subscription' className='font-semibold underline hover:text-red-900'>
                    Ver detalles
                </Link>
            </div>
        )
    }

    if (status === 'CANCELED') {
        return (
            <div className='bg-orange-50 border-b border-orange-200 px-4 py-2.5 text-center text-sm text-orange-800'>
                <AlertTriangle className='inline-block h-4 w-4 mr-1.5 -mt-0.5' />
                Tu suscripción fue cancelada. Seguís teniendo acceso hasta el fin del período pagado.{' '}
                <Link href='/subscription' className='font-semibold underline hover:text-orange-900'>
                    Reactivar
                </Link>
            </div>
        )
    }

    return null
}
