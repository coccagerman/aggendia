/**
 * Unit Tests - Landing Page (Home)
 *
 * Tests que validan que la página principal renderiza correctamente
 * con todos los elementos esperados.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Home from '@/app/page'

describe('Home Page', () => {
    it('renders the main heading', () => {
        render(<Home />)
        expect(screen.getByRole('heading', { name: /gestioná tus turnos/i, level: 1 })).toBeInTheDocument()
    })

    it('renders the value proposition', () => {
        render(<Home />)
        expect(screen.getByText(/Dejá atrás el caos de WhatsApp/i)).toBeInTheDocument()
    })

    it('renders signup CTA button', () => {
        render(<Home />)
        const signupButton = screen
            .getAllByRole('link', { name: /Iniciar prueba gratis/i })
            .find(link => link.getAttribute('href') === '/signup')
        expect(signupButton).toBeInTheDocument()
        expect(signupButton).toHaveAttribute('href', '/signup')
    })

    it('renders benefits section', () => {
        render(<Home />)
        // Verificar que hay sección de beneficios con iconos y textos clave
        expect(screen.getByText(/agenda ordenada por recurso \/ prestador/i)).toBeInTheDocument()
    })

    it('renders FAQ section', () => {
        render(<Home />)
        expect(screen.getByText(/Preguntas frecuentes/i)).toBeInTheDocument()
    })
})
