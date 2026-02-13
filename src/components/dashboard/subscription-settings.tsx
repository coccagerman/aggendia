'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, AlertTriangle, CreditCard, XCircle } from 'lucide-react'
import type { SubscriptionStatus } from '@/domain/subscriptions/subscription.types'

interface SubscriptionData {
    id: string
    status: SubscriptionStatus
    trialStartsAt: string | null
    trialEndsAt: string | null
    trialType: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelAt: string | null
    canceledAt: string | null
    paymentProvider: string | null
}

interface Plan {
    id: string
    name: string
    slug: string
    priceCents: number
    currency: string
    intervalMonths: number
}

interface SubscriptionSettingsClientProps {
    subscription: SubscriptionData | null
    plans: Plan[]
    checkoutResult: string | null
}

const STATUS_LABELS: Record<
    SubscriptionStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
    TRIALING: { label: 'Período de prueba', variant: 'secondary' },
    ACTIVE: { label: 'Activa', variant: 'default' },
    PAST_DUE: { label: 'Pago pendiente', variant: 'destructive' },
    CANCELED: { label: 'Cancelada', variant: 'outline' },
    EXPIRED: { label: 'Expirada', variant: 'destructive' }
}

function formatDate(iso: string | null): string {
    if (!iso) return '-'
    return new Date(iso).toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}

function formatPrice(cents: number, currency: string): string {
    const amount = cents / 100
    if (currency === 'ARS') {
        return `$${amount.toLocaleString('es-AR')} ARS`
    }
    return `US$${amount.toLocaleString('en-US')}`
}

export function SubscriptionSettingsClient({ subscription, plans, checkoutResult }: SubscriptionSettingsClientProps) {
    const router = useRouter()
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
    const [cancelLoading, setCancelLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Show checkout result feedback
    useEffect(() => {
        if (checkoutResult === 'success') {
            // Refresh to get updated subscription status
            router.refresh()
        }
    }, [checkoutResult, router])

    const handleCheckout = async (planId: string) => {
        setCheckoutLoading(planId)
        setError(null)

        try {
            const response = await fetch(`/api/v1/subscription/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'Error al iniciar el pago.')
                setCheckoutLoading(null)
                return
            }

            // Redirect to Stripe Checkout
            window.location.href = data.data.checkoutUrl
        } catch {
            setError('No se pudo conectar con el servidor.')
            setCheckoutLoading(null)
        }
    }

    const handleCancel = async () => {
        if (
            !confirm(
                '¿Estás seguro de que querés cancelar tu suscripción? Seguirás teniendo acceso hasta el fin del período pagado.'
            )
        ) {
            return
        }

        setCancelLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/v1/subscription/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ immediate: false })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'Error al cancelar la suscripción.')
                setCancelLoading(false)
                return
            }

            router.refresh()
        } catch {
            setError('No se pudo conectar con el servidor.')
        } finally {
            setCancelLoading(false)
        }
    }

    const status = subscription?.status as SubscriptionStatus | undefined
    const statusInfo = status ? STATUS_LABELS[status] : null
    const canSubscribe = !status || status === 'TRIALING' || status === 'EXPIRED'
    const canCancel = status === 'ACTIVE'

    return (
        <div className='space-y-6'>
            {/* Checkout success message */}
            {checkoutResult === 'success' && (
                <div className='rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3'>
                    <CheckCircle2 className='h-5 w-5 text-green-600 shrink-0' />
                    <div>
                        <p className='font-medium text-green-800'>¡Pago exitoso!</p>
                        <p className='text-sm text-green-700'>
                            Tu suscripción está activa. Ya podés usar todas las funciones de TurnosApp.
                        </p>
                    </div>
                </div>
            )}

            {/* Current subscription status */}
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        Estado de la suscripción
                        {statusInfo && <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>}
                    </CardTitle>
                    <CardDescription>Información sobre tu plan actual</CardDescription>
                </CardHeader>
                <CardContent className='space-y-4'>
                    {subscription ? (
                        <div className='space-y-3 text-sm'>
                            {status === 'TRIALING' && subscription.trialEndsAt && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Prueba hasta</span>
                                    <span className='font-medium'>{formatDate(subscription.trialEndsAt)}</span>
                                </div>
                            )}
                            {status === 'ACTIVE' && subscription.currentPeriodEnd && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Próxima renovación</span>
                                    <span className='font-medium'>{formatDate(subscription.currentPeriodEnd)}</span>
                                </div>
                            )}
                            {status === 'CANCELED' && subscription.cancelAt && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Acceso hasta</span>
                                    <span className='font-medium'>{formatDate(subscription.cancelAt)}</span>
                                </div>
                            )}
                            {status === 'PAST_DUE' && (
                                <div className='rounded-md bg-red-50 p-3 flex items-start gap-2'>
                                    <AlertTriangle className='h-4 w-4 text-red-600 mt-0.5 shrink-0' />
                                    <p className='text-red-800 text-sm'>
                                        Hay un problema con tu pago. Actualizá tu método de pago para no perder acceso.
                                    </p>
                                </div>
                            )}
                            {subscription.paymentProvider && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Proveedor de pago</span>
                                    <span className='font-medium'>{subscription.paymentProvider}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className='text-sm text-muted-foreground'>No tenés una suscripción activa.</p>
                    )}

                    {canCancel && (
                        <div className='pt-4 border-t'>
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={handleCancel}
                                disabled={cancelLoading}
                                className='text-red-600 hover:text-red-700'
                            >
                                {cancelLoading ? (
                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                ) : (
                                    <XCircle className='mr-2 h-4 w-4' />
                                )}
                                Cancelar suscripción
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Available plans */}
            {canSubscribe && plans.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Planes disponibles</CardTitle>
                        <CardDescription>Elegí el plan que mejor se adapte a tu negocio</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='grid gap-4'>
                            {plans.map(plan => (
                                <div key={plan.id} className='flex items-center justify-between rounded-lg border p-4'>
                                    <div>
                                        <h3 className='font-semibold'>{plan.name}</h3>
                                        <p className='text-sm text-muted-foreground'>
                                            {formatPrice(plan.priceCents, plan.currency)} /{' '}
                                            {plan.intervalMonths === 1 ? 'mes' : `${plan.intervalMonths} meses`}
                                        </p>
                                    </div>
                                    <Button onClick={() => handleCheckout(plan.id)} disabled={checkoutLoading !== null}>
                                        {checkoutLoading === plan.id ? (
                                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                        ) : (
                                            <CreditCard className='mr-2 h-4 w-4' />
                                        )}
                                        Suscribirse
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No plans available message */}
            {canSubscribe && plans.length === 0 && (
                <Card>
                    <CardContent className='py-8 text-center'>
                        <p className='text-muted-foreground'>
                            No hay planes disponibles en este momento. Contactanos para más información.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Error display */}
            {error && <div className='rounded-md bg-red-50 p-3 text-sm text-red-800'>{error}</div>}
        </div>
    )
}
