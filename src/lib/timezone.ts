/**
 * Utility functions for timezone conversion.
 * Uses native Intl API to handle DST correctly without external libraries.
 */

/**
 * Gets the offset in minutes for an IANA timezone at a given date.
 * Uses Intl.DateTimeFormat to calculate the real offset considering DST.
 *
 * @param timezone - IANA timezone string (e.g., 'America/Argentina/Buenos_Aires')
 * @param date - Date to calculate offset for
 * @returns Offset in minutes (negative for west of UTC, positive for east)
 */
export function getTimezoneOffsetMinutes(timezone: string, date: Date): number {
    // Format the date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    })

    const parts = formatter.formatToParts(date)
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0'

    // Build a "local" date using the timezone values
    const tzYear = parseInt(getPart('year'))
    const tzMonth = parseInt(getPart('month')) - 1
    const tzDay = parseInt(getPart('day'))
    const tzHour = parseInt(getPart('hour'))
    const tzMinute = parseInt(getPart('minute'))
    const tzSecond = parseInt(getPart('second'))

    // Create UTC date with the TZ values
    const utcEquivalent = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond)

    // The difference is the offset (negated because we want UTC offset from local)
    // For UTC-3 (Argentina): local 09:00 = UTC 12:00, so offset = -180
    return (utcEquivalent - date.getTime()) / (1000 * 60)
}

/**
 * Converts date and time strings to ISO string, interpreting them in the business timezone.
 * Uses Intl to correctly handle DST without external libraries.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timeStr - Time string in HH:mm format
 * @param timezone - IANA timezone string (e.g., 'America/Argentina/Buenos_Aires')
 * @returns ISO 8601 string in UTC
 */
export function localInputToISO(dateStr: string, timeStr: string, timezone: string): string {
    // Parse input values (they represent time in the business TZ)
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hour, minute] = timeStr.split(':').map(Number)

    // Create an "approximate" date to calculate the TZ offset for that date
    // Use UTC to prevent the browser from applying its own TZ
    const approxDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))

    // Get the offset of the business TZ for that date
    const offsetMinutes = getTimezoneOffsetMinutes(timezone, approxDate)

    // Adjust: if business is in UTC-3, offsetMinutes will be -180
    // UTC time = local time - offset (offset already has correct sign)
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60 * 1000

    return new Date(utcMs).toISOString()
}

/**
 * Formats an ISO date string to a readable format in the business timezone.
 *
 * @param isoString - ISO 8601 date string
 * @param timezone - IANA timezone string
 * @returns Formatted date string in es-AR locale
 */
export function formatDateTimeInTimezone(isoString: string, timezone: string): string {
    const date = new Date(isoString)
    return date.toLocaleString('es-AR', {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

/**
 * Gets the start and end of a day in UTC, given a local date string and timezone.
 * Useful for querying appointments that fall within a specific day in the business timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - IANA timezone string (e.g., 'America/Argentina/Buenos_Aires')
 * @returns Object with start and end Date objects in UTC
 */
export function getDayRangeInUTC(dateStr: string, timezone: string): { start: Date; end: Date } {
    const [year, month, day] = dateStr.split('-').map(Number)

    // Create approximate dates for start (00:00) and end (23:59:59.999)
    const startApprox = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
    const endApprox = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999))

    // Get offsets for both start and end of day (may differ due to DST)
    const startOffset = getTimezoneOffsetMinutes(timezone, startApprox)
    const endOffset = getTimezoneOffsetMinutes(timezone, endApprox)

    // Calculate UTC times: local time - offset
    const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - startOffset * 60 * 1000)
    const endUTC = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - endOffset * 60 * 1000)

    return { start: startUTC, end: endUTC }
}

/**
 * Gets today's date string in YYYY-MM-DD format for a given timezone.
 *
 * @param timezone - IANA timezone string
 * @returns Date string in YYYY-MM-DD format
 */
export function getTodayInTimezone(timezone: string): string {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    })
    return formatter.format(now)
}

/**
 * Gets the day of week (0-6, where 0=Sunday) for a date string in a specific timezone.
 * Uses Intl API to correctly handle timezone differences.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param timezone - IANA timezone string
 * @returns Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 */
export function getWeekdayInTimezone(dateStr: string, timezone: string): number {
    const [year, month, day] = dateStr.split('-').map(Number)
    // Use UTC noon to avoid DST edge cases
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short'
    })
    const weekdayName = formatter.format(date)
    const weekdayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6
    }
    return weekdayMap[weekdayName] ?? 0
}

/**
 * Validates a date string is in YYYY-MM-DD format and represents a valid date.
 *
 * @param dateStr - Date string to validate
 * @returns True if valid, false otherwise
 */
export function isValidDateString(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return false
    }
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/**
 * Gets the Monday of the week containing the given date string.
 * Week starts on Monday (ISO 8601 convention).
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date string of Monday in YYYY-MM-DD format
 */
export function getWeekStartDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    // We want Monday as start, so: Mon=0, Tue=1, ..., Sun=6
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    date.setDate(date.getDate() - daysFromMonday)

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * Gets the first day of the month containing the given date string.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date string of the first day of the month in YYYY-MM-DD format
 */
export function getMonthStartDate(dateStr: string): string {
    const [year, month] = dateStr.split('-').map(Number)
    const m = String(month).padStart(2, '0')
    return `${year}-${m}-01`
}

/**
 * Gets the start and end of a week in UTC, given a date string and timezone.
 * Week is Monday to Sunday (7 days).
 *
 * @param dateStr - Date string in YYYY-MM-DD format (any day in the week)
 * @param timezone - IANA timezone string
 * @returns Object with start (Monday 00:00) and end (Sunday 23:59:59.999) Date objects in UTC
 */
export function getWeekRangeInUTC(dateStr: string, timezone: string): { start: Date; end: Date } {
    const mondayStr = getWeekStartDate(dateStr)
    const [year, month, day] = mondayStr.split('-').map(Number)

    // Monday 00:00:00 local time
    const startApprox = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
    const startOffset = getTimezoneOffsetMinutes(timezone, startApprox)
    const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - startOffset * 60 * 1000)

    // Sunday 23:59:59.999 = Monday + 7 days at 00:00:00 (exclusive)
    const endApprox = new Date(Date.UTC(year, month - 1, day + 7, 0, 0, 0))
    const endOffset = getTimezoneOffsetMinutes(timezone, endApprox)
    const endUTC = new Date(Date.UTC(year, month - 1, day + 7, 0, 0, 0) - endOffset * 60 * 1000)

    return { start: startUTC, end: endUTC }
}

/**
 * Gets the start and end of a month in UTC, given a date string and timezone.
 *
 * @param dateStr - Date string in YYYY-MM-DD format (any day in the month)
 * @param timezone - IANA timezone string
 * @returns Object with start (1st 00:00) and end (last day 23:59:59.999) Date objects in UTC
 */
export function getMonthRangeInUTC(dateStr: string, timezone: string): { start: Date; end: Date } {
    const [year, month] = dateStr.split('-').map(Number)

    // First day of month at 00:00:00 local time
    const startApprox = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
    const startOffset = getTimezoneOffsetMinutes(timezone, startApprox)
    const startUTC = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - startOffset * 60 * 1000)

    // First day of next month at 00:00:00 local time (exclusive end)
    const endApprox = new Date(Date.UTC(year, month, 1, 0, 0, 0))
    const endOffset = getTimezoneOffsetMinutes(timezone, endApprox)
    const endUTC = new Date(Date.UTC(year, month, 1, 0, 0, 0) - endOffset * 60 * 1000)

    return { start: startUTC, end: endUTC }
}

/**
 * Gets an array of date strings (YYYY-MM-DD) for each day in a week.
 *
 * @param dateStr - Date string in YYYY-MM-DD format (any day in the week)
 * @returns Array of 7 date strings from Monday to Sunday
 */
export function getWeekDays(dateStr: string): string[] {
    const mondayStr = getWeekStartDate(dateStr)
    const [year, month, day] = mondayStr.split('-').map(Number)
    const monday = new Date(year, month - 1, day)

    const days: string[] = []
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        days.push(`${y}-${m}-${dd}`)
    }
    return days
}

/**
 * Gets an array of date strings (YYYY-MM-DD) for each day in a month.
 *
 * @param dateStr - Date string in YYYY-MM-DD format (any day in the month)
 * @returns Array of date strings for all days in the month
 */
export function getMonthDays(dateStr: string): string[] {
    const [year, month] = dateStr.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()

    const days: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
        const m = String(month).padStart(2, '0')
        const dd = String(d).padStart(2, '0')
        days.push(`${year}-${m}-${dd}`)
    }
    return days
}

/**
 * Adds days to a date string.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
export function addDaysToDateString(dateStr: string, days: number): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + days)

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * Adds months to a date string.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param months - Number of months to add (can be negative)
 * @returns New date string in YYYY-MM-DD format (day clamped to last day of month if needed)
 */
export function addMonthsToDateString(dateStr: string, months: number): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1 + months, day)

    // Handle overflow (e.g., Jan 31 + 1 month = Feb 28/29)
    const expectedMonth = (month - 1 + months + 12 * 100) % 12
    if (date.getMonth() !== expectedMonth) {
        // Day overflowed to next month, clamp to last day of expected month
        date.setDate(0) // Set to last day of previous month
    }

    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}
