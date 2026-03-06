export default function MaintenancePage() {
    return (
        <main className='flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950'>
            <section className='w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900'>
                <div className='mx-auto mb-6 h-44 w-44' aria-hidden>
                    <svg viewBox='0 0 220 220' className='h-full w-full'>
                        <defs>
                            <linearGradient id='bg' x1='0%' y1='0%' x2='100%' y2='100%'>
                                <stop offset='0%' stopColor='currentColor' stopOpacity='0.08' />
                                <stop offset='100%' stopColor='currentColor' stopOpacity='0.18' />
                            </linearGradient>
                        </defs>
                        <circle cx='110' cy='110' r='92' fill='url(#bg)' className='text-primary' />
                        <g
                            fill='none'
                            stroke='currentColor'
                            className='text-primary'
                            strokeWidth='6'
                            strokeLinecap='round'
                        >
                            <path d='M76 106h68' />
                            <path d='M88 128h44' opacity='0.75' />
                            <path d='M110 74v18' opacity='0.75' />
                        </g>
                        <circle cx='88' cy='94' r='6' fill='currentColor' className='text-primary' />
                        <circle cx='132' cy='94' r='6' fill='currentColor' className='text-primary' />
                    </svg>
                </div>

                <h1 className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50'>Próximamente</h1>
                <p className='mt-4 text-base text-zinc-600 dark:text-zinc-300'>
                    Estamos trabajando en nuevas funcionalidades. Próximamente.
                </p>
            </section>
        </main>
    )
}
