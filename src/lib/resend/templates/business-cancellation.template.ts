/**
 * Email template for appointment cancellation sent to the business owner
 *
 * Tone: informative — the owner is notified that a booking was cancelled.
 */

export interface BusinessCancellationEmailData {
    businessName: string
    customerName: string
    customerEmail: string | null
    customerPhone: string | null
    serviceName: string
    resourceName: string
    resourceLabel: string
    formattedDateTime: string
    timezone: string
}

export function renderBusinessCancellationEmail(data: BusinessCancellationEmailData): string {
    const customerContact = data.customerEmail
        ? `<tr><td style="padding: 8px 0; color: #666666; font-size: 14px;">Email del cliente</td><td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${escapeHtml(data.customerEmail)}</td></tr>`
        : ''
    const customerPhone = data.customerPhone
        ? `<tr><td style="padding: 8px 0; color: #666666; font-size: 14px;">Teléfono del cliente</td><td style="padding: 8px 0; color: #333333; font-size: 14px; text-align: right;">${escapeHtml(data.customerPhone)}</td></tr>`
        : ''

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Turno cancelado</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                    <tr>
                        <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #eaeaea;">
                            <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #ef4444;">
                                ❌ Turno cancelado
                            </h1>
                            <p style="margin: 0; font-size: 16px; color: #666666;">
                                Se canceló un turno de ${escapeHtml(data.customerName)} en ${escapeHtml(data.businessName)}.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 32px;">
                            <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #333333; text-transform: uppercase; letter-spacing: 0.5px;">
                                Detalles del turno cancelado
                            </h2>
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border: 1px solid #eaeaea; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 16px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 8px 0; color: #666666; font-size: 14px;">Cliente</td>
                                                <td style="padding: 8px 0; color: #333333; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(data.customerName)}</td>
                                            </tr>
                                            ${customerContact}
                                            ${customerPhone}
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
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px 32px 32px 32px; text-align: center; border-top: 1px solid #eaeaea;">
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

export function renderBusinessCancellationEmailText(data: BusinessCancellationEmailData): string {
    const lines = [
        `❌ TURNO CANCELADO`,
        ``,
        `Se canceló un turno de ${data.customerName} en ${data.businessName}.`,
        ``,
        `DETALLES DEL TURNO CANCELADO`,
        `─────────────────────────`,
        `Cliente: ${data.customerName}`
    ]
    if (data.customerEmail) lines.push(`Email: ${data.customerEmail}`)
    if (data.customerPhone) lines.push(`Teléfono: ${data.customerPhone}`)
    lines.push(
        `Servicio: ${data.serviceName}`,
        `${data.resourceLabel}: ${data.resourceName}`,
        `Fecha y hora: ${data.formattedDateTime}`,
        `Zona horaria: ${data.timezone}`,
        ``,
        `─────────────────────────`,
        `Este email fue enviado por TurnosApp`
    )
    return lines.join('\n')
}

function escapeHtml(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
    return text.replace(/[&<>"']/g, char => map[char])
}
