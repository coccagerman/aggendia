/**
 * Formateo de valores para display.
 */

/**
 * Formats a time range from two Date objects in a specific timezone.
 * Output format: "HH:mm - HH:mm"
 *
 * @param startAt - Start Date object (UTC)
 * @param endAt - End Date object (UTC)
 * @param timezone - IANA timezone string
 * @returns Formatted time range string (e.g., "09:00 - 10:00")
 */
export function formatAppointmentTime(startAt: Date, endAt: Date, timezone: string): string {
    const formatTime = (date: Date) =>
        date.toLocaleTimeString('es-AR', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })

    return `${formatTime(startAt)} - ${formatTime(endAt)}`
}

/**
 * Formats a date to a readable day string in a specific timezone.
 * Output format: "Miércoles 8 de enero de 2026"
 *
 * @param date - Date object (UTC) or ISO string
 * @param timezone - IANA timezone string
 * @returns Formatted date string
 */
export function formatDateForAgenda(date: Date | string, timezone: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-AR', {
        timeZone: timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}

/**
 * Formats a week range for display.
 * Output format: "20 - 26 de enero de 2026" or "28 de enero - 3 de febrero de 2026"
 *
 * @param mondayStr - Monday date string in YYYY-MM-DD format
 * @param timezone - IANA timezone string
 * @returns Formatted week range string
 */
export function formatWeekRangeForAgenda(mondayStr: string, timezone: string): string {
    const [year, month, day] = mondayStr.split('-').map(Number)
    const monday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) // noon to avoid DST issues
    const sunday = new Date(Date.UTC(year, month - 1, day + 6, 12, 0, 0))

    const mondayMonth = monday.toLocaleDateString('es-AR', { timeZone: timezone, month: 'long' })
    const sundayMonth = sunday.toLocaleDateString('es-AR', { timeZone: timezone, month: 'long' })
    const mondayDay = monday.toLocaleDateString('es-AR', { timeZone: timezone, day: 'numeric' })
    const sundayDay = sunday.toLocaleDateString('es-AR', { timeZone: timezone, day: 'numeric' })
    const sundayYear = sunday.toLocaleDateString('es-AR', { timeZone: timezone, year: 'numeric' })

    if (mondayMonth === sundayMonth) {
        // Same month: "20 - 26 de enero de 2026"
        return `${mondayDay} - ${sundayDay} de ${mondayMonth} de ${sundayYear}`
    } else {
        // Different months: "28 de enero - 3 de febrero de 2026"
        return `${mondayDay} de ${mondayMonth} - ${sundayDay} de ${sundayMonth} de ${sundayYear}`
    }
}

/**
 * Formats a month for display.
 * Output format: "Enero 2026"
 *
 * @param dateStr - Date string in YYYY-MM-DD format (any day in the month)
 * @param timezone - IANA timezone string
 * @returns Formatted month string
 */
export function formatMonthForAgenda(dateStr: string, timezone: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)) // noon to avoid DST issues
    return date.toLocaleDateString('es-AR', {
        timeZone: timezone,
        month: 'long',
        year: 'numeric'
    })
}

/**
 * Formats a short date for week/month views.
 * Output format: "Lun 20" or "20/1"
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param format - 'weekday' for "Lun 20" or 'short' for "20/1"
 * @param timezone - IANA timezone string
 * @returns Formatted short date string
 */
export function formatShortDate(dateStr: string, format: 'weekday' | 'short', timezone: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

    if (format === 'weekday') {
        const weekday = date.toLocaleDateString('es-AR', { timeZone: timezone, weekday: 'short' })
        const dayNum = date.toLocaleDateString('es-AR', { timeZone: timezone, day: 'numeric' })
        // Capitalize first letter
        return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${dayNum}`
    } else {
        return date.toLocaleDateString('es-AR', { timeZone: timezone, day: 'numeric', month: 'numeric' })
    }
}

/**
 * Formatea un precio en centavos a string legible.
 *
 * @param priceCents - Precio en centavos (ej: 15050 para $150.50). Si es null, retorna texto alternativo.
 * @param currency - Código de moneda ISO 4217 (ej: "ARS", "USD"). Si es null y hay precio, solo muestra el monto.
 * @param locale - Locale para formateo (default: 'es-AR')
 * @returns String formateado (ej: "$1.500,50 ARS") o "Precio a confirmar" si no hay precio
 */
export function formatPrice(
    priceCents: number | null,
    currency: string | null = 'ARS',
    locale: string = 'es-AR'
): string {
    if (priceCents === null) {
        return 'Precio a confirmar'
    }

    const amount = priceCents / 100

    try {
        // Intentar formatear con Intl.NumberFormat
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency ?? 'ARS',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })

        const formatted = formatter.format(amount)

        // Agregar código de moneda al final si no está incluido visualmente
        // (Intl ya incluye el símbolo, agregamos el código para claridad)
        if (currency && !formatted.includes(currency)) {
            return `${formatted} ${currency}`
        }

        return formatted
    } catch {
        // Fallback si el currency code no es reconocido
        const fallbackFormatter = new Intl.NumberFormat(locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
        const formatted = fallbackFormatter.format(amount)
        return currency ? `$${formatted} ${currency}` : `$${formatted}`
    }
}
