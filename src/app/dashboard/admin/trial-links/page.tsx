import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LinkIcon } from 'lucide-react'
import { TrialLinksManager } from '@/components/admin/trial-links-manager'
import { Button } from '@/components/ui/button'

/**
 * Admin page for managing trial links.
 *
 * Security: Only accessible to users in ADMIN_EMAILS env var.
 * The actual admin check happens in the API routes.
 */
export default async function AdminTrialLinksPage() {
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white border-b'>
                <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4'>
                    <div className='flex items-center gap-4'>
                        <Link href='/dashboard'>
                            <Button variant='ghost' size='icon'>
                                <ArrowLeft className='h-5 w-5' />
                            </Button>
                        </Link>
                        <div className='flex items-center gap-2'>
                            <LinkIcon className='h-5 w-5 text-muted-foreground' />
                            <div>
                                <h1 className='text-xl font-semibold text-gray-900'>Trial Links</h1>
                                <p className='text-sm text-muted-foreground'>Administración de links de prueba</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className='max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
                <TrialLinksManager />
            </main>
        </div>
    )
}
