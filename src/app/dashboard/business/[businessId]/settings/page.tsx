import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings } from 'lucide-react'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById } from '@/data/repositories/business.repo'
import { checkBusinessAccess } from '@/lib/auth/require-business-access'
import { NotificationSettings } from '@/components/dashboard/notification-settings'
import { Button } from '@/components/ui/button'

interface SettingsPageProps {
    params: Promise<{ businessId: string }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
    const { businessId } = await params

    // Auth check
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Check business access
    const hasAccess = await checkBusinessAccess(user.id, businessId)
    if (!hasAccess) {
        notFound()
    }

    // Get business data
    const business = await getBusinessById(prisma, businessId)
    if (!business) {
        notFound()
    }

    return (
        <div className='min-h-screen bg-gray-50'>
            {/* Header */}
            <header className='bg-white border-b'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-4'>
                            <Link href='/dashboard'>
                                <Button variant='ghost' size='icon'>
                                    <ArrowLeft className='h-5 w-5' />
                                </Button>
                            </Link>
                            <div className='flex items-center gap-2'>
                                <Settings className='h-5 w-5 text-muted-foreground' />
                                <div>
                                    <h1 className='text-xl font-semibold text-gray-900'>Configuración</h1>
                                    <p className='text-sm text-muted-foreground'>{business.name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Content — two-column layout handled by NotificationSettings */}
            <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
                <NotificationSettings
                    businessId={businessId}
                    customerEmailEnabled={business.emailNotificationsEnabled}
                    customerWhatsappEnabled={business.whatsappNotificationsEnabled}
                    customerRemindersEnabled={business.remindersEnabled}
                    customerReminderOffsets={business.reminderOffsetsMinutes}
                    ownerEmail={business.ownerEmail}
                    ownerEmailEnabled={business.ownerEmailNotificationsEnabled}
                    ownerWhatsappEnabled={business.ownerWhatsappNotificationsEnabled}
                    ownerPhoneE164={business.ownerPhoneE164}
                    ownerRemindersEnabled={business.ownerRemindersEnabled}
                    ownerReminderOffsets={business.ownerReminderOffsetsMinutes}
                />
            </main>
        </div>
    )
}
