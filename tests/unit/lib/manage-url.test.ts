/**
 * Unit tests for buildAppointmentManageUrl
 *
 * @see docs/user-stories.md - Épica 11
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildAppointmentManageUrl } from '@/lib/notifications/manage-url'

describe('buildAppointmentManageUrl', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('builds URL with NEXT_PUBLIC_APP_URL env var', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://turnosapp.com')

        const url = buildAppointmentManageUrl('my-biz', 'apt-123', 'token-abc')

        expect(url).toBe('https://turnosapp.com/b/my-biz/appointment/apt-123?token=token-abc')
    })

    it('builds relative URL when env var is empty', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', '')

        const url = buildAppointmentManageUrl('my-biz', 'apt-123', 'token-abc')

        expect(url).toBe('/b/my-biz/appointment/apt-123?token=token-abc')
    })

    it('builds relative URL when env var is undefined', () => {
        delete process.env.NEXT_PUBLIC_APP_URL

        const url = buildAppointmentManageUrl('my-biz', 'apt-123', 'token-abc')

        expect(url).toBe('/b/my-biz/appointment/apt-123?token=token-abc')
    })

    it('handles slug with special characters', () => {
        vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.test')

        const url = buildAppointmentManageUrl('test-salon-123', 'apt-id', 'tok-en')

        expect(url).toBe('https://app.test/b/test-salon-123/appointment/apt-id?token=tok-en')
    })
})
