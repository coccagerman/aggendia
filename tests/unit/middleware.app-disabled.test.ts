import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({
        auth: {
            getUser: vi.fn(async () => ({ data: { user: null } }))
        }
    }))
}))

import { middleware } from '../../middleware'

describe('middleware - app disabled in prod', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('redirects blocked pages to /maintenance', async () => {
        vi.stubEnv('APP_ENV', 'prod')
        vi.stubEnv('DISABLE_ENV', 'true')

        const request = new NextRequest('http://localhost/login')
        const response = await middleware(request)

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('http://localhost/maintenance')
    })

    it('returns 503 with APP_DISABLED for blocked APIs', async () => {
        vi.stubEnv('APP_ENV', 'prod')
        vi.stubEnv('DISABLE_ENV', 'true')

        const request = new NextRequest('http://localhost/api/v1/auth/login', {
            method: 'POST'
        })
        const response = await middleware(request)
        const body = await response.json()

        expect(response.status).toBe(503)
        expect(body.error.code).toBe('APP_DISABLED')
    })

    it('allows whitelisted public pages', async () => {
        vi.stubEnv('APP_ENV', 'prod')
        vi.stubEnv('DISABLE_ENV', 'true')

        const request = new NextRequest('http://localhost/privacy')
        const response = await middleware(request)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })
})
