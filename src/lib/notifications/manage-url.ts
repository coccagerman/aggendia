/**
 * Utility for building the appointment self-service (manage) URL.
 *
 * Uses NEXT_PUBLIC_APP_URL env var when available (server-side notifications),
 * falls back to relative path (client-side).
 *
 * @see docs/user-stories.md - Épica 11
 */

/**
 * Build the absolute URL for customer appointment self-service page.
 *
 * @param slug - Business slug
 * @param appointmentId - Appointment ID
 * @param secretToken - Appointment secret token
 * @returns Absolute URL string
 */
export function buildAppointmentManageUrl(slug: string, appointmentId: string, secretToken: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    return `${baseUrl}/b/${slug}/appointment/${appointmentId}?token=${secretToken}`
}
