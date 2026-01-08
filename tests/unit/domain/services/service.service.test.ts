/**
 * Unit tests for service domain logic
 */

import { describe, it, expect } from 'vitest'
import {
    validateServiceDuration,
    validateSlotIntervalMinutes,
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

describe('Service Domain - validateSlotIntervalMinutes', () => {
    it('acepta slotInterval igual a duración', () => {
        expect(() => validateSlotIntervalMinutes(30, 30)).not.toThrow()
        expect(() => validateSlotIntervalMinutes(60, 60)).not.toThrow()
    })

    it('acepta slotInterval mayor a duración', () => {
        expect(() => validateSlotIntervalMinutes(45, 30)).not.toThrow()
        expect(() => validateSlotIntervalMinutes(60, 30)).not.toThrow()
        expect(() => validateSlotIntervalMinutes(120, 60)).not.toThrow()
    })

    it('rechaza slotInterval menor a duración', () => {
        expect(() => validateSlotIntervalMinutes(30, 45)).toThrow(AppError)
        expect(() => validateSlotIntervalMinutes(30, 60)).toThrow('no puede ser menor que la duración')
    })

    it('rechaza slotInterval que no es múltiplo de 5', () => {
        expect(() => validateSlotIntervalMinutes(33, 30)).toThrow(AppError)
        expect(() => validateSlotIntervalMinutes(62, 60)).toThrow('múltiplo de 5')
    })
})

describe('Service Domain - validateCreateServiceInput', () => {
    it('acepta input válido mínimo (sin slotIntervalMinutes)', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Servicio Test',
                durationMinutes: 30
            })
        ).not.toThrow()
    })

    it('acepta input válido completo con slotIntervalMinutes', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Servicio Test',
                description: 'Descripción del servicio',
                durationMinutes: 60,
                slotIntervalMinutes: 75,
                priceCents: 5000,
                currency: 'ARS'
            })
        ).not.toThrow()
    })

    it('acepta slotIntervalMinutes igual a duración', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 30,
                slotIntervalMinutes: 30
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

    it('rechaza slotIntervalMinutes menor a duración', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 60,
                slotIntervalMinutes: 30
            })
        ).toThrow('no puede ser menor que la duración')
    })

    it('rechaza slotIntervalMinutes no múltiplo de 5', () => {
        expect(() =>
            validateCreateServiceInput({
                name: 'Test',
                durationMinutes: 30,
                slotIntervalMinutes: 37
            })
        ).toThrow('múltiplo de 5')
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

    it('valida slotIntervalMinutes con duración existente', () => {
        // Cuando se pasa existingDuration, valida slotInterval >= existingDuration
        expect(() =>
            validateUpdateServiceInput(
                { slotIntervalMinutes: 60 },
                30 // existingDuration
            )
        ).not.toThrow()

        expect(() =>
            validateUpdateServiceInput(
                { slotIntervalMinutes: 30 },
                60 // existingDuration
            )
        ).toThrow('no puede ser menor que la duración')
    })

    it('valida slotIntervalMinutes con nueva duración', () => {
        // Cuando se actualiza duración y slotInterval juntos
        expect(() =>
            validateUpdateServiceInput(
                { durationMinutes: 45, slotIntervalMinutes: 60 },
                30 // existingDuration (ignorada porque viene nueva)
            )
        ).not.toThrow()

        expect(() => validateUpdateServiceInput({ durationMinutes: 60, slotIntervalMinutes: 45 }, 30)).toThrow(
            'no puede ser menor que la duración'
        )
    })

    it('rechaza precio negativo en update', () => {
        expect(() =>
            validateUpdateServiceInput({
                priceCents: -500
            })
        ).toThrow('precio no puede ser negativo')
    })
})
