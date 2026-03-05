import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
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
    title: 'Aggendia – Gestioná tus turnos sin complicaciones',
    description:
        'Sistema simple y económico para gestionar turnos. Reducí el caos de WhatsApp, evitá doble reservas y enviá recordatorios automáticos. Ideal para peluquerías, canchas, consultorios y talleres.',
    icons: {
        icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
        apple: '/aggendia_icon.png'
    },
    other: {
        'facebook-domain-verification': 'r2n1be8mvy0xqppb9o3yw56c2ogtmw'
    }
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
                <Analytics />
            </body>
        </html>
    )
}
