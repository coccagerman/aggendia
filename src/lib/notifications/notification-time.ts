/**
 * Shared helpers for notification date/time formatting.
 * Keeps formatting consistent across reminders and transactional notifications.
 */

import { DateTime } from 'luxon'

export type NotificationDateTimeFormat = 'message' | 'reminder'

/**
 * Format date for notification display.
 * - message: "Lunes 15 de enero, 14:00"
 * - reminder: "Lunes 15 de enero, 14:00" (with localized format)
 */
export function formatDateTimeForNotification(
    date: Date,
    timezone: string,
    format: NotificationDateTimeFormat = 'message'
): string {
    try {
        const dt = DateTime.fromJSDate(date, { zone: timezone })

        if (format === 'reminder') {
            const formattedDate = dt.toLocaleString(
                {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                },
                { locale: 'es' }
            )

            const formattedTime = dt.toLocaleString(DateTime.TIME_24_SIMPLE, { locale: 'es' })

            const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)

            return `${capitalizedDate}, ${formattedTime}`
        }

        const localized = dt.setLocale('es')
        const weekday = localized.toFormat('cccc')
        const day = localized.toFormat('d')
        const month = localized.toFormat('LLLL')
        const time = localized.toFormat('HH:mm')

        return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} de ${month}, ${time}`
    } catch (error) {
        console.error('[Notification] Error formatting date', { date, timezone, error })
        return date.toISOString()
    }
}

/**
 * Get friendly timezone name
 */
export function getTimezoneDisplayName(timezone: string): string {
    const timezoneMap: Record<string, string> = {
        'America/Argentina/Buenos_Aires': 'Argentina',
        'America/Argentina/Cordoba': 'Argentina',
        'America/Argentina/Salta': 'Argentina',
        'America/Argentina/Tucuman': 'Argentina',
        'America/Buenos_Aires': 'Argentina',
        'America/Montevideo': 'Uruguay',
        'America/Santiago': 'Chile',
        'America/Sao_Paulo': 'Brasil',
        'America/Lima': 'Perú',
        'America/Bogota': 'Colombia',
        'America/Mexico_City': 'México',
        'America/New_York': 'Nueva York',
        'America/Los_Angeles': 'Los Ángeles',
        'Europe/Madrid': 'España',
        UTC: 'UTC'
    }

    return timezoneMap[timezone] || timezone
}
