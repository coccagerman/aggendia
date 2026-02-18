import Link from 'next/link'
import {
    Calendar,
    Users,
    Zap,
    Shield,
    CheckCircle2,
    Scissors,
    Dumbbell,
    Stethoscope,
    Wrench,
    Building2,
    ArrowRight,
    Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export default function Home() {
    return (
        <div className='flex min-h-screen flex-col'>
            {/* Hero Section */}
            <section className='relative overflow-hidden bg-linear-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black'>
                <div className='container mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32'>
                    <div className='mx-auto max-w-3xl text-center'>
                        <h1 className='text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl lg:text-6xl'>
                            Gestioná tus turnos sin complicaciones
                        </h1>
                        <p className='mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400 sm:text-xl'>
                            Dejá atrás el caos de WhatsApp. Tu agenda ordenada, tus clientes reservan solos, vos te
                            dedicás a tu negocio.
                        </p>
                        <div className='mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row'>
                            <Button asChild size='lg' className='w-full sm:w-auto'>
                                <Link href='/signup'>
                                    Iniciar prueba gratis (30 días)
                                    <ArrowRight className='ml-2 h-4 w-4' />
                                </Link>
                            </Button>
                            <Button asChild variant='outline' size='lg' className='w-full sm:w-auto'>
                                <Link href='/subscription'>Ver planes y suscribirme</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className='bg-white py-16 dark:bg-black sm:py-24'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl text-center'>
                        <h2 className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl'>
                            ¿Por qué TurnosApp?
                        </h2>
                        <p className='mt-4 text-lg text-zinc-600 dark:text-zinc-400'>
                            Simple, económico y diseñado para que te olvides del estrés de gestionar turnos
                        </p>
                    </div>

                    <div className='mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                        <Card>
                            <CardHeader>
                                <Calendar className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Agenda ordenada por recurso</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Cada profesional, cancha o consultorio tiene su propia agenda clara. Sin
                                    confusiones.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Users className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Tus clientes reservan solos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Compartí un link y listo. Ellos eligen día, horario y confirman en menos de 1
                                    minuto.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Shield className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Evitá doble reservas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    El sistema bloquea automáticamente los horarios ocupados. Sin superposiciones.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Bell className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Recordatorios automáticos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Enviá emails de confirmación y recordatorios 24h/2h antes. Reducí los no-shows.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Zap className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Configuración en minutos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Agregás tus servicios, horarios de atención y ya está. Sin tutoriales complicados.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CheckCircle2 className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Costo bajo, sin sorpresas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Sin instalaciones, sin hardware. Solo una herramienta simple que funciona.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className='bg-zinc-50 py-16 dark:bg-zinc-950 sm:py-24'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl text-center'>
                        <h2 className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl'>
                            ¿Cómo funciona?
                        </h2>
                        <p className='mt-4 text-lg text-zinc-600 dark:text-zinc-400'>
                            Tres pasos para empezar a recibir turnos en línea
                        </p>
                    </div>

                    <div className='mt-16 grid gap-8 md:grid-cols-3'>
                        <div className='flex flex-col items-center text-center'>
                            <div className='flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground'>
                                1
                            </div>
                            <h3 className='mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                                Configurá tu negocio o sede
                            </h3>
                            <p className='mt-4 text-zinc-600 dark:text-zinc-400'>
                                Agregá tus servicios, profesionales (o recursos) y horarios de atención. Todo en un solo
                                lugar.
                            </p>
                        </div>

                        <div className='flex flex-col items-center text-center'>
                            <div className='flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground'>
                                2
                            </div>
                            <h3 className='mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                                Compartí tu link
                            </h3>
                            <p className='mt-4 text-zinc-600 dark:text-zinc-400'>
                                Copiá tu link único y compartilo en redes, WhatsApp o donde prefieras. Simple como eso.
                            </p>
                        </div>

                        <div className='flex flex-col items-center text-center'>
                            <div className='flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground'>
                                3
                            </div>
                            <h3 className='mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
                                Recibí reservas
                            </h3>
                            <p className='mt-4 text-zinc-600 dark:text-zinc-400'>
                                Tus clientes eligen su horario y confirman. Vos recibís todo ordenado en tu agenda.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Use Cases Section */}
            <section className='bg-white py-16 dark:bg-black sm:py-24'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl text-center'>
                        <h2 className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl'>
                            ¿Para quién es?
                        </h2>
                        <p className='mt-4 text-lg text-zinc-600 dark:text-zinc-400'>
                            Ideal para cualquier negocio, sede o institución que trabaje con turnos
                        </p>
                    </div>

                    <div className='mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-5'>
                        <Card>
                            <CardHeader>
                                <Scissors className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Peluquerías y salones</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Gestioná turnos de múltiples profesionales sin confusión ni llamadas constantes.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Dumbbell className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Canchas y gimnasios</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Reservá turnos de canchas, clases o equipos. Todo visible y organizado.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Stethoscope className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Consultorios médicos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Agendá pacientes por profesional con horarios claros y recordatorios automáticos.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Wrench className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Talleres y servicios</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Mecánicos, reparaciones, asesorías. Cualquier servicio que necesite turnos.
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <Building2 className='mb-2 h-10 w-10 text-primary' />
                                <CardTitle>Instituciones públicas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className='text-zinc-600 dark:text-zinc-400'>
                                    Organismos, dependencias y centros de atención con múltiples sedes y agendas
                                    ordenadas.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section className='bg-zinc-50 py-16 dark:bg-zinc-950 sm:py-24'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl text-center'>
                        <h2 className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl'>
                            Planes claros desde el primer día
                        </h2>
                        <p className='mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400'>
                            Probá TurnosApp gratis por 30 días y después elegí el plan que mejor se adapte a tu
                            operación.
                        </p>
                    </div>

                    <div className='mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2'>
                        <Card>
                            <CardContent className='flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between'>
                                <div className='space-y-2 md:max-w-[70%]'>
                                    <h3 className='font-semibold leading-none'>Base</h3>
                                    <p className='text-base font-medium text-zinc-900 dark:text-zinc-100'>US$9 / mes</p>
                                    <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                                        Turnos ilimitados y hasta 3 negocios o sedes activas.
                                    </p>
                                </div>
                                <div className='md:shrink-0 md:self-center'>
                                    <Button asChild>
                                        <Link href='/signup'>
                                            Iniciar prueba gratis
                                            <ArrowRight className='ml-2 h-4 w-4' />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className='flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between'>
                                <div className='space-y-2 md:max-w-[70%]'>
                                    <h3 className='font-semibold leading-none'>Premium</h3>
                                    <p className='text-base font-medium text-zinc-900 dark:text-zinc-100'>
                                        US$14 / mes
                                    </p>
                                    <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                                        Turnos ilimitados y negocios o sedes activas ilimitadas.
                                    </p>
                                </div>
                                <div className='md:shrink-0 md:self-center'>
                                    <Button asChild variant='outline'>
                                        <Link href='/subscription'>
                                            Suscribirme ahora
                                            <ArrowRight className='ml-2 h-4 w-4' />
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className='mt-8 text-center'>
                        <div className='inline-flex flex-col gap-3 sm:flex-row'>
                            <Button asChild size='lg'>
                                <Link href='/signup'>Empezar prueba gratis</Link>
                            </Button>
                            <Button asChild size='lg' variant='outline'>
                                <Link href='/subscription'>Suscribirme</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className='bg-white py-16 dark:bg-black sm:py-24'>
                <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
                    <div className='mx-auto max-w-2xl'>
                        <h2 className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl'>
                            Preguntas frecuentes
                        </h2>
                        <p className='mt-4 text-lg text-zinc-600 dark:text-zinc-400'>
                            Resolvemos tus dudas para que empieces sin vueltas
                        </p>

                        <Accordion type='single' collapsible className='mt-10'>
                            <AccordionItem value='item-1'>
                                <AccordionTrigger>¿Necesito instalar algo en mi computadora?</AccordionTrigger>
                                <AccordionContent>
                                    No. TurnosApp es 100% web, funciona desde cualquier navegador. No hay software que
                                    instalar ni actualizar.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value='item-2'>
                                <AccordionTrigger>¿Mis clientes necesitan crear una cuenta?</AccordionTrigger>
                                <AccordionContent>
                                    No. Tus clientes solo necesitan tu link para reservar. Ponen su nombre, email o
                                    teléfono y listo. Es rápido y sin fricciones.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value='item-3'>
                                <AccordionTrigger>¿Se puede usar desde el celular?</AccordionTrigger>
                                <AccordionContent>
                                    Sí. Tanto vos como tus clientes pueden usar TurnosApp desde cualquier dispositivo:
                                    celular, tablet o computadora. El diseño se adapta automáticamente.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value='item-4'>
                                <AccordionTrigger>¿Cómo evita las doble reservas?</AccordionTrigger>
                                <AccordionContent>
                                    El sistema bloquea automáticamente los horarios ocupados en tiempo real. Cuando
                                    alguien reserva un turno, ese horario desaparece inmediatamente para otros clientes.
                                    Es imposible que se superpongan.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value='item-5'>
                                <AccordionTrigger>¿Cuánto tiempo tarda en configurarse?</AccordionTrigger>
                                <AccordionContent>
                                    Entre 5 y 10 minutos. Creás tu cuenta, agregás tus servicios y horarios de atención,
                                    y ya podés compartir tu link para empezar a recibir turnos.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className='border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950'>
                <div className='container mx-auto px-4 py-12 sm:px-6 lg:px-8'>
                    <div className='flex flex-col items-center justify-between gap-6 sm:flex-row'>
                        <div className='text-center sm:text-left'>
                            <p className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>TurnosApp</p>
                            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                                Gestioná tus turnos sin complicaciones
                            </p>
                        </div>
                        <div className='flex flex-wrap justify-center gap-6 text-sm'>
                            <Link
                                href='/privacy'
                                className='text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                            >
                                Privacidad
                            </Link>
                            <Link
                                href='/terms'
                                className='text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                            >
                                Términos
                            </Link>
                        </div>
                    </div>
                    <Separator className='my-8' />
                    <p className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
                        © {new Date().getFullYear()} TurnosApp. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    )
}
