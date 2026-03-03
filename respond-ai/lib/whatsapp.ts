const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN

// Send a text message via WhatsApp Business API
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      }
    )

    const data = await response.json()
    
    if (!response.ok) {
      console.error('WhatsApp API error:', data)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error)
    return false
  }
}

// Send a template message (for order confirmations etc)
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  components: Record<string, unknown>[]
): Promise<boolean> {
  try {
    const response = await fetch(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components,
          },
        }),
      }
    )

    const data = await response.json()
    return response.ok
  } catch (error) {
    console.error('Failed to send WhatsApp template:', error)
    return false
  }
}

// Mark message as read
export async function markMessageAsRead(messageId: string): Promise<void> {
  try {
    await fetch(`${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    })
  } catch (error) {
    console.error('Failed to mark message as read:', error)
  }
}

// Parse incoming WhatsApp webhook payload
export function parseWhatsAppWebhook(body: Record<string, unknown>) {
  try {
    const entry = (body.entry as Record<string, unknown>[])?.[0]
    const changes = (entry?.changes as Record<string, unknown>[])?.[0]
    const value = changes?.value as Record<string, unknown>

    const messages = value?.messages as Record<string, unknown>[]
    if (!messages || messages.length === 0) return null

    const message = messages[0] as Record<string, unknown>
    const from = message.from as string
    const messageId = message.id as string
    const type = message.type as string

    let text = ''
    if (type === 'text') {
      text = ((message.text as Record<string, unknown>)?.body as string) || ''
    } else if (type === 'interactive') {
      // Handle button replies
      const interactive = message.interactive as Record<string, unknown>
      text = ((interactive?.button_reply as Record<string, unknown>)?.title as string) || 
             ((interactive?.list_reply as Record<string, unknown>)?.title as string) || ''
    }

    if (!text || !from) return null

    return { from, messageId, text, type }
  } catch (error) {
    console.error('Failed to parse WhatsApp webhook:', error)
    return null
  }
}