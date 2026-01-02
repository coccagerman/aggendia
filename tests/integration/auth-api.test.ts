/**
 * Integration Tests - Auth API
 *
 * Tests que validan el flujo de autenticación (signup/login) contra Supabase local.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

describe('Auth API Integration', () => {
    let supabase: ReturnType<typeof createClient>
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'

    beforeAll(() => {
        supabase = createClient(supabaseUrl, supabaseAnonKey)
    })

    describe('Signup', () => {
        it('creates a new user successfully', async () => {
            const { data, error } = await supabase.auth.signUp({
                email: testEmail,
                password: testPassword
            })

            expect(error).toBeNull()
            expect(data.user).toBeDefined()
            expect(data.user?.email).toBe(testEmail)
        })

        it('fails with weak password', async () => {
            const { error } = await supabase.auth.signUp({
                email: `test-weak-${Date.now()}@example.com`,
                password: '123' // Too short
            })

            expect(error).toBeDefined()
        })

        it('fails with invalid email', async () => {
            const { error } = await supabase.auth.signUp({
                email: 'invalid-email',
                password: testPassword
            })

            expect(error).toBeDefined()
        })
    })

    describe('Login', () => {
        it('logs in with valid credentials', async () => {
            // First ensure user exists
            await supabase.auth.signUp({
                email: testEmail,
                password: testPassword
            })

            // Then try to login
            const { data, error } = await supabase.auth.signInWithPassword({
                email: testEmail,
                password: testPassword
            })

            expect(error).toBeNull()
            expect(data.user).toBeDefined()
            expect(data.session).toBeDefined()
            expect(data.session?.access_token).toBeDefined()
        })

        it('fails with wrong password', async () => {
            const { error } = await supabase.auth.signInWithPassword({
                email: testEmail,
                password: 'WrongPassword123!'
            })

            expect(error).toBeDefined()
        })

        it('fails with non-existent user', async () => {
            const { error } = await supabase.auth.signInWithPassword({
                email: 'nonexistent@example.com',
                password: testPassword
            })

            expect(error).toBeDefined()
        })
    })
})
