import { afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import { checkUserAccess } from '@/domain/subscriptions/subscription.service'

describe('Subscription access auto-trial - Integration', () => {
    const userId = `access-auto-trial-${Date.now()}`

    afterAll(async () => {
        await prisma.subscription.deleteMany({ where: { userId } })
    })

    it('creates a default trial and grants access when user has no subscription row', async () => {
        await prisma.subscription.deleteMany({ where: { userId } })

        const result = await checkUserAccess(prisma, userId)

        expect(result.allowed).toBe(true)
        expect(result.subscription).not.toBeNull()
        expect(result.subscription?.status).toBe('TRIALING')

        const persisted = await prisma.subscription.findUnique({ where: { userId } })
        expect(persisted).not.toBeNull()
        expect(persisted?.status).toBe('TRIALING')
    })
})
