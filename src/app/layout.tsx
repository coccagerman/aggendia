import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin']
})

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin']
})

export const metadata: Metadata = {
    title: 'TurnosApp - Gestioná tus turnos sin complicaciones',
    description:
        'Sistema simple y económico para gestionar turnos. Reducí el caos de WhatsApp, evitá doble reservas y enviá recordatorios automáticos. Ideal para peluquerías, canchas, consultorios y talleres.'
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang='es'>
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                {children}
                <Toaster />
                <SpeedInsights />
            </body>
        </html>
    )
}
