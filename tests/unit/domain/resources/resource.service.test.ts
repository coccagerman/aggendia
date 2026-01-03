/**
 * Unit tests for resource domain service
 */

import { describe, it, expect } from 'vitest'
import { validateCreateResourceInput, validateUpdateResourceInput } from '@/domain/resources/resource.service'
import { AppError } from '@/domain/common/errors'

describe('Resource Domain Service - Unit Tests', () => {
    describe('validateCreateResourceInput', () => {
        it('acepta nombre válido de 1 carácter', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'A'
                })
            ).not.toThrow()
        })

        it('acepta nombre válido de 100 caracteres', () => {
            const longName = 'a'.repeat(100)
            expect(() =>
                validateCreateResourceInput({
                    name: longName
                })
            ).not.toThrow()
        })

        it('acepta nombre con espacios y los preserva', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Recurso Test 1'
                })
            ).not.toThrow()
        })

        it('rechaza nombre vacío', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: ''
                })
            ).toThrow(AppError)
        })

        it('rechaza nombre solo con espacios', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: '   '
                })
            ).toThrow(AppError)
        })

        it('rechaza nombre que excede 100 caracteres', () => {
            const tooLongName = 'a'.repeat(101)
            expect(() =>
                validateCreateResourceInput({
                    name: tooLongName
                })
            ).toThrow(AppError)
        })

        it('acepta type null', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Test Resource',
                    type: null
                })
            ).not.toThrow()
        })

        it('acepta type PERSON', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Test Resource',
                    type: 'PERSON'
                })
            ).not.toThrow()
        })

        it('acepta type ASSET', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Test Resource',
                    type: 'ASSET'
                })
            ).not.toThrow()
        })

        it('acepta status ACTIVE', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Test Resource',
                    status: 'ACTIVE'
                })
            ).not.toThrow()
        })

        it('acepta status INACTIVE', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Test Resource',
                    status: 'INACTIVE'
                })
            ).not.toThrow()
        })

        it('acepta input completo con todos los campos', () => {
            expect(() =>
                validateCreateResourceInput({
                    name: 'Recurso Completo',
                    type: 'PERSON',
                    status: 'ACTIVE'
                })
            ).not.toThrow()
        })
    })

    describe('validateUpdateResourceInput', () => {
        it('acepta body vacío (sin cambios)', () => {
            expect(() => validateUpdateResourceInput({})).not.toThrow()
        })

        it('acepta nombre válido', () => {
            expect(() => validateUpdateResourceInput({ name: 'Nuevo Nombre' })).not.toThrow()
        })

        it('acepta nombre de 100 caracteres', () => {
            const longName = 'a'.repeat(100)
            expect(() => validateUpdateResourceInput({ name: longName })).not.toThrow()
        })

        it('rechaza nombre vacío', () => {
            expect(() => validateUpdateResourceInput({ name: '' })).toThrow(AppError)
        })

        it('rechaza nombre solo con espacios', () => {
            expect(() => validateUpdateResourceInput({ name: '   ' })).toThrow(AppError)
        })

        it('rechaza nombre que excede 100 caracteres', () => {
            const tooLongName = 'a'.repeat(101)
            expect(() => validateUpdateResourceInput({ name: tooLongName })).toThrow(AppError)
        })

        it('acepta status ACTIVE', () => {
            expect(() => validateUpdateResourceInput({ status: 'ACTIVE' })).not.toThrow()
        })

        it('acepta status INACTIVE', () => {
            expect(() => validateUpdateResourceInput({ status: 'INACTIVE' })).not.toThrow()
        })

        it('rechaza status DELETED', () => {
            expect(() => validateUpdateResourceInput({ status: 'DELETED' })).toThrow(AppError)
        })

        it('acepta type null', () => {
            expect(() => validateUpdateResourceInput({ type: null })).not.toThrow()
        })

        it('acepta type PERSON', () => {
            expect(() => validateUpdateResourceInput({ type: 'PERSON' })).not.toThrow()
        })

        it('acepta type ASSET', () => {
            expect(() => validateUpdateResourceInput({ type: 'ASSET' })).not.toThrow()
        })

        it('acepta múltiples campos a la vez', () => {
            expect(() =>
                validateUpdateResourceInput({
                    name: 'Nuevo Nombre',
                    type: 'PERSON',
                    status: 'INACTIVE'
                })
            ).not.toThrow()
        })
    })
})
