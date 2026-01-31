/**
 * Phone number utilities
 * @see docs/user-stories.md - US-10.2, US-10.6
 *
 * Handles phone number normalization to E.164 format for WhatsApp API.
 * E.164 format: +[country code][number] (e.g., +5491155667788)
 */

/**
 * Normalize a phone number to E.164 format for WhatsApp
 *
 * Expects phone with country code (e.g., +54 9 11 5566-7788)
 * Returns normalized format (e.g., +5491155667788) or null if invalid
 *
 * @param phone - Raw phone number input
 * @returns Normalized E.164 phone or null if cannot normalize
 */
export function normalizeToE164(phone: string | null | undefined): string | null {
    if (!phone || phone.trim() === '') return null

    // Remove all non-digit characters except leading +
    const hasPlus = phone.trim().startsWith('+')
    const digitsOnly = phone.replace(/\D/g, '')

    // Must have at least 8 digits (country code + number)
    if (digitsOnly.length < 8) return null

    // Must have at most 15 digits (E.164 max)
    if (digitsOnly.length > 15) return null

    // If original had +, use digits as-is
    // If not, we can't assume country code - return null
    if (!hasPlus) return null

    return `+${digitsOnly}`
}

/**
 * Check if a phone number appears to be valid for WhatsApp
 * Does NOT validate if the number actually exists
 *
 * @param phoneE164 - Phone in E.164 format
 * @returns true if format is valid
 */
export function isValidE164(phoneE164: string | null | undefined): boolean {
    if (!phoneE164) return false
    // E.164: + followed by 8-15 digits
    return /^\+\d{8,15}$/.test(phoneE164)
}
