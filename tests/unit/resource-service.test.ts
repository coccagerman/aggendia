/**
 * Unit Tests - Resource Service
 *
 * Tests de validaciones de recursos.
 */

import { describe, it, expect } from 'vitest'
import { validateCreateResourceInput } from '@/domain/resources/resource.service'
import { AppError } from '@/domain/common/errors'

describe('Resource Service', () => {
    describe('validateCreateResourceInput', () => {
        it('accepts valid resource data', () => {
            const validInput = {
                name: 'Juan Pérez'
            }

            expect(() => validateCreateResourceInput(validInput)).not.toThrow()
        })

        it('throws error if name is empty', () => {
            const invalidInput = {
                name: ''
            }

            expect(() => validateCreateResourceInput(invalidInput)).toThrow(AppError)
            expect(() => validateCreateResourceInput(invalidInput)).toThrow(/nombre del recurso es requerido/i)
        })

        it('throws error if name is only whitespace', () => {
            const invalidInput = {
                name: '   '
            }

            expect(() => validateCreateResourceInput(invalidInput)).toThrow(AppError)
        })

        it('throws error if name is too long', () => {
            const invalidInput = {
                name: 'A'.repeat(101)
            }

            expect(() => validateCreateResourceInput(invalidInput)).toThrow(AppError)
            expect(() => validateCreateResourceInput(invalidInput)).toThrow(/100 caracteres/i)
        })

        it('trims whitespace from name', () => {
            const input = {
                name: '  Juan Pérez  '
            }

            // Should not throw
            expect(() => validateCreateResourceInput(input)).not.toThrow()
        })
    })
})
