/**
 * Email template for appointment rescheduled notification
 * @see docs/user-stories.md - US-10.4
 *
 * Generates plain HTML email with inline styles for maximum compatibility.
 * Template is a pure function: receives data, returns HTML string.
 */

export interface RescheduledEmailData {
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
    /** Formatted original date and time (e.g., "Lunes 15 de enero, 14:00") */
    originalFormattedDateTime: string
    /** Formatted new date and time (e.g., "Martes 16 de enero, 10:00") */
    newFormattedDateTime: string
    /** Business timezone display name (e.g., "Argentina") */
    timezone: string
    /** Business address (optional) */
    address?: string | null
}

/**
 * Render rescheduled email HTML
 * Uses inline styles for email client compatibility
 */
export function renderRescheduledEmail(data: RescheduledEmailData): string {
    const addressSection = data.address
        ? `
        <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Dirección</td>
            <td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${escapeHtml(data.address)}</td>
        </tr>
        `
        : ''

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Turno reprogramado</title>
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
                                🔄 Turno reprogramado
                            </h1>
                            <p style="margin: 0; font-size: 16px; color: #666666;">
                                Hola ${escapeHtml(data.customerName)}, tu turno ha sido reprogramado.
                            </p>
                        </td>
                    </tr>

                    <!-- Appointment details -->
                    <tr>
                        <td style="padding: 24px 32px;">
                            <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #333333; text-transform: uppercase; letter-spacing: 0.5px;">
                                Nueva fecha y hora
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
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Fecha anterior</td>
                                                <td style="padding: 8px 0; color: #999999; font-size: 14px; text-decoration: line-through; text-align: right;">${escapeHtml(data.originalFormattedDateTime)}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Nueva fecha</td>
                                                <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(data.newFormattedDateTime)}</td>
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
                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666666;">
                                Si necesitás cancelar o reprogramar nuevamente, contactá al negocio.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #999999;">
                                Este email fue enviado por Aggendia
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
export function renderRescheduledEmailText(data: RescheduledEmailData): string {
    const lines = [
        `🔄 TURNO REPROGRAMADO`,
        ``,
        `Hola ${data.customerName}, tu turno ha sido reprogramado.`,
        ``,
        `NUEVA FECHA Y HORA`,
        `─────────────────────────`,
        `Negocio: ${data.businessName}`,
        `Servicio: ${data.serviceName}`,
        `${data.resourceLabel}: ${data.resourceName}`,
        `Fecha anterior: ${data.originalFormattedDateTime}`,
        `Nueva fecha: ${data.newFormattedDateTime} ✓`,
        `Zona horaria: ${data.timezone}`
    ]

    if (data.address) {
        lines.push(`Dirección: ${data.address}`)
    }

    lines.push(
        ``,
        `─────────────────────────`,
        `Si necesitás cancelar o reprogramar nuevamente, contactá al negocio.`,
        ``,
        `Este email fue enviado por Aggendia`
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
