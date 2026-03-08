import { WhatsAppWebhookPayload, WhatsAppMessage, WhatsAppContact } from '@/types'

export class WhatsAppService {
  private phoneNumberId: string
  private accessToken: string
  private appSecret: string

  constructor() {
    // Don't validate on construction - validate when methods are called
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || ''
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || ''
    this.appSecret = process.env.WHATSAPP_APP_SECRET || ''
  }

  private validateEnvironment() {
    const required = [
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_APP_SECRET',
      'WHATSAPP_VERIFY_TOKEN'
    ]

    const missing = required.filter(key => !process.env[key])
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  private ensureInitialized() {
    if (!this.phoneNumberId || !this.accessToken || !this.appSecret) {
      this.validateEnvironment()
      // Re-assign if validation passed
      this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
      this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!
      this.appSecret = process.env.WHATSAPP_APP_SECRET!
    }
  }

  verifyWebhookSignature(body: string, signature: string | null): boolean {
    if (!signature) return false
    
    this.ensureInitialized()
    
    const crypto = require('crypto')
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.appSecret)
      .update(body)
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  verifyWebhookChallenge(mode: string | null, token: string | null): string | null {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return token
    }
    return null
  }

  async sendMessage(to: string, message: string, replyToMessageId?: string): Promise<void> {
    this.ensureInitialized()
    
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`
    
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      text: {
        body: message
      },
      ...(replyToMessageId && {
        context: {
          message_id: replyToMessageId
        }
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`WhatsApp API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    console.log('WhatsApp message sent successfully:', data)
  }

  parseWebhookPayload(payload: WhatsAppWebhookPayload): Array<{
    message: WhatsAppMessage
    contact: WhatsAppContact | undefined
  }> {
    const results: Array<{
      message: WhatsAppMessage
      contact: WhatsAppContact | undefined
    }> = []

    if (payload.object !== 'whatsapp_business_account') {
      return results
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value.messages) {
          for (const message of change.value.messages) {
            if (message.type === 'text') {
              results.push({
                message,
                contact: change.value.contacts?.[0]
              })
            }
          }
        }
      }
    }

    return results
  }
}

// Singleton instance
export const whatsappService = new WhatsAppService()
