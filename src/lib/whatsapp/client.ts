/**
 * WhatsApp Cloud API client
 * @see docs/user-stories.md - US-10.2
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Environment variables:
 * - WHATSAPP_ACCESS_TOKEN: Meta access token
 * - WHATSAPP_PHONE_NUMBER_ID: WhatsApp Business phone number ID
 *
 * All outbound messages use template messages (required by WhatsApp Business API
 * to initiate conversations). Each notification type maps to a template with a
 * single {{1}} body parameter that receives the full composed message text.
 */

// Environment configuration
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

/**
 * Template names for each notification type.
 * These must match the templates created in Meta Business Manager.
 * Each template has a single body parameter {{1}} that receives the full message.
 */
export const WHATSAPP_TEMPLATES = {
    CONFIRMATION: 'turnosapp_confirmation',
    CANCELLATION: 'turnosapp_cancellation',
    RESCHEDULED: 'turnosapp_rescheduled',
    REMINDER: 'turnosapp_reminder'
} as const

export type WhatsAppTemplateName = (typeof WHATSAPP_TEMPLATES)[keyof typeof WHATSAPP_TEMPLATES]

/** Language code for templates — es_AR for Argentine Spanish */
const WHATSAPP_TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG ?? 'es_AR'

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
 * Send a template message via WhatsApp Cloud API
 *
 * WhatsApp Business API requires template messages to initiate conversations.
 * Each template uses a single {{1}} body parameter with the full message text.
 *
 * @param to - Recipient phone in E.164 format (e.g., +5491155667788)
 * @param templateName - Name of the approved template in Meta Business Manager
 * @param bodyText - Full message text to send as the {{1}} parameter
 * @returns Result with success status and message ID or error
 */
export async function sendTemplateMessage(
    to: string,
    templateName: WhatsAppTemplateName,
    bodyText: string
): Promise<WhatsAppResult> {
    if (!isWhatsAppEnabled()) {
        return {
            success: false,
            error: 'WhatsApp sending is disabled (missing configuration)'
        }
    }

    const url = `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`

    // WhatsApp template parameters cannot contain newlines, tabs, or 4+ consecutive spaces
    const sanitizedText = bodyText
        .replace(/[\n\r\t]/g, ' ')
        .replace(/ {4,}/g, '   ')
        .trim()

    const payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''), // WhatsApp API expects number without +
        type: 'template',
        template: {
            name: templateName,
            language: { code: WHATSAPP_TEMPLATE_LANG },
            components: [
                {
                    type: 'body',
                    parameters: [{ type: 'text', text: sanitizedText }]
                }
            ]
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

        // TODO: REMOVE — temporary debug log
        console.debug('[WhatsApp DEBUG]', {
            to: payload.to,
            template: templateName,
            status: response.status,
            data: JSON.stringify(data)
        })

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
// Legacy: Text message (kept for potential future use within 24h windows)
// ============================================================================

/**
 * Send a text message via WhatsApp Cloud API
 *
 * NOTE: Text messages can only be sent within a 24h conversation window
 * (i.e., after the user messages first or after a template message is delivered).
 * For initiating conversations, use sendTemplateMessage instead.
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

    const url = `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`

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
