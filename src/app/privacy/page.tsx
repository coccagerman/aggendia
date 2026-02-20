import Link from 'next/link'

export default function PrivacyPage() {
    return (
        <main className='min-h-screen bg-zinc-50 px-4 py-10 dark:bg-zinc-950 sm:px-6 lg:px-8'>
            <div className='mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-black sm:p-8'>
                <h1 className='text-3xl font-bold text-zinc-900 dark:text-zinc-50'>Política de Privacidad</h1>
                <p className='mt-3 text-sm text-zinc-500 dark:text-zinc-400'>
                    Última actualización: 13 de febrero de 2026
                </p>

                <div className='mt-8 space-y-6 text-zinc-700 dark:text-zinc-300'>
                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            1. Datos que recopilamos
                        </h2>
                        <p className='mt-2'>
                            Recopilamos los datos necesarios para prestar el servicio de gestión de turnos, incluyendo
                            datos de cuenta, datos de negocios / sedes, y datos de clientes finales cargados por cada
                            usuario (por ejemplo, nombre, email o teléfono).
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            2. Uso de la información
                        </h2>
                        <p className='mt-2'>
                            Usamos la información para operar la plataforma, mostrar disponibilidad, registrar reservas,
                            enviar confirmaciones y recordatorios, brindar soporte técnico y mejorar el producto.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            3. Base legal y consentimiento
                        </h2>
                        <p className='mt-2'>
                            El tratamiento se realiza para ejecutar la relación contractual con los usuarios de Aggendia
                            y, cuando corresponde, sobre la base del consentimiento del titular de los datos.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            4. Conservación y seguridad
                        </h2>
                        <p className='mt-2'>
                            Conservamos la información durante el tiempo necesario para prestar el servicio y cumplir
                            obligaciones legales. Implementamos medidas técnicas y organizativas razonables para
                            proteger los datos.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            5. Terceros y proveedores
                        </h2>
                        <p className='mt-2'>
                            Podemos utilizar proveedores externos para infraestructura, autenticación, mensajería,
                            notificaciones y pagos. Estos proveedores acceden solo a la información necesaria para
                            cumplir su función.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                            6. Derechos del titular
                        </h2>
                        <p className='mt-2'>
                            Podés solicitar acceso, rectificación, actualización o eliminación de tus datos personales,
                            sujeto a requisitos legales aplicables.
                        </p>
                    </section>

                    <section>
                        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>7. Contacto</h2>
                        <p className='mt-2'>
                            Para consultas sobre privacidad, escribinos desde los canales oficiales de soporte de
                            Aggendia.
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
