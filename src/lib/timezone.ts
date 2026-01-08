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
