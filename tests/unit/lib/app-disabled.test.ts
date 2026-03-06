import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAllowedPathWhenAppDisabled, isAppDisabledInProd } from '@/lib/app-disabled'

describe('app-disabled helpers', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('depends only on DISABLE_ENV=true', () => {
        vi.stubEnv('APP_ENV', 'dev')
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('VERCEL_ENV', 'preview')
        vi.stubEnv('DISABLE_ENV', 'true')
        expect(isAppDisabledInProd()).toBe(true)

        vi.stubEnv('DISABLE_ENV', 'false')
        expect(isAppDisabledInProd()).toBe(false)
    })

    it('accepts normalized true values', () => {
        vi.stubEnv('DISABLE_ENV', 'TRUE')
        expect(isAppDisabledInProd()).toBe(true)

        vi.stubEnv('DISABLE_ENV', '  true  ')
        expect(isAppDisabledInProd()).toBe(true)

        vi.stubEnv('DISABLE_ENV', '1')
        expect(isAppDisabledInProd()).toBe(true)
    })

    it('allows only public pages and system assets when app is disabled', () => {
        expect(isAllowedPathWhenAppDisabled('/')).toBe(true)
        expect(isAllowedPathWhenAppDisabled('/privacy')).toBe(true)
        expect(isAllowedPathWhenAppDisabled('/terms')).toBe(true)
        expect(isAllowedPathWhenAppDisabled('/maintenance')).toBe(true)
        expect(isAllowedPathWhenAppDisabled('/_next/static/chunks/app.js')).toBe(true)
        expect(isAllowedPathWhenAppDisabled('/favicon.ico')).toBe(true)

        expect(isAllowedPathWhenAppDisabled('/login')).toBe(false)
        expect(isAllowedPathWhenAppDisabled('/signup')).toBe(false)
        expect(isAllowedPathWhenAppDisabled('/dashboard')).toBe(false)
        expect(isAllowedPathWhenAppDisabled('/b/demo')).toBe(false)
    })
})
