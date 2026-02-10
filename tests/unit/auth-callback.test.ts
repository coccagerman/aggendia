/**
 * Unit Tests - Auth Callback Route Handler
 *
 * Verifica que el Route Handler /auth/callback:
 * - Redirige a /login con error si no hay code
 * - Redirige a /login con error si Google devuelve error
 * - Redirige a /login con error si el code exchange falla
 * - Redirige a /dashboard si el code exchange es exitoso
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock de createServerClient de @supabase/ssr
const mockExchangeCodeForSession = vi.fn()
vi.mock('@supabase/ssr', () => ({
    createServerClient: () => ({
        auth: {
            exchangeCodeForSession: mockExchangeCodeForSession
        }
    })
}))

// Importar después del mock
import { GET } from '@/app/auth/callback/route'

function buildRequest(url: string): NextRequest {
    return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /auth/callback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('redirige a /login con error cuando no hay code', async () => {
        const request = buildRequest('/auth/callback')

        const response = await GET(request)

        expect(response.status).toBe(307)
        const location = new URL(response.headers.get('location')!)
        expect(location.pathname).toBe('/login')
        expect(location.searchParams.get('error')).toContain('No se recibió')
    })

    it('redirige a /login con error cuando Google devuelve error param', async () => {
        const request = buildRequest('/auth/callback?error=access_denied&error_description=User+cancelled')

        const response = await GET(request)

        expect(response.status).toBe(307)
        const location = new URL(response.headers.get('location')!)
        expect(location.pathname).toBe('/login')
        expect(location.searchParams.get('error')).toContain('User cancelled')
        // No debe intentar exchange
        expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    })

    it('redirige a /login con error cuando el code exchange falla', async () => {
        mockExchangeCodeForSession.mockResolvedValue({
            error: { message: 'invalid code' }
        })

        const request = buildRequest('/auth/callback?code=invalid-code')

        const response = await GET(request)

        expect(response.status).toBe(307)
        const location = new URL(response.headers.get('location')!)
        expect(location.pathname).toBe('/login')
        expect(location.searchParams.get('error')).toContain('Error al completar la autenticación')
        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('invalid-code')
    })

    it('redirige a /dashboard cuando el code exchange es exitoso', async () => {
        mockExchangeCodeForSession.mockResolvedValue({ error: null })

        const request = buildRequest('/auth/callback?code=valid-code')

        const response = await GET(request)

        expect(response.status).toBe(307)
        const location = new URL(response.headers.get('location')!)
        expect(location.pathname).toBe('/dashboard')
        expect(location.searchParams.has('error')).toBe(false)
        expect(mockExchangeCodeForSession).toHaveBeenCalledWith('valid-code')
    })

    it('usa el error_description si está presente, sino el error code', async () => {
        const request = buildRequest('/auth/callback?error=server_error')

        const response = await GET(request)

        const location = new URL(response.headers.get('location')!)
        // Sin error_description, usa el error code
        expect(location.searchParams.get('error')).toBe('server_error')
    })
})
