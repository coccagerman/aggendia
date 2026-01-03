/**
 * Unit Tests - Business Service
 *
 * Tests de validaciones y lógica de negocio relacionadas con Business.
 */

import { describe, it, expect } from 'vitest'
import { validateCreateBusinessInput, generateSlug } from '@/domain/businesses/business.service'
import { AppError } from '@/domain/common/errors'

describe('Business Service', () => {
    describe('validateCreateBusinessInput', () => {
        it('accepts valid business data', () => {
            const validInput = {
                name: 'Mi Negocio',
                timezone: 'America/Argentina/Buenos_Aires'
            }

            expect(() => validateCreateBusinessInput(validInput)).not.toThrow()
        })

        it('throws error if name is empty', () => {
            const invalidInput = {
                name: '',
                timezone: 'America/Argentina/Buenos_Aires'
            }

            expect(() => validateCreateBusinessInput(invalidInput)).toThrow(AppError)
            expect(() => validateCreateBusinessInput(invalidInput)).toThrow(/nombre del negocio es requerido/i)
        })

        it('throws error if name is only whitespace', () => {
            const invalidInput = {
                name: '   ',
                timezone: 'America/Argentina/Buenos_Aires'
            }

            expect(() => validateCreateBusinessInput(invalidInput)).toThrow(AppError)
        })

        it('throws error if timezone is empty', () => {
            const invalidInput = {
                name: 'Mi Negocio',
                timezone: ''
            }

            expect(() => validateCreateBusinessInput(invalidInput)).toThrow(AppError)
            expect(() => validateCreateBusinessInput(invalidInput)).toThrow(/timezone es requerido/i)
        })

        it('accepts optional address and area fields', () => {
            const validInput = {
                name: 'Mi Negocio',
                timezone: 'America/Argentina/Buenos_Aires',
                address: 'Calle Falsa 123',
                area: 'CABA'
            }

            expect(() => validateCreateBusinessInput(validInput)).not.toThrow()
        })
    })

    describe('generateSlug', () => {
        it('converts name to lowercase slug', () => {
            expect(generateSlug('Mi Negocio')).toBe('mi-negocio')
        })

        it('replaces spaces with hyphens', () => {
            expect(generateSlug('Estudio de Yoga')).toBe('estudio-de-yoga')
        })

        it('removes special characters', () => {
            expect(generateSlug('Café & Bar!')).toBe('cafe-bar')
        })

        it('removes accents', () => {
            expect(generateSlug('Peluquería López')).toBe('peluqueria-lopez')
        })

        it('removes multiple consecutive hyphens', () => {
            expect(generateSlug('Negocio   Con   Espacios')).toBe('negocio-con-espacios')
        })

        it('trims hyphens from start and end', () => {
            expect(generateSlug('  Negocio  ')).toBe('negocio')
        })
    })
})
