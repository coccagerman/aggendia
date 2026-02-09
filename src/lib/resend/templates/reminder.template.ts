/**
 * Email template for appointment reminder
 * @see docs/user-stories.md - US-8.3
 *
 * Generates plain HTML email with inline styles for maximum compatibility.
 * Template is a pure function: receives data, returns HTML string.
 */

export interface ReminderEmailData {
    /** Customer's full name */
    customerName: string
    /** Business name */
    businessName: string
    /** Service name */
    serviceName: string
    /** Resource name (e.g., "Cancha 1", "Dr. García") */
    resourceName: string
    /** Resource label (e.g., "Profesional", "Cancha") */
    resourceLabel: string
    /** Formatted date and time (e.g., "Lunes 15 de enero, 14:00") */
    formattedDateTime: string
    /** Business timezone display name (e.g., "Argentina") */
    timezone: string
    /** Business address (optional) */
    address?: string | null
    /** Reminder type: "24h" or "2h" */
    reminderType: '24h' | '2h'
    /** Self-service manage URL for cancel/reschedule (optional) */
    manageUrl?: string | null
}

/**
 * Get reminder header based on type
 */
function getReminderHeader(type: '24h' | '2h'): string {
    return type === '24h' ? 'Tu turno es mañana' : 'Tu turno es en 2 horas'
}

/**
 * Render reminder email HTML
 * Uses inline styles for email client compatibility
 */
export function renderReminderEmail(data: ReminderEmailData): string {
    const addressSection = data.address
        ? `
        <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Dirección</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${escapeHtml(data.address)}</td>
        </tr>
        `
        : ''

    const headerText = getReminderHeader(data.reminderType)

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recordatorio de turno</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #eaeaea;">
                            <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #f59e0b;">
                                🔔 ${headerText}
                            </h1>
                            <p style="margin: 0; font-size: 16px; color: #666666;">
                                Hola ${escapeHtml(data.customerName)}, te recordamos tu turno.
                            </p>
                        </td>
                    </tr>

                    <!-- Appointment details -->
                    <tr>
                        <td style="padding: 24px 32px;">
                            <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #333333; text-transform: uppercase; letter-spacing: 0.5px;">
                                Detalles del turno
                            </h2>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #eaeaea; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Negocio</td>
                                                <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(data.businessName)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Servicio</td>
                                                <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${escapeHtml(data.serviceName)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">${escapeHtml(data.resourceLabel)}</td>
                                                <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${escapeHtml(data.resourceName)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Fecha y hora</td>
                                                <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(data.formattedDateTime)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Zona horaria</td>
                                                <td style="padding: 8px 0; color: #999999; font-size: 12px; text-align: right;">${escapeHtml(data.timezone)}</td>
                                            </tr>
                                            ${addressSection}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 32px 32px 32px; text-align: center; border-top: 1px solid #eaeaea;">
                            ${
                                data.manageUrl
                                    ? `
                            <p style="margin: 0 0 16px 0;">
                                <a href="${escapeHtml(data.manageUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #333333; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
                                    Cancelar o reprogramar turno
                                </a>
                            </p>
                            `
                                    : `
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">
                                Si necesitás cancelar o reprogramar, contactá al negocio.
                            </p>
                            `
                            }
                            <p style="margin: 0; font-size: 12px; color: #999999;">
                                Este email fue enviado por TurnosApp
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`.trim()
}

/**
 * Generate plain text version for email clients that don't support HTML
 */
export function renderReminderEmailText(data: ReminderEmailData): string {
    const headerText = getReminderHeader(data.reminderType)

    const lines = [
        `🔔 ${headerText.toUpperCase()}`,
        ``,
        `Hola ${data.customerName}, te recordamos tu turno.`,
        ``,
        `DETALLES DEL TURNO`,
        `─────────────────────────`,
        `Negocio: ${data.businessName}`,
        `Servicio: ${data.serviceName}`,
        `${data.resourceLabel}: ${data.resourceName}`,
        `Fecha y hora: ${data.formattedDateTime}`,
        `Zona horaria: ${data.timezone}`
    ]

    if (data.address) {
        lines.push(`Dirección: ${data.address}`)
    }

    lines.push(
        ``,
        `─────────────────────────`,
        data.manageUrl
            ? `¿Necesitás cancelar o reprogramar? Ingresá aquí: ${data.manageUrl}`
            : `Si necesitás cancelar o reprogramar, contactá al negocio.`,
        ``,
        `Este email fue enviado por TurnosApp`
    )

    return lines.join('\n')
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, char => map[char])
}
