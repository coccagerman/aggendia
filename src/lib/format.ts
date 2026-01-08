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
