/**
 * Integration Tests - Business API
 *
 * Tests que validan los endpoints de creación y listado de negocios.
 *
 * Nota: Los tests HTTP están deshabilitados porque requieren Next.js corriendo.
 * Los tests E2E cubrirán estos flujos con Playwright.
 */

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

describe('Business API Integration', () => {
    describe('Supabase Auth Integration', () => {
        it('can create and authenticate users', async () => {
            const supabase = createClient(supabaseUrl, supabaseAnonKey)
            const testEmail = `integration-${Date.now()}@example.com`
            const testPassword = 'TestPassword123!'

            const { data: signupData, error: signupError } = await supabase.auth.signUp({
                email: testEmail,
                password: testPassword
            })

            expect(signupError).toBeNull()
            expect(signupData.user).toBeDefined()

            const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                email: testEmail,
                password: testPassword
            })

            expect(loginError).toBeNull()
            expect(loginData.session).toBeDefined()
            expect(loginData.session?.access_token).toBeDefined()
        })
    })

    // HTTP API tests are covered by E2E tests with Playwright
    // because they require Next.js server to be running
})
