/**
 * Email template for trial expiring warning
 *
 * Sent at 7, 3, 1, and 0 days before trial expiration.
 */

export interface TrialExpiringEmailData {
    businessName: string
    ownerName?: string
    daysRemaining: number
    trialEndsAt: string
    subscribeUrl: string
}

/**
 * Render trial expiring warning email HTML
 */
export function renderTrialExpiringEmail(data: TrialExpiringEmailData): string {
    const greeting = data.ownerName ? `Hola ${escapeHtml(data.ownerName)}` : 'Hola'
    const urgency = getUrgencyText(data.daysRemaining)
    const ctaText = data.daysRemaining === 0 ? 'Activá tu plan ahora' : 'Elegir un plan'

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu prueba de Aggendia está por terminar</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #eaeaea;">
                            <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #f59e0b;">
                                ⏰ ${urgency}
                            </h1>
                            <p style="margin: 0; font-size: 16px; color: #666666;">
                                ${greeting}, tu período de prueba de <strong>${escapeHtml(data.businessName)}</strong> en Aggendia está por terminar.
                            </p>
                        </td>
                    </tr>

                    <!-- Info -->
                    <tr>
                        <td style="padding: 24px 32px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fffbeb; border-radius: 6px; border: 1px solid #fde68a;">
                                <tr>
                                    <td style="padding: 16px; text-align: center;">
                                        <p style="margin: 0; font-size: 14px; color: #92400e;">
                                            Tu prueba gratuita termina el <strong>${escapeHtml(data.trialEndsAt)}</strong>.
                                        </p>
                                        <p style="margin: 8px 0 0; font-size: 14px; color: #92400e;">
                                            Después de esa fecha no podrás acceder a tu agenda ni gestionar turnos.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                        <td style="padding: 0 32px 32px; text-align: center;">
                            <a href="${escapeHtml(data.subscribeUrl)}" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                                ${ctaText}
                            </a>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 16px 32px; text-align: center; border-top: 1px solid #eaeaea;">
                            <p style="margin: 0; font-size: 12px; color: #999999;">
                                Aggendia — Gestioná tus turnos sin complicaciones
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`
}

function getUrgencyText(daysRemaining: number): string {
    if (daysRemaining === 0) return 'Tu prueba termina hoy'
    if (daysRemaining === 1) return 'Tu prueba termina mañana'
    return `Tu prueba termina en ${daysRemaining} días`
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
