export interface CountryOption {
    code: string
    name: string
    flag: string
}

export const COUNTRY_OPTIONS: CountryOption[] = [
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'PE', name: 'Perú', flag: '🇵🇪' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: 'MX', name: 'México', flag: '🇲🇽' },
    { code: 'OT', name: 'Otros', flag: '🌎' }
]

const COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map(country => country.code))

export function normalizeCountryIso2(value: string | null | undefined): string | null {
    if (!value) {
        return null
    }

    const normalized = value.trim().toUpperCase()

    if (!/^[A-Z]{2}$/.test(normalized)) {
        return null
    }

    return normalized
}

export function isSupportedCountryIso2(value: string | null | undefined): boolean {
    const normalized = normalizeCountryIso2(value)
    if (!normalized) {
        return false
    }

    return COUNTRY_CODES.has(normalized)
}

export function inferCountryFromRequestHeaders(headers: Headers): string | null {
    const candidates = [
        headers.get('x-vercel-ip-country'),
        headers.get('cf-ipcountry'),
        headers.get('cloudfront-viewer-country')
    ]

    for (const candidate of candidates) {
        const normalized = normalizeCountryIso2(candidate)
        if (normalized) {
            return normalized
        }
    }

    const acceptLanguage = headers.get('accept-language')
    if (acceptLanguage) {
        const localeCandidate = acceptLanguage.split(',')[0]?.trim() ?? null
        const normalizedFromLocale = inferCountryFromLocale(localeCandidate)
        if (normalizedFromLocale) {
            return normalizedFromLocale
        }
    }

    return null
}

function inferCountryFromLocale(locale: string | null | undefined): string | null {
    if (!locale) {
        return null
    }

    const match = locale.match(/-([A-Za-z]{2})$/)
    if (!match) {
        return null
    }

    const normalized = normalizeCountryIso2(match[1])
    if (!normalized || !COUNTRY_CODES.has(normalized)) {
        return null
    }

    return normalized
}

function inferCountryFromTimeZone(timezone: string | null | undefined): string | null {
    if (!timezone) {
        return null
    }

    if (timezone.startsWith('America/Argentina')) {
        return 'AR'
    }

    if (timezone === 'America/Montevideo') {
        return 'UY'
    }

    if (timezone === 'America/Santiago') {
        return 'CL'
    }

    if (timezone === 'America/Sao_Paulo') {
        return 'BR'
    }

    if (timezone === 'America/Lima') {
        return 'PE'
    }

    if (timezone === 'America/Bogota') {
        return 'CO'
    }

    if (timezone === 'America/Mexico_City') {
        return 'MX'
    }

    return null
}

export function inferCountryFromBrowser(): string | null {
    if (typeof window === 'undefined') {
        return null
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const timezoneDetected = inferCountryFromTimeZone(timezone)
    if (timezoneDetected) {
        return timezoneDetected
    }

    const localeCandidates = [...(navigator.languages ?? []), navigator.language]

    for (const locale of localeCandidates) {
        const detected = inferCountryFromLocale(locale)
        if (detected) {
            return detected
        }
    }

    return null
}
