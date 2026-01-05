import { describe, it, expect } from 'vitest'
import {
    validateBlockRange,
    validateNoOverlap,
    rangesOverlap,
    formatBlockDuration
} from '@/domain/blocks/block.service'
import { AppError, BlockErrorCodes } from '@/domain/common/errors'
import { ResourceBlock } from '@/domain/blocks/block.types'

describe('block.service', () => {
    describe('validateBlockRange', () => {
        it('should pass for valid range', () => {
            const startAt = new Date('2026-01-10T09:00:00Z')
            const endAt = new Date('2026-01-10T18:00:00Z')

            expect(() => validateBlockRange(startAt, endAt)).not.toThrow()
        })

        it('should throw BLOCK_INVALID_RANGE when startAt >= endAt', () => {
            const startAt = new Date('2026-01-10T18:00:00Z')
            const endAt = new Date('2026-01-10T09:00:00Z')

            expect(() => validateBlockRange(startAt, endAt)).toThrow(AppError)

            try {
                validateBlockRange(startAt, endAt)
            } catch (error) {
                expect(error).toBeInstanceOf(AppError)
                expect((error as AppError).code).toBe(BlockErrorCodes.BLOCK_INVALID_RANGE)
                expect((error as AppError).httpStatus).toBe(400)
            }
        })

        it('should throw BLOCK_INVALID_RANGE when startAt equals endAt', () => {
            const date = new Date('2026-01-10T09:00:00Z')

            expect(() => validateBlockRange(date, date)).toThrow(AppError)

            try {
                validateBlockRange(date, date)
            } catch (error) {
                expect((error as AppError).code).toBe(BlockErrorCodes.BLOCK_INVALID_RANGE)
            }
        })

        it('should throw BLOCK_RANGE_TOO_LONG for blocks longer than 365 days', () => {
            const startAt = new Date('2026-01-01T00:00:00Z')
            const endAt = new Date('2027-01-02T00:00:00Z') // 366 days

            expect(() => validateBlockRange(startAt, endAt)).toThrow(AppError)

            try {
                validateBlockRange(startAt, endAt)
            } catch (error) {
                expect((error as AppError).code).toBe(BlockErrorCodes.BLOCK_RANGE_TOO_LONG)
                expect((error as AppError).httpStatus).toBe(400)
            }
        })

        it('should pass for block exactly 365 days', () => {
            const startAt = new Date('2026-01-01T00:00:00Z')
            const endAt = new Date('2027-01-01T00:00:00Z') // exactly 365 days

            expect(() => validateBlockRange(startAt, endAt)).not.toThrow()
        })

        it('should pass for minimum 1 minute block', () => {
            const startAt = new Date('2026-01-10T09:00:00Z')
            const endAt = new Date('2026-01-10T09:01:00Z')

            expect(() => validateBlockRange(startAt, endAt)).not.toThrow()
        })
    })

    describe('rangesOverlap', () => {
        it('should return true for overlapping ranges', () => {
            // Block 1: 09:00 - 12:00
            // Block 2: 11:00 - 14:00
            const result = rangesOverlap(
                new Date('2026-01-10T09:00:00Z'),
                new Date('2026-01-10T12:00:00Z'),
                new Date('2026-01-10T11:00:00Z'),
                new Date('2026-01-10T14:00:00Z')
            )
            expect(result).toBe(true)
        })

        it('should return true when one range contains the other', () => {
            // Block 1: 09:00 - 18:00
            // Block 2: 10:00 - 12:00
            const result = rangesOverlap(
                new Date('2026-01-10T09:00:00Z'),
                new Date('2026-01-10T18:00:00Z'),
                new Date('2026-01-10T10:00:00Z'),
                new Date('2026-01-10T12:00:00Z')
            )
            expect(result).toBe(true)
        })

        it('should return false for non-overlapping ranges', () => {
            // Block 1: 09:00 - 12:00
            // Block 2: 14:00 - 18:00
            const result = rangesOverlap(
                new Date('2026-01-10T09:00:00Z'),
                new Date('2026-01-10T12:00:00Z'),
                new Date('2026-01-10T14:00:00Z'),
                new Date('2026-01-10T18:00:00Z')
            )
            expect(result).toBe(false)
        })

        it('should return false for contiguous ranges (one ends where other starts)', () => {
            // Block 1: 09:00 - 12:00
            // Block 2: 12:00 - 15:00
            const result = rangesOverlap(
                new Date('2026-01-10T09:00:00Z'),
                new Date('2026-01-10T12:00:00Z'),
                new Date('2026-01-10T12:00:00Z'),
                new Date('2026-01-10T15:00:00Z')
            )
            expect(result).toBe(false)
        })
    })

    describe('validateNoOverlap', () => {
        const existingBlocks: ResourceBlock[] = [
            {
                id: 'block-1',
                resourceId: 'resource-1',
                startAt: new Date('2026-01-10T09:00:00Z'),
                endAt: new Date('2026-01-10T12:00:00Z'),
                reason: 'Mantenimiento',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: 'block-2',
                resourceId: 'resource-1',
                startAt: new Date('2026-01-10T14:00:00Z'),
                endAt: new Date('2026-01-10T18:00:00Z'),
                reason: null,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]

        it('should pass when no overlap', () => {
            const startAt = new Date('2026-01-10T12:30:00Z')
            const endAt = new Date('2026-01-10T13:30:00Z')

            expect(() => validateNoOverlap(existingBlocks, startAt, endAt)).not.toThrow()
        })

        it('should throw BLOCK_OVERLAP when overlapping', () => {
            const startAt = new Date('2026-01-10T11:00:00Z')
            const endAt = new Date('2026-01-10T15:00:00Z')

            expect(() => validateNoOverlap(existingBlocks, startAt, endAt)).toThrow(AppError)

            try {
                validateNoOverlap(existingBlocks, startAt, endAt)
            } catch (error) {
                expect((error as AppError).code).toBe(BlockErrorCodes.BLOCK_OVERLAP)
                expect((error as AppError).httpStatus).toBe(409)
                expect((error as AppError).details?.existingBlockId).toBeDefined()
            }
        })

        it('should pass for contiguous blocks', () => {
            const startAt = new Date('2026-01-10T12:00:00Z')
            const endAt = new Date('2026-01-10T14:00:00Z')

            expect(() => validateNoOverlap(existingBlocks, startAt, endAt)).not.toThrow()
        })

        it('should exclude block by id when checking', () => {
            // Same range as block-1 but excluded
            const startAt = new Date('2026-01-10T09:00:00Z')
            const endAt = new Date('2026-01-10T12:00:00Z')

            expect(() => validateNoOverlap(existingBlocks, startAt, endAt, 'block-1')).not.toThrow()
        })
    })

    describe('formatBlockDuration', () => {
        it('should format minutes', () => {
            const result = formatBlockDuration(new Date('2026-01-10T09:00:00Z'), new Date('2026-01-10T09:30:00Z'))
            expect(result).toBe('30 min')
        })

        it('should format 1 hour', () => {
            const result = formatBlockDuration(new Date('2026-01-10T09:00:00Z'), new Date('2026-01-10T10:00:00Z'))
            expect(result).toBe('1 hora')
        })

        it('should format multiple hours', () => {
            const result = formatBlockDuration(new Date('2026-01-10T09:00:00Z'), new Date('2026-01-10T18:00:00Z'))
            expect(result).toBe('9 horas')
        })

        it('should format 1 day', () => {
            const result = formatBlockDuration(new Date('2026-01-10T09:00:00Z'), new Date('2026-01-11T09:00:00Z'))
            expect(result).toBe('1 día')
        })

        it('should format multiple days', () => {
            const result = formatBlockDuration(new Date('2026-01-10T09:00:00Z'), new Date('2026-01-15T09:00:00Z'))
            expect(result).toBe('5 días')
        })
    })
})
