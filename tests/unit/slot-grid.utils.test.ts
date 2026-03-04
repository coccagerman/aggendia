import { describe, it, expect } from 'vitest'
import {
    getAdjacentDateKeys,
    getDateHeader,
    getFirstAvailableDateKey,
    getNextAvailableDateKey,
    groupSlotsByBusinessDate,
    isDateInRange
} from '@/app/b/[slug]/service/[serviceId]/resource/[resourceId]/slots/slot-grid.utils'

describe('slot-grid utils', () => {
    it('groups slots by business date key', () => {
        const slots = [
            {
                startAt: '2026-03-05T12:00:00.000Z',
                endAt: '2026-03-05T12:45:00.000Z',
                displayTime: '09:00'
            },
            {
                startAt: '2026-03-06T12:00:00.000Z',
                endAt: '2026-03-06T12:45:00.000Z',
                displayTime: '09:00'
            }
        ]

        const grouped = groupSlotsByBusinessDate(slots, 'America/Argentina/Buenos_Aires')

        expect(Object.keys(grouped)).toEqual(['2026-03-05', '2026-03-06'])
        expect(grouped['2026-03-05']).toHaveLength(1)
        expect(grouped['2026-03-06']).toHaveLength(1)
    })

    it('returns first available date key', () => {
        expect(getFirstAvailableDateKey(['2026-03-05', '2026-03-06'])).toBe('2026-03-05')
        expect(getFirstAvailableDateKey([])).toBeNull()
    })

    it('resolves adjacent date keys', () => {
        const available = ['2026-03-05', '2026-03-06', '2026-03-09']

        expect(getAdjacentDateKeys(available, '2026-03-06')).toEqual({
            previousDateKey: '2026-03-05',
            nextDateKey: '2026-03-09'
        })

        expect(getAdjacentDateKeys(available, '2026-03-05')).toEqual({
            previousDateKey: null,
            nextDateKey: '2026-03-06'
        })
    })

    it('navigates to next/previous available date key', () => {
        const available = ['2026-03-05', '2026-03-06', '2026-03-09']

        expect(getNextAvailableDateKey(available, '2026-03-06', 'previous')).toBe('2026-03-05')
        expect(getNextAvailableDateKey(available, '2026-03-06', 'next')).toBe('2026-03-09')
        expect(getNextAvailableDateKey(available, '2026-03-05', 'previous')).toBeNull()
        expect(getNextAvailableDateKey(available, '2026-03-09', 'next')).toBeNull()
    })

    it('formats date header in spanish', () => {
        const label = getDateHeader('2026-03-05', 'America/Argentina/Buenos_Aires')
        expect(label).toMatch(/jueves\s+5\s+de\s+marzo/i)
    })

    it('checks range inclusion with exclusive toDate', () => {
        const fromDate = new Date('2026-03-04T00:00:00.000Z')
        const toDate = new Date('2026-04-03T00:00:00.000Z')

        expect(isDateInRange(new Date('2026-03-04T12:00:00.000Z'), fromDate, toDate)).toBe(true)
        expect(isDateInRange(new Date('2026-04-02T12:00:00.000Z'), fromDate, toDate)).toBe(true)
        expect(isDateInRange(new Date('2026-04-03T12:00:00.000Z'), fromDate, toDate)).toBe(false)
        expect(isDateInRange(new Date('2026-03-03T12:00:00.000Z'), fromDate, toDate)).toBe(false)
    })
})
