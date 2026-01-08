/**
 * Domain service for slot calculation
 * Core algorithm to calculate available booking slots
 */

import { fromZonedTime, toZonedTime, format } from 'date-fns-tz'
import { addMinutes, startOfDay, isBefore, isAfter } from 'date-fns'
import { CalculateSlotsInput, SlotOutput, BlockInterval, AppointmentInterval } from './slots.types'

/**
 * Calculate available slots for a resource/service combination
 * Algorithm:
 * 1. Iterate each day in [fromDate, toDate] in business timezone
 * 2. For each day, get availability rules for that dayOfWeek
 * 3. Build time windows from availability rules (in business TZ)
 * 4. Subtract blocks (UTC intervals)
 * 5. Subtract appointments (UTC intervals)
 * 6. Generate discrete slots every slotIntervalMinutes
 * 7. Return slots with UTC timestamps + display time in business TZ
 */
export function calculateSlots(input: CalculateSlotsInput): SlotOutput[] {
    const {
        businessTimezone,
        fromDate,
        toDate,
        durationMinutes,
        slotIntervalMinutes,
        availabilityRules,
        blocks,
        appointments
    } = input

    const slots: SlotOutput[] = []

    // Convert range to business timezone to iterate day by day
    let currentDate = toZonedTime(fromDate, businessTimezone)
    const endDate = toZonedTime(toDate, businessTimezone)

    // Iterate each day
    while (
        isBefore(startOfDay(currentDate), startOfDay(endDate)) ||
        currentDate.getTime() === startOfDay(endDate).getTime()
    ) {
        const dayOfWeek = currentDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6

        // Get availability rules for this day
        const dayRules = availabilityRules.filter(rule => rule.dayOfWeek === dayOfWeek)

        if (dayRules.length === 0) {
            // No availability for this day, skip
            currentDate = addMinutes(startOfDay(currentDate), 1440) // +1 day
            continue
        }

        // Build time windows for this day in business timezone
        const dayStart = startOfDay(currentDate)

        for (const rule of dayRules) {
            // Build window from rule: dayStart + startMinutes to dayStart + endMinutes
            const windowStart = addMinutes(dayStart, rule.startMinutes)
            const windowEnd = addMinutes(dayStart, rule.endMinutes)

            // Convert to UTC for comparisons with blocks/appointments
            const windowStartUTC = fromZonedTime(windowStart, businessTimezone)
            const windowEndUTC = fromZonedTime(windowEnd, businessTimezone)

            // Subtract blocked intervals and appointments
            const freeIntervals = subtractIntervals({ start: windowStartUTC, end: windowEndUTC }, blocks, appointments)

            // Generate discrete slots from free intervals
            for (const interval of freeIntervals) {
                const intervalSlots = generateDiscreteSlots(
                    interval.start,
                    interval.end,
                    durationMinutes,
                    slotIntervalMinutes,
                    businessTimezone
                )
                slots.push(...intervalSlots)
            }
        }

        // Move to next day
        currentDate = addMinutes(startOfDay(currentDate), 1440) // +1 day
    }

    // Filter out slots that have already passed (race condition prevention)
    const now = new Date()
    return slots.filter(slot => new Date(slot.startAt) > now)
}

/**
 * Subtract blocks and appointments from a time window
 * Returns free intervals where slots can be placed
 */
function subtractIntervals(
    window: { start: Date; end: Date },
    blocks: BlockInterval[],
    appointments: AppointmentInterval[]
): { start: Date; end: Date }[] {
    // Combine all occupied intervals (blocks + appointments)
    const occupied: { start: Date; end: Date }[] = [
        ...blocks.map(b => ({ start: b.startAt, end: b.endAt })),
        ...appointments.map(a => ({ start: a.startAt, end: a.occupiedEndAt }))
    ]

    // Sort by start time
    occupied.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Merge overlapping intervals
    const merged: { start: Date; end: Date }[] = []
    for (const interval of occupied) {
        if (merged.length === 0) {
            merged.push(interval)
        } else {
            const last = merged[merged.length - 1]
            if (interval.start <= last.end) {
                // Overlapping or contiguous, merge
                last.end = interval.end > last.end ? interval.end : last.end
            } else {
                merged.push(interval)
            }
        }
    }

    // Subtract merged intervals from window
    const free: { start: Date; end: Date }[] = []
    let currentStart = window.start

    for (const occupied of merged) {
        // If occupied is completely before window, skip
        if (occupied.end <= window.start) continue
        // If occupied is completely after window, we're done
        if (occupied.start >= window.end) break

        // If there's free time before this occupied interval
        if (currentStart < occupied.start && occupied.start <= window.end) {
            free.push({ start: currentStart, end: occupied.start < window.end ? occupied.start : window.end })
        }

        // Move currentStart past the occupied interval
        currentStart = occupied.end > currentStart ? occupied.end : currentStart
    }

    // Add remaining free time after last occupied interval
    if (currentStart < window.end) {
        free.push({ start: currentStart, end: window.end })
    }

    return free
}

/**
 * Generate discrete slots from a free interval
 * Slots start every slotIntervalMinutes and must fit within the interval
 * The occupied range for each slot is [start, start + slotIntervalMinutes)
 */
function generateDiscreteSlots(
    intervalStart: Date,
    intervalEnd: Date,
    durationMinutes: number,
    slotIntervalMinutes: number,
    businessTimezone: string
): SlotOutput[] {
    const slots: SlotOutput[] = []

    let current = intervalStart

    while (true) {
        const slotEnd = addMinutes(current, durationMinutes)
        const occupiedEnd = addMinutes(current, slotIntervalMinutes)

        // Check if the occupied range fits in the interval
        if (isAfter(occupiedEnd, intervalEnd)) {
            break
        }

        // Convert to business timezone for display
        const displayDate = toZonedTime(current, businessTimezone)
        const displayTime = format(displayDate, 'HH:mm', { timeZone: businessTimezone })

        slots.push({
            startAt: current.toISOString(),
            endAt: slotEnd.toISOString(),
            displayTime
        })

        // Move to next slot (advance by slotIntervalMinutes)
        current = addMinutes(current, slotIntervalMinutes)
    }

    return slots
}
