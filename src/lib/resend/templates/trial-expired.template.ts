/**
 * Email template for trial expired notification
 *
 * Sent once when the trial period has ended.
 */

export interface TrialExpiredEmailData {
    businessName: string
    ownerName?: string
    subscribeUrl: string
}

/**
 * Render trial expired email HTML
 */
export function renderTrialExpiredEmail(data: TrialExpiredEmailData): string {
    const greeting = data.ownerName ? `Hola ${escapeHtml(data.ownerName)}` : 'Hola'

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu prueba de TurnosApp terminó</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

                    <!-- Header -->
                    <tr>
                        <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #eaeaea;">
                            <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #dc2626;">
                                🔒 Tu período de prueba terminó
                            </h1>
                            <p style="margin: 0; font-size: 16px; color: #666666;">
                                ${greeting}, la prueba gratuita de <strong>${escapeHtml(data.businessName)}</strong> en TurnosApp ha expirado.
                            </p>
                        </td>
                    </tr>

                    <!-- Info -->
                    <tr>
                        <td style="padding: 24px 32px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef2f2; border-radius: 6px; border: 1px solid #fecaca;">
                                <tr>
                                    <td style="padding: 16px; text-align: center;">
                                        <p style="margin: 0; font-size: 14px; color: #991b1b;">
                                            Tu agenda, turnos y configuración no están accesibles en este momento.
                                        </p>
                                        <p style="margin: 8px 0 0; font-size: 14px; color: #991b1b;">
                                            Activá un plan para recuperar el acceso — no perdiste ningún dato.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- CTA -->
                    <tr>
                        <td style="padding: 0 32px 32px; text-align: center;">
                            <a href="${escapeHtml(data.subscribeUrl)}" style="display: inline-block; padding: 14px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                                Activar plan
                            </a>
                            <p style="margin: 12px 0 0; font-size: 13px; color: #999999;">
                                Tus datos están seguros. Podés activar un plan cuando quieras.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 16px 32px; text-align: center; border-top: 1px solid #eaeaea;">
                            <p style="margin: 0; font-size: 12px; color: #999999;">
                                TurnosApp — Gestioná tus turnos sin complicaciones
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

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
