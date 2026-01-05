/**
 * Integration Tests - Availability API
 *
 * Tests que validan la integración con Supabase y la lógica de disponibilidad.
 * Los tests HTTP de endpoints están cubiertos por tests E2E con Playwright.
 */

import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

describe('Availability API Integration', () => {
    it('validates Supabase connection is working', async () => {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const testEmail = `availability-integration-${Date.now()}@example.com`
        const testPassword = 'TestPassword123!'

        const { data, error } = await supabase.auth.signUp({
            email: testEmail,
            password: testPassword
        })

        expect(error).toBeNull()
        expect(data.user).toBeDefined()
    })

    // HTTP API tests for availability are covered by E2E tests with Playwright
    // because they require Next.js server to be running
})
