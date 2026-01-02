import { z } from 'zod'

/**
 * DTOs para endpoints de autenticación.
 * Validación centralizada de inputs.
 */

export const loginRequestSchema = z.object({
    email: z.string().email('El formato del email no es válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

export const signupRequestSchema = z
    .object({
        email: z.string().email('El formato del email no es válido'),
        password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
        confirmPassword: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
    })
    .refine(data => data.password === data.confirmPassword, {
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword']
    })

export type SignupRequest = z.infer<typeof signupRequestSchema>
