/**
 * WhatsApp Cloud API client
 * @see docs/user-stories.md - US-10.2
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Environment variables:
 * - WHATSAPP_ACCESS_TOKEN: Meta access token
 * - WHATSAPP_PHONE_NUMBER_ID: WhatsApp Business phone number ID
 *
 * DEV/Sandbox: Uses text messages (allowed without approved templates)
 * PROD: Will use approved templates (not implemented in this US)
 */

// Environment configuration
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

if (!WHATSAPP_ACCESS_TOKEN) {
    console.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN not configured - WhatsApp sending will be disabled')
}

if (!WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[WhatsApp] WHATSAPP_PHONE_NUMBER_ID not configured - WhatsApp sending will be disabled')
}

/**
 * Check if WhatsApp sending is enabled
 * Returns false if required env vars are missing
 */
export function isWhatsAppEnabled(): boolean {
    return Boolean(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Result from WhatsApp API call
 */
export interface WhatsAppResult {
    success: boolean
    messageId?: string
    error?: string
}

/**
 * WhatsApp API error response structure
 */
interface WhatsAppApiError {
    error?: {
        message: string
        type: string
        code: number
        error_subcode?: number
        fbtrace_id?: string
    }
}

/**
 * WhatsApp API success response structure
 */
interface WhatsAppApiSuccess {
    messaging_product: string
    contacts: Array<{ input: string; wa_id: string }>
    messages: Array<{ id: string }>
}

/**
 * Send a text message via WhatsApp Cloud API
 *
 * Use for DEV/sandbox environment where templates are not required.
 * In production, use sendTemplateMessage instead (not yet implemented).
 *
 * @param to - Recipient phone in E.164 format (e.g., +5491155667788)
 * @param text - Message text content
 * @returns Result with success status and message ID or error
 */
export async function sendTextMessage(to: string, text: string): Promise<WhatsAppResult> {
    if (!isWhatsAppEnabled()) {
        return {
            success: false,
            error: 'WhatsApp sending is disabled (missing configuration)'
        }
    }

    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to.replace('+', ''), // WhatsApp API expects number without +
        type: 'text',
        text: {
            preview_url: false,
            body: text
        }
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = (await response.json()) as WhatsAppApiSuccess | WhatsAppApiError

        if (!response.ok) {
            const errorData = data as WhatsAppApiError
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`
            return {
                success: false,
                error: errorMessage
            }
        }

        const successData = data as WhatsAppApiSuccess
        const messageId = successData.messages?.[0]?.id

        return {
            success: true,
            messageId
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return {
            success: false,
            error: errorMessage
        }
    }
}

// ============================================================================
// Future: Template-based messages for production (US-10.2 scope excludes this)
// ============================================================================

/**
 * Template parameters for confirmation message
 * Prepared for future template implementation
 */
export interface ConfirmationTemplateParams {
    businessName: string
    serviceName: string
    resourceLabel: string
    resourceName: string
    dateTime: string
    timezone: string
}

/**
 * Send a template message via WhatsApp Cloud API
 *
 * NOT IMPLEMENTED - Placeholder for production use with approved templates.
 * Templates must be approved by Meta before use in production.
 *
 * @param to - Recipient phone in E.164 format
 * @param templateName - Name of the approved template
 * @param params - Template parameters
 * @returns Result with success status and message ID or error
 */
export async function sendTemplateMessage(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    to: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    templateName: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: ConfirmationTemplateParams
): Promise<WhatsAppResult> {
    // Not implemented - will be done when templates are approved
    return {
        success: false,
        error: 'Template messages not yet implemented'
    }
}
