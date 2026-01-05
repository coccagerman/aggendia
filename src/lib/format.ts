/**
 * Formateo de valores para display.
 */

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
