/**
 * Integration Tests - Block API
 *
 * Tests que validan la integración del repositorio de bloqueos con Prisma.
 * Los tests HTTP de endpoints están cubiertos por tests E2E con Playwright.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/data/prisma/prisma'
import {
    getBlocksByResourceId,
    getOverlappingBlocks,
    createBlock,
    deleteBlock,
    getBlockById,
    getBlockWithResource
} from '@/data/repositories/block.repo'

describe('Block Repository Integration', () => {
    let testBusinessId: string
    let testResourceId: string

    beforeAll(async () => {
        // Create a test business
        const business = await prisma.business.create({
            data: {
                name: 'Block Test Business',
                slug: `block-test-${Date.now()}`,
                timezone: 'America/Argentina/Buenos_Aires',
                resourceLabel: 'Recurso'
            }
        })
        testBusinessId = business.id

        // Create a test resource
        const resource = await prisma.resource.create({
            data: {
                businessId: testBusinessId,
                name: 'Block Test Resource',
                status: 'ACTIVE'
            }
        })
        testResourceId = resource.id
    })

    afterAll(async () => {
        // Clean up: delete test business (cascades to resource and blocks)
        await prisma.business.delete({
            where: { id: testBusinessId }
        })
        await prisma.$disconnect()
    })

    describe('createBlock', () => {
        it('should create a block successfully', async () => {
            const startAt = new Date('2026-02-01T09:00:00Z')
            const endAt = new Date('2026-02-01T12:00:00Z')

            const block = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt,
                endAt,
                reason: 'Test block'
            })

            expect(block.id).toBeDefined()
            expect(block.resourceId).toBe(testResourceId)
            expect(block.startAt).toEqual(startAt)
            expect(block.endAt).toEqual(endAt)
            expect(block.reason).toBe('Test block')

            // Cleanup
            await deleteBlock(prisma, block.id)
        })

        it('should create a block without reason', async () => {
            const block = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-02-02T09:00:00Z'),
                endAt: new Date('2026-02-02T12:00:00Z')
            })

            expect(block.reason).toBeNull()

            // Cleanup
            await deleteBlock(prisma, block.id)
        })
    })

    describe('getBlocksByResourceId', () => {
        it('should list blocks for a resource', async () => {
            // Create blocks
            const block1 = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-03-01T09:00:00Z'),
                endAt: new Date('2026-03-01T12:00:00Z')
            })
            const block2 = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-03-02T09:00:00Z'),
                endAt: new Date('2026-03-02T12:00:00Z')
            })

            const blocks = await getBlocksByResourceId(prisma, {
                resourceId: testResourceId
            })

            expect(blocks.length).toBeGreaterThanOrEqual(2)
            expect(blocks.some(b => b.id === block1.id)).toBe(true)
            expect(blocks.some(b => b.id === block2.id)).toBe(true)

            // Cleanup
            await deleteBlock(prisma, block1.id)
            await deleteBlock(prisma, block2.id)
        })

        it('should filter by date range', async () => {
            const block = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-04-15T09:00:00Z'),
                endAt: new Date('2026-04-15T12:00:00Z')
            })

            // Query with from filter that includes the block
            const blocksIncluded = await getBlocksByResourceId(prisma, {
                resourceId: testResourceId,
                from: new Date('2026-04-01T00:00:00Z')
            })
            expect(blocksIncluded.some(b => b.id === block.id)).toBe(true)

            // Query with from filter that excludes the block
            const blocksExcluded = await getBlocksByResourceId(prisma, {
                resourceId: testResourceId,
                from: new Date('2026-05-01T00:00:00Z')
            })
            expect(blocksExcluded.some(b => b.id === block.id)).toBe(false)

            // Cleanup
            await deleteBlock(prisma, block.id)
        })
    })

    describe('getOverlappingBlocks', () => {
        it('should find overlapping blocks', async () => {
            const block = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-05-10T09:00:00Z'),
                endAt: new Date('2026-05-10T12:00:00Z')
            })

            // Query that overlaps
            const overlapping = await getOverlappingBlocks(
                prisma,
                testResourceId,
                new Date('2026-05-10T10:00:00Z'),
                new Date('2026-05-10T14:00:00Z')
            )

            expect(overlapping.length).toBeGreaterThanOrEqual(1)
            expect(overlapping.some(b => b.id === block.id)).toBe(true)

            // Query that doesn't overlap
            const notOverlapping = await getOverlappingBlocks(
                prisma,
                testResourceId,
                new Date('2026-05-10T14:00:00Z'),
                new Date('2026-05-10T18:00:00Z')
            )

            expect(notOverlapping.some(b => b.id === block.id)).toBe(false)

            // Cleanup
            await deleteBlock(prisma, block.id)
        })
    })

    describe('getBlockById', () => {
        it('should return block by id', async () => {
            const created = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-06-01T09:00:00Z'),
                endAt: new Date('2026-06-01T12:00:00Z')
            })

            const found = await getBlockById(prisma, created.id)

            expect(found).not.toBeNull()
            expect(found?.id).toBe(created.id)

            // Cleanup
            await deleteBlock(prisma, created.id)
        })

        it('should return null for non-existent id', async () => {
            const found = await getBlockById(prisma, 'non-existent-id')
            expect(found).toBeNull()
        })
    })

    describe('getBlockWithResource', () => {
        it('should include business id from resource', async () => {
            const created = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-07-01T09:00:00Z'),
                endAt: new Date('2026-07-01T12:00:00Z')
            })

            const blockWithResource = await getBlockWithResource(prisma, created.id)

            expect(blockWithResource).not.toBeNull()
            expect(blockWithResource?.resource.businessId).toBe(testBusinessId)

            // Cleanup
            await deleteBlock(prisma, created.id)
        })
    })

    describe('deleteBlock', () => {
        it('should delete a block', async () => {
            const block = await createBlock(prisma, {
                resourceId: testResourceId,
                startAt: new Date('2026-08-01T09:00:00Z'),
                endAt: new Date('2026-08-01T12:00:00Z')
            })

            await deleteBlock(prisma, block.id)

            const found = await getBlockById(prisma, block.id)
            expect(found).toBeNull()
        })
    })
})
