import Link from 'next/link'

export default function TermsPage() {
    return (
        <main className='min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-black sm:p-8'>
                <h1 className='text-3xl font-bold text-zinc-900 dark:text-zinc-50'>Términos y Condiciones</h1>
                <p className='mt-3 text-sm text-zinc-500 dark:text-zinc-400'>
                    Última actualización: 13 de febrero de 2026
                </p>

                <div className='mt-8 space-y-6 text-zinc-700 dark:text-zinc-300'>
                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>1. Aceptación</h2>
                        <p className='mt-2'>
                            Al usar TurnosApp aceptás estos términos. Si no estás de acuerdo, no utilices la plataforma.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>2. Servicio</h2>
                        <p className='mt-2'>
                            TurnosApp permite gestionar turnos, negocios o sedes, servicios, recursos, agenda y
                            notificaciones asociadas.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            3. Cuenta y responsabilidad
                        </h2>
                        <p className='mt-2'>
                            Cada usuario es responsable de la confidencialidad de sus credenciales y de la información
                            que carga en la plataforma.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            4. Planes, prueba gratuita y facturación
                        </h2>
                        <p className='mt-2'>
                            El servicio puede incluir prueba gratuita y planes pagos (por ejemplo Base y Premium). Los
                            precios y alcances se informan en la sección de suscripción vigente al momento de contratar.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>5. Uso permitido</h2>
                        <p className='mt-2'>
                            No está permitido usar TurnosApp para actividades ilegales, fraudulentas o que vulneren
                            derechos de terceros.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            6. Disponibilidad y cambios
                        </h2>
                        <p className='mt-2'>
                            Podemos realizar mejoras, mantenimientos o cambios funcionales, procurando minimizar
                            interrupciones del servicio.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            7. Limitación de responsabilidad
                        </h2>
                        <p className='mt-2'>
                            En la medida permitida por la ley, TurnosApp no será responsable por daños indirectos,
                            incidentales o pérdida de beneficios derivados del uso de la plataforma.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>8. Contacto</h2>
                        <p className='mt-2'>
                            Para consultas contractuales, escribinos por los canales oficiales de soporte de TurnosApp.
                        </p>
                    </section>
                </div>

                <div className='mt-8'>
                    <Link
                        href='/'
                        className='text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
                    >
                        ← Volver al inicio
                    </Link>
                </div>
            </div>
        </main>
    )
}
