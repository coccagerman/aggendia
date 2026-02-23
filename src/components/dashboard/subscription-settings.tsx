'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Loader2, CheckCircle2, AlertTriangle, CreditCard, XCircle } from 'lucide-react'
import type { SubscriptionStatus } from '@/domain/subscriptions/subscription.types'

interface SubscriptionData {
    id: string
    planId?: string | null
    scheduledPlanId?: string | null
    status: SubscriptionStatus
    trialStartsAt: string | null
    trialEndsAt: string | null
    trialType: string
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    scheduledPlanEffectiveAt: string | null
    cancelAt: string | null
    canceledAt: string | null
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
    showPremiumDowngradeWarning: boolean
    checkoutResult: string | null
    checkoutSessionId: string | null
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

export function SubscriptionSettingsClient({
    subscription,
    plans,
    showPremiumDowngradeWarning,
    checkoutResult,
    checkoutSessionId
}: SubscriptionSettingsClientProps) {
    const router = useRouter()
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
    const [changePlanLoading, setChangePlanLoading] = useState<string | null>(null)
    const [cancelLoading, setCancelLoading] = useState(false)
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
    const [syncingCheckout, setSyncingCheckout] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [infoMessage, setInfoMessage] = useState<string | null>(null)

    // Show checkout result feedback
    useEffect(() => {
        if (checkoutResult !== 'success') return

        let isCancelled = false

        const syncCheckout = async () => {
            setSyncingCheckout(true)
            try {
                await fetch('/api/v1/subscription/sync-checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: checkoutSessionId ?? undefined
                    })
                })
            } catch {
                // Keep UX non-blocking; webhook may still update shortly.
            } finally {
                if (!isCancelled) {
                    setSyncingCheckout(false)
                    router.refresh()
                }
            }
        }

        void syncCheckout()

        return () => {
            isCancelled = true
        }
    }, [checkoutResult, checkoutSessionId, router])

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

    const handleChangePlan = async (planId: string) => {
        setInfoMessage(null)
        setChangePlanLoading(planId)
        setError(null)

        try {
            const response = await fetch('/api/v1/subscription/change-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'No se pudo programar el cambio de plan.')
                setChangePlanLoading(null)
                return
            }

            setInfoMessage(data.data?.message || 'Cambio de plan programado para la próxima renovación.')
            router.refresh()
        } catch {
            setError('No se pudo conectar con el servidor.')
        } finally {
            setChangePlanLoading(null)
        }
    }

    const handleReactivate = async (planId: string) => {
        setInfoMessage(null)
        setChangePlanLoading(planId)
        setError(null)

        try {
            const response = await fetch('/api/v1/subscription/reactivate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'No se pudo reactivar la suscripción.')
                setChangePlanLoading(null)
                return
            }

            setInfoMessage(data.data?.message || 'Suscripción reactivada correctamente.')
            router.refresh()
        } catch {
            setError('No se pudo conectar con el servidor.')
        } finally {
            setChangePlanLoading(null)
        }
    }

    const handleCancel = async () => {
        setInfoMessage(null)
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

            setCancelDialogOpen(false)
            router.refresh()
        } catch {
            setError('No se pudo conectar con el servidor.')
        } finally {
            setCancelLoading(false)
        }
    }

    // Optimistic state: checkout just completed, show as ACTIVE even if webhook/sync
    // hasn't propagated yet. The planId is persisted before Stripe redirect,
    // so subscription.planId should already point to the correct plan.
    const justCompletedCheckout = checkoutResult === 'success'

    const serverStatus = subscription?.status as SubscriptionStatus | undefined
    const status = justCompletedCheckout && serverStatus !== 'ACTIVE' ? 'ACTIVE' : serverStatus
    const statusInfo = status ? STATUS_LABELS[status] : null
    const currentPlanId = subscription?.planId ?? null
    const currentPlan = currentPlanId ? plans.find(p => p.id === currentPlanId) : undefined
    const scheduledPlanId = subscription?.scheduledPlanId ?? null
    const scheduledPlanEffectiveAt = subscription?.scheduledPlanEffectiveAt ?? null
    const scheduledPlan = scheduledPlanId ? plans.find(p => p.id === scheduledPlanId) : undefined
    const scheduledPlanEffectiveAtMs = scheduledPlanEffectiveAt ? new Date(scheduledPlanEffectiveAt).getTime() : null
    const hasScheduledPlanChange =
        status === 'ACTIVE' &&
        scheduledPlanEffectiveAtMs !== null &&
        Boolean(scheduledPlanId) &&
        scheduledPlanEffectiveAtMs > Date.now()
    const canSubscribe =
        !justCompletedCheckout &&
        (!status || status === 'TRIALING' || status === 'EXPIRED' || status === 'ACTIVE' || status === 'CANCELED')
    const canCancel = status === 'ACTIVE' && !justCompletedCheckout

    function isUpgradePlan(plan: Plan): boolean {
        if (!currentPlan) return true
        return plan.priceCents > currentPlan.priceCents
    }

    return (
        <div className='space-y-6'>
            {/* Checkout success message */}
            {checkoutResult === 'success' && (
                <div className='rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3'>
                    <CheckCircle2 className='h-5 w-5 text-green-600 shrink-0' />
                    <div>
                        <p className='font-medium text-green-800'>¡Pago exitoso!</p>
                        <p className='text-sm text-green-700'>
                            {syncingCheckout
                                ? 'Estamos confirmando tu suscripción. Esto puede demorar unos segundos.'
                                : 'Tu suscripción está activa. Ya podés usar todas las funciones de Aggendia.'}
                        </p>
                    </div>
                </div>
            )}

            {infoMessage && (
                <div className='rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800'>
                    {infoMessage}
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
                            {status === 'TRIALING' && !justCompletedCheckout && subscription.trialEndsAt && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Prueba hasta</span>
                                    <span className='font-medium'>{formatDate(subscription.trialEndsAt)}</span>
                                </div>
                            )}
                            {justCompletedCheckout && currentPlan && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Plan actual</span>
                                    <span className='font-medium'>
                                        {currentPlan.name} ({formatPrice(currentPlan.priceCents, currentPlan.currency)}{' '}
                                        /{' '}
                                        {currentPlan.intervalMonths === 1
                                            ? 'mes'
                                            : `${currentPlan.intervalMonths} meses`}
                                        )
                                    </span>
                                </div>
                            )}
                            {status === 'ACTIVE' && !justCompletedCheckout && subscription.currentPeriodEnd && (
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
                            {status === 'ACTIVE' && currentPlan && (
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>Plan actual</span>
                                    <span className='font-medium'>
                                        {currentPlan.name} ({formatPrice(currentPlan.priceCents, currentPlan.currency)}{' '}
                                        /{' '}
                                        {currentPlan.intervalMonths === 1
                                            ? 'mes'
                                            : `${currentPlan.intervalMonths} meses`}
                                        )
                                    </span>
                                </div>
                            )}
                            {hasScheduledPlanChange && scheduledPlanEffectiveAt && (
                                <div className='rounded-md bg-blue-50 p-3 flex items-start gap-2'>
                                    <CreditCard className='h-4 w-4 text-blue-600 mt-0.5 shrink-0' />
                                    <p className='text-blue-800 text-sm'>
                                        Cambio programado para próxima renovación:{' '}
                                        <span className='font-medium'>{scheduledPlan?.name ?? 'nuevo plan'}</span> el{' '}
                                        <span className='font-medium'>{formatDate(scheduledPlanEffectiveAt)}</span>.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className='text-sm text-muted-foreground'>No tenés una suscripción activa.</p>
                    )}

                    {canCancel && (
                        <div className='pt-4 border-t'>
                            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    onClick={() => setCancelDialogOpen(true)}
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
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Cancelar suscripción?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Vas a mantener acceso hasta el fin del período ya pagado. Podés volver a
                                            suscribirte cuando quieras.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={cancelLoading}>Volver</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={e => {
                                                e.preventDefault()
                                                void handleCancel()
                                            }}
                                            disabled={cancelLoading}
                                            className='bg-red-600 hover:bg-red-700'
                                        >
                                            {cancelLoading ? 'Cancelando...' : 'Sí, cancelar'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Available plans */}
            {canSubscribe && plans.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Planes disponibles</CardTitle>
                        <CardDescription>Elegí el plan que mejor se adapte a tu operación</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className='grid gap-4'>
                            {plans.map(plan => (
                                <div
                                    key={plan.id}
                                    className='flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-start md:justify-between'
                                >
                                    <div className='space-y-2 md:max-w-[70%]'>
                                        <h3 className='font-semibold leading-none'>{plan.name}</h3>
                                        <p className='text-base font-medium text-zinc-900 dark:text-zinc-100'>
                                            {formatPrice(plan.priceCents, plan.currency)} /{' '}
                                            {plan.intervalMonths === 1 ? 'mes' : `${plan.intervalMonths} meses`}
                                        </p>
                                        {plan.slug === 'base' ? (
                                            <p className='text-sm text-muted-foreground'>
                                                Turnos ilimitados y hasta 3 negocios / sedes activas.
                                            </p>
                                        ) : plan.slug === 'premium' ? (
                                            <>
                                                <p className='text-sm text-muted-foreground'>
                                                    Turnos ilimitados y negocios / sedes activas ilimitadas.
                                                </p>
                                                {showPremiumDowngradeWarning && (
                                                    <p className='text-sm text-muted-foreground'>
                                                        Si pasás de Premium a Base con más de 3 activos, se desactivan y
                                                        podés reactivar hasta 3.
                                                    </p>
                                                )}
                                            </>
                                        ) : null}
                                    </div>
                                    <div className='md:shrink-0 md:self-center'>
                                        {status === 'ACTIVE' && currentPlanId === plan.id ? (
                                            <Button variant='secondary' disabled>
                                                Plan actual
                                            </Button>
                                        ) : status === 'ACTIVE' && scheduledPlanId === plan.id ? (
                                            <Button variant='secondary' disabled>
                                                Cambio programado
                                            </Button>
                                        ) : status === 'CANCELED' && currentPlanId === plan.id ? (
                                            <Button
                                                onClick={() => handleReactivate(plan.id)}
                                                disabled={checkoutLoading !== null || changePlanLoading !== null}
                                            >
                                                {changePlanLoading === plan.id ? (
                                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                ) : (
                                                    <CreditCard className='mr-2 h-4 w-4' />
                                                )}
                                                Reactivar
                                            </Button>
                                        ) : status === 'CANCELED' && currentPlan && currentPlanId !== plan.id ? (
                                            <Button
                                                onClick={() => handleReactivate(plan.id)}
                                                disabled={checkoutLoading !== null || changePlanLoading !== null}
                                            >
                                                {changePlanLoading === plan.id ? (
                                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                ) : (
                                                    <CreditCard className='mr-2 h-4 w-4' />
                                                )}
                                                {isUpgradePlan(plan) ? 'Mejorar plan' : 'Cambiar plan'}
                                            </Button>
                                        ) : status === 'ACTIVE' && currentPlan && !isUpgradePlan(plan) ? (
                                            <Button
                                                onClick={() => handleChangePlan(plan.id)}
                                                disabled={checkoutLoading !== null || changePlanLoading !== null}
                                            >
                                                {changePlanLoading === plan.id ? (
                                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                ) : (
                                                    <CreditCard className='mr-2 h-4 w-4' />
                                                )}
                                                Cambiar plan
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => handleCheckout(plan.id)}
                                                disabled={checkoutLoading !== null || changePlanLoading !== null}
                                            >
                                                {checkoutLoading === plan.id ? (
                                                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                                ) : (
                                                    <CreditCard className='mr-2 h-4 w-4' />
                                                )}
                                                {status === 'ACTIVE' ? 'Mejorar plan' : 'Suscribirse'}
                                            </Button>
                                        )}
                                    </div>
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
