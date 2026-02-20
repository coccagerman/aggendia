export interface CountryOption {
    code: string
    name: string
    flag: string
}

export type SupportedCountryIso2 = 'AR' | 'UY' | 'CL' | 'PE' | 'CO' | 'MX' | 'OT'

export const COUNTRY_OPTIONS: CountryOption[] = [
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
    { code: 'CL', name: 'Chile', flag: '🇨🇱' },
    { code: 'PE', name: 'Perú', flag: '🇵🇪' },
    { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
    { code: 'MX', name: 'México', flag: '🇲🇽' },
    { code: 'OT', name: 'Otros', flag: '🌎' }
]

export const COUNTRY_FIXED_TIMEZONE: Record<Exclude<SupportedCountryIso2, 'CL' | 'MX' | 'OT'>, string> = {
    AR: 'America/Argentina/Buenos_Aires',
    UY: 'America/Montevideo',
    PE: 'America/Lima',
    CO: 'America/Bogota'
}

const COUNTRY_MANUAL_TIMEZONE_OPTIONS: Record<'CL' | 'MX', string[]> = {
    CL: ['America/Santiago', 'Pacific/Easter'],
    MX: ['America/Mexico_City', 'America/Mazatlan', 'America/Hermosillo', 'America/Tijuana']
}

const COUNTRIES_REQUIRING_TIMEZONE_SELECTION = new Set<SupportedCountryIso2>(['CL', 'MX', 'OT'])

const COUNTRY_CODES = new Set(COUNTRY_OPTIONS.map(country => country.code))

export function countryRequiresTimezoneSelection(countryIso2: string | null | undefined): boolean {
    const normalized = normalizeCountryIso2(countryIso2)
    if (!normalized) {
        return false
    }

    return COUNTRIES_REQUIRING_TIMEZONE_SELECTION.has(normalized as SupportedCountryIso2)
}

export function inferTimezoneFromBrowser(): string | null {
    if (typeof window === 'undefined') {
        return null
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!timezone || !isValidIanaTimezone(timezone)) {
        return null
    }

    return timezone
}

export function getAllIanaTimezones(): string[] {
    const supportedValuesOf = Intl?.supportedValuesOf
    if (typeof supportedValuesOf !== 'function') {
        return ['UTC']
    }

    return supportedValuesOf('timeZone')
}

export function isValidIanaTimezone(value: string | null | undefined): boolean {
    if (!value) {
        return false
    }

    const allTimezones = getAllIanaTimezones()
    return allTimezones.includes(value)
}

export function getSelectableTimezonesForCountry(countryIso2: string | null | undefined): string[] {
    const normalized = normalizeCountryIso2(countryIso2)
    if (!normalized) {
        return []
    }

    if (normalized === 'OT') {
        return getAllIanaTimezones()
    }

    if (normalized === 'CL' || normalized === 'MX') {
        return COUNTRY_MANUAL_TIMEZONE_OPTIONS[normalized]
    }

    return []
}

export function inferCountryFromTimezoneSelection(timezone: string | null | undefined): SupportedCountryIso2 | null {
    if (!timezone) {
        return null
    }

    if (timezone.startsWith('America/Argentina') || timezone === 'America/Buenos_Aires') {
        return 'AR'
    }

    if (timezone === 'America/Montevideo') {
        return 'UY'
    }

    if (timezone === 'America/Lima') {
        return 'PE'
    }

    if (timezone === 'America/Bogota') {
        return 'CO'
    }

    if (timezone === 'America/Santiago' || timezone === 'Pacific/Easter') {
        return 'CL'
    }

    if (COUNTRY_MANUAL_TIMEZONE_OPTIONS.MX.includes(timezone)) {
        return 'MX'
    }

    return null
}

export function resolveTimezoneForCountry(
    countryIso2: string,
    selectedTimezone?: string | null
): { timezone: string | null; requiresManualSelection: boolean } {
    const normalized = normalizeCountryIso2(countryIso2)
    if (!normalized || !isSupportedCountryIso2(normalized)) {
        return { timezone: null, requiresManualSelection: false }
    }

    if (!countryRequiresTimezoneSelection(normalized)) {
        return {
            timezone: COUNTRY_FIXED_TIMEZONE[normalized as keyof typeof COUNTRY_FIXED_TIMEZONE],
            requiresManualSelection: false
        }
    }

    if (!selectedTimezone) {
        return { timezone: null, requiresManualSelection: true }
    }

    const allowedTimezones = getSelectableTimezonesForCountry(normalized)
    return {
        timezone: allowedTimezones.includes(selectedTimezone) ? selectedTimezone : null,
        requiresManualSelection: true
    }
}

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

    if (timezone.startsWith('America/Argentina') || timezone === 'America/Buenos_Aires') {
        return 'AR'
    }

    if (timezone === 'America/Montevideo') {
        return 'UY'
    }

    if (timezone === 'America/Santiago') {
        return 'CL'
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
