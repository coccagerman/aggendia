import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/data/prisma/prisma'
import { getBusinessById } from '@/data/repositories/business.repo'
import { CreateResourceForm } from './create-resource-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface PageProps {
    params: Promise<{ businessId: string }>
}

export default async function NewResourcePage({ params }: PageProps) {
    const { businessId } = await params

    // Validar sesión
    const supabase = await createClient()
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Validar acceso al negocio
    let business
    try {
        business = await getBusinessById(prisma, businessId)
        if (!business) {
            redirect('/dashboard')
        }

        // Verificar que el usuario tiene acceso (es miembro del negocio)
        const member = await prisma.businessMember.findFirst({
            where: {
                businessId,
                userId: user.id
            }
        })

        if (!member) {
            redirect('/dashboard')
        }
    } catch (error) {
        // Si no existe o no tiene acceso, redirigir al dashboard
        console.error('Error al obtener negocio:', error instanceof Error ? error.message : 'UNKNOWN')
        redirect('/dashboard')
    }

    return (
        <div className='flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950'>
            {/* Header */}
            <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black'>
                <div className='container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8'>
                    <Button asChild variant='ghost' size='sm' className='mr-4'>
                        <Link href='/dashboard'>← Volver</Link>
                    </Button>
                    <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>Crear recurso / prestador</h1>
                </div>
            </header>

            {/* Main content */}
            <main className='flex-1 py-8'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Nuevo recurso / prestador</CardTitle>
                                <CardDescription>
                                    Agregá un nuevo recurso / prestador a {business.name} para comenzar a recibir
                                    reservas.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <CreateResourceForm businessId={businessId} resourceLabel={business.resourceLabel} />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    )
}
