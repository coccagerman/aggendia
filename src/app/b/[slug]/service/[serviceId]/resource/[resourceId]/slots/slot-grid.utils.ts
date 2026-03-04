import { formatInTimeZone } from 'date-fns-tz'
import { es } from 'date-fns/locale'

type Slot = {
    startAt: string
    endAt: string
    displayTime: string
}

export function groupSlotsByBusinessDate(slots: Slot[], businessTimezone: string): Record<string, Slot[]> {
    return slots.reduce(
        (acc, slot) => {
            const dateKey = formatInTimeZone(new Date(slot.startAt), businessTimezone, 'yyyy-MM-dd')
            if (!acc[dateKey]) {
                acc[dateKey] = []
            }
            acc[dateKey].push(slot)
            return acc
        },
        {} as Record<string, Slot[]>
    )
}

export function getFirstAvailableDateKey(availableDateKeys: string[]): string | null {
    return availableDateKeys.length > 0 ? availableDateKeys[0] : null
}

export function getAdjacentDateKeys(
    availableDateKeys: string[],
    selectedDateKey: string
): {
    previousDateKey: string | null
    nextDateKey: string | null
} {
    const selectedIndex = availableDateKeys.indexOf(selectedDateKey)
    if (selectedIndex === -1) {
        return { previousDateKey: null, nextDateKey: null }
    }

    return {
        previousDateKey: selectedIndex > 0 ? availableDateKeys[selectedIndex - 1] : null,
        nextDateKey: selectedIndex < availableDateKeys.length - 1 ? availableDateKeys[selectedIndex + 1] : null
    }
}

export function getNextAvailableDateKey(
    availableDateKeys: string[],
    selectedDateKey: string,
    direction: 'previous' | 'next'
): string | null {
    const selectedIndex = availableDateKeys.indexOf(selectedDateKey)
    if (selectedIndex === -1) {
        return null
    }

    if (direction === 'previous') {
        return selectedIndex > 0 ? availableDateKeys[selectedIndex - 1] : null
    }

    return selectedIndex < availableDateKeys.length - 1 ? availableDateKeys[selectedIndex + 1] : null
}

export function getDateHeader(dateKey: string, businessTimezone: string): string {
    return formatInTimeZone(new Date(`${dateKey}T12:00:00.000Z`), businessTimezone, "EEEE d 'de' MMMM", {
        locale: es
    })
}

export function isDateInRange(date: Date, fromDate: Date, toDate: Date): boolean {
    const time = date.getTime()
    return time >= fromDate.getTime() && time < toDate.getTime()
}
