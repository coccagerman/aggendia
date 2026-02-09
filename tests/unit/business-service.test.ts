/**
 * Unit Tests - Business Service
 *
 * Tests de validaciones y lógica de negocio relacionadas con Business.
 */

import { describe, it, expect } from 'vitest'
import {
    validateCreateBusinessInput,
    generateSlug,
    validateUpdateBusinessInput
} from '@/domain/businesses/business.service'
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

    describe('validateUpdateBusinessInput', () => {
        it('accepts valid update with name only', () => {
            expect(() => validateUpdateBusinessInput({ name: 'Nuevo Nombre' })).not.toThrow()
        })

        it('accepts valid update with timezone only', () => {
            expect(() => validateUpdateBusinessInput({ timezone: 'America/Lima' })).not.toThrow()
        })

        it('accepts valid update with address and area', () => {
            expect(() => validateUpdateBusinessInput({ address: 'Calle 123', area: 'CABA' })).not.toThrow()
        })

        it('accepts valid status change to ACTIVE', () => {
            expect(() => validateUpdateBusinessInput({ status: 'ACTIVE' })).not.toThrow()
        })

        it('accepts valid status change to INACTIVE', () => {
            expect(() => validateUpdateBusinessInput({ status: 'INACTIVE' })).not.toThrow()
        })

        it('throws error if name is empty', () => {
            expect(() => validateUpdateBusinessInput({ name: '' })).toThrow(AppError)
            expect(() => validateUpdateBusinessInput({ name: '' })).toThrow(/nombre del negocio es requerido/i)
        })

        it('throws error if name is only whitespace', () => {
            expect(() => validateUpdateBusinessInput({ name: '   ' })).toThrow(AppError)
        })

        it('throws error if name exceeds 100 characters', () => {
            const longName = 'a'.repeat(101)
            expect(() => validateUpdateBusinessInput({ name: longName })).toThrow(AppError)
            expect(() => validateUpdateBusinessInput({ name: longName })).toThrow(/exceder 100 caracteres/i)
        })

        it('throws error if timezone is empty', () => {
            expect(() => validateUpdateBusinessInput({ timezone: '' })).toThrow(AppError)
            expect(() => validateUpdateBusinessInput({ timezone: '' })).toThrow(/timezone es requerido/i)
        })

        it('throws error if status is DELETED', () => {
            expect(() => validateUpdateBusinessInput({ status: 'DELETED' })).toThrow(AppError)
            expect(() => validateUpdateBusinessInput({ status: 'DELETED' })).toThrow(
                /no se puede establecer el estado DELETED/i
            )
        })

        it('accepts empty input (no-op)', () => {
            expect(() => validateUpdateBusinessInput({})).not.toThrow()
        })
    })
})
