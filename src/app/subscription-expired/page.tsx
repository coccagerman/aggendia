import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CreditCard } from 'lucide-react'
import { prisma } from '@/data/prisma/prisma'
import { getSubscriptionStatus } from '@/domain/subscriptions/subscription.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Top-level subscription-expired page.
 *
 * This route intentionally lives OUTSIDE /dashboard so the dashboard
 * subscription gate can redirect here without risking redirect loops.
 */
export default async function SubscriptionExpiredPage() {
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const subscription = await getSubscriptionStatus(prisma, user.id)

    const isTrialExpired = subscription?.trialType && subscription.status === 'EXPIRED'
    const title = isTrialExpired ? 'Tu período de prueba terminó' : 'Tu suscripción expiró'
    const description = isTrialExpired
        ? 'Elegí un plan para seguir usando Aggendia y gestionar tus turnos sin interrupciones.'
        : 'Reactivá tu suscripción para seguir accediendo a tu agenda, turnos y configuración.'

    return (
        <div className='min-h-screen bg-gray-50 flex items-center justify-center px-4'>
            <div className='w-full max-w-md'>
                <Card>
                    <CardHeader className='text-center'>
                        <div className='mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100'>
                            <AlertTriangle className='h-7 w-7 text-amber-600' />
                        </div>
                        <CardTitle className='text-xl'>{title}</CardTitle>
                        <CardDescription className='text-base'>{description}</CardDescription>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <Link href='/subscription'>
                            <Button className='w-full' size='lg'>
                                <CreditCard className='mr-2 h-4 w-4' />
                                Elegir plan
                            </Button>
                        </Link>

                        <Link href='/login'>
                            <Button variant='ghost' className='w-full' size='sm'>
                                <ArrowLeft className='mr-2 h-4 w-4' />
                                Cerrar sesión
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
