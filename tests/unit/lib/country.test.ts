import { describe, expect, it } from 'vitest'
import {
    countryRequiresTimezoneSelection,
    getSelectableTimezonesForCountry,
    inferCountryFromTimezoneSelection,
    resolveTimezoneForCountry
} from '@/lib/country'

describe('country timezone policy', () => {
    it('maps fixed timezone countries automatically', () => {
        expect(resolveTimezoneForCountry('AR').timezone).toBe('America/Argentina/Buenos_Aires')
        expect(resolveTimezoneForCountry('UY').timezone).toBe('America/Montevideo')
        expect(resolveTimezoneForCountry('PE').timezone).toBe('America/Lima')
        expect(resolveTimezoneForCountry('CO').timezone).toBe('America/Bogota')
    })

    it('requires timezone selection for CL, MX and OT', () => {
        expect(countryRequiresTimezoneSelection('CL')).toBe(true)
        expect(countryRequiresTimezoneSelection('MX')).toBe(true)
        expect(countryRequiresTimezoneSelection('OT')).toBe(true)
        expect(countryRequiresTimezoneSelection('AR')).toBe(false)
    })

    it('accepts only allowed CL and MX timezones', () => {
        expect(resolveTimezoneForCountry('CL', 'America/Santiago').timezone).toBe('America/Santiago')
        expect(resolveTimezoneForCountry('CL', 'America/Mexico_City').timezone).toBeNull()

        expect(resolveTimezoneForCountry('MX', 'America/Tijuana').timezone).toBe('America/Tijuana')
        expect(resolveTimezoneForCountry('MX', 'America/Bogota').timezone).toBeNull()
    })

    it('returns country-specific selectable options for CL and MX', () => {
        expect(getSelectableTimezonesForCountry('CL')).toEqual(['America/Santiago', 'Pacific/Easter'])
        expect(getSelectableTimezonesForCountry('MX')).toEqual([
            'America/Mexico_City',
            'America/Mazatlan',
            'America/Hermosillo',
            'America/Tijuana'
        ])
    })

    it('infers supported country from selected timezone', () => {
        expect(inferCountryFromTimezoneSelection('America/Argentina/Buenos_Aires')).toBe('AR')
        expect(inferCountryFromTimezoneSelection('America/Buenos_Aires')).toBe('AR')
        expect(inferCountryFromTimezoneSelection('America/Montevideo')).toBe('UY')
        expect(inferCountryFromTimezoneSelection('America/Santiago')).toBe('CL')
        expect(inferCountryFromTimezoneSelection('Pacific/Easter')).toBe('CL')
        expect(inferCountryFromTimezoneSelection('America/Tijuana')).toBe('MX')
        expect(inferCountryFromTimezoneSelection('Europe/Madrid')).toBeNull()
    })
})
