/**
 * Unit tests for service domain logic
 */

import { describe, it, expect } from 'vitest'
import {
    validateServiceDuration,
    validateBufferMinutes,
    validateCreateServiceInput,
    validateUpdateServiceInput
} from '@/domain/services/service.service'
import { AppError } from '@/domain/common/errors'

describe('Service Domain - validateServiceDuration', () => {
    it('acepta duraciones válidas múltiplos de 5', () => {
        expect(() => validateServiceDuration(15)).not.toThrow()
        expect(() => validateServiceDuration(30)).not.toThrow()
        expect(() => validateServiceDuration(60)).not.toThrow()
        expect(() => validateServiceDuration(120)).not.toThrow()
    })

    it('rechaza duración 0', () => {
        expect(() => validateServiceDuration(0)).toThrow(AppError)
        expect(() => validateServiceDuration(0)).toThrow('debe ser mayor a 0')
    })

    it('rechaza duraciones negativas', () => {
        expect(() => validateServiceDuration(-5)).toThrow(AppError)
        expect(() => validateServiceDuration(-10)).toThrow(AppError)
    })

    it('rechaza duraciones que no son múltiplos de 5', () => {
        expect(() => validateServiceDuration(17)).toThrow(AppError)
        expect(() => validateServiceDuration(22)).toThrow(AppError)
        expect(() => validateServiceDuration(33)).toThrow(AppError)
        expect(() => validateServiceDuration(1)).toThrow('múltiplo de 5')
    })
})

describe('Service Domain - validateBufferMinutes', () => {
    it('acepta buffer 0', () => {
        expect(() => validateBufferMinutes(0)).not.toThrow()
    })

    it('acepta buffer positivo', () => {
        expect(() => validateBufferMinutes(5)).not.toThrow()
        expect(() => validateBufferMinutes(10)).not.toThrow()
        expect(() => validateBufferMinutes(30)).not.toThrow()
    })

    it('rechaza buffer negativo', () => {
        expect(() => validateBufferMinutes(-1)).toThrow(AppError)
        expect(() => validateBufferMinutes(-10)).toThrow(AppError)
        expect(() => validateBufferMinutes(-5)).toThrow('no puede ser negativo')
    })
})

describe('Service Domain - validateCreateServiceInput', () => {
    it('acepta input válido mínimo', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Servicio Test',
                durationMinutes: 30
            })
        ).not.toThrow()
    })

    it('acepta input válido completo', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Servicio Test',
                description: 'Descripción del servicio',
                durationMinutes: 60,
                bufferMinutes: 10,
                priceCents: 5000,
                currency: 'ARS'
            })
        ).not.toThrow()
    })

    it('rechaza nombre vacío', () => {
        expect(() =>
            validateCreateServiceInput({
                name: '',
                durationMinutes: 30
            })
        ).toThrow('nombre del servicio es requerido')
    })

    it('rechaza nombre solo con espacios', () => {
        expect(() =>
            validateCreateServiceInput({
                name: '   ',
                durationMinutes: 30
            })
        ).toThrow('nombre del servicio es requerido')
    })

    it('rechaza nombre muy largo (>100 chars)', () => {
        const longName = 'a'.repeat(101)
        expect(() =>
            validateCreateServiceInput({
                name: longName,
                durationMinutes: 30
            })
        ).toThrow('no puede exceder 100 caracteres')
    })

    it('rechaza duración inválida', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 0
            })
        ).toThrow()
    })

    it('rechaza buffer negativo', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 30,
                bufferMinutes: -5
            })
        ).toThrow()
    })

    it('rechaza precio negativo', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 30,
                priceCents: -100
            })
        ).toThrow('precio no puede ser negativo')
    })

    it('acepta precio null o undefined', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 30,
                priceCents: null
            })
        ).not.toThrow()

        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 30
            })
        ).not.toThrow()
    })
})

describe('Service Domain - validateUpdateServiceInput', () => {
    it('acepta update parcial válido', () => {
        expect(() =>
            validateUpdateServiceInput({
                name: 'Nuevo nombre'
            })
        ).not.toThrow()

        expect(() =>
            validateUpdateServiceInput({
                durationMinutes: 45
            })
        ).not.toThrow()

        expect(() =>
            validateUpdateServiceInput({
                status: 'INACTIVE'
            })
        ).not.toThrow()
    })

    it('rechaza nombre vacío en update', () => {
        expect(() =>
            validateUpdateServiceInput({
                name: ''
            })
        ).toThrow('nombre del servicio es requerido')
    })

    it('rechaza duración inválida en update', () => {
        expect(() =>
            validateUpdateServiceInput({
                durationMinutes: 17
            })
        ).toThrow()
    })

    it('rechaza buffer negativo en update', () => {
        expect(() =>
            validateUpdateServiceInput({
                bufferMinutes: -10
            })
        ).toThrow()
    })

    it('rechaza precio negativo en update', () => {
        expect(() =>
            validateUpdateServiceInput({
                priceCents: -500
            })
        ).toThrow('precio no puede ser negativo')
    })
})
