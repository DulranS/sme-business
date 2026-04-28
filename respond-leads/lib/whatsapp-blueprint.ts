import crypto from 'crypto'
import { Config } from '@/lib/config'
import { WhatsAppWebhookPayload, WhatsAppMessage, WhatsAppContact } from '@/types'

export class WhatsAppService {
  private phoneNumberId: string
  private accessToken: string
  private appSecret: string

  constructor() {
    const whatsappConfig = Config.whatsapp
    this.phoneNumberId = whatsappConfig.phoneNumberId
    this.accessToken = whatsappConfig.accessToken
    this.appSecret = whatsappConfig.appSecret
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
      this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
      this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!
      this.appSecret = process.env.WHATSAPP_APP_SECRET!
    }
  }

  private extractPhoneNumberId(payload: WhatsAppWebhookPayload): string | null {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const metadata = change.value.metadata
        if (metadata?.phone_number_id) {
          return metadata.phone_number_id
        }
      }
    }
    return null
  }

  isTextMessage(message: WhatsAppMessage): boolean {
    return message.type === 'text' && !!message.text?.body
  }

  extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = []

    for (const entry of payload.entry) {
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.value.messages) {
            const textMessages = change.value.messages.filter(msg => this.isTextMessage(msg))
            messages.push(...textMessages)
          }
        }
      }
    }

    return messages
  }

  extractContacts(payload: WhatsAppWebhookPayload): WhatsAppContact[] {
    const contacts: WhatsAppContact[] = []

    for (const entry of payload.entry) {
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.value.contacts) {
            contacts.push(...change.value.contacts)
          }
        }
      }
    }

    return contacts
  }

  getPhoneNumberId(): string {
    this.ensureInitialized()
    return this.phoneNumberId
  }

  verifyWebhookSignature(body: string, signature: string | null): boolean {
    if (!signature) return false

    this.ensureInitialized()

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.appSecret)
      .update(body)
      .digest('hex')

    const receivedBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)

    if (receivedBuffer.length !== expectedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  }

  verifyWebhookChallenge(mode: string | null, token: string | null): string | null {
    if (mode === 'subscribe' && token === Config.whatsapp.verifyToken) {
      return token
    }
    return null
  }

  async sendMessage(to: string, message: string, replyToMessageId?: string, whatsappPhoneNumberId?: string): Promise<void> {
    this.ensureInitialized()
    const senderId = whatsappPhoneNumberId || this.phoneNumberId
    const url = `${Config.whatsapp.apiUrl}/${senderId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      to: this.normalizePhoneNumber(to),
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
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`WhatsApp API error: ${response.status} ${errorText}`)
    }
  }

  parseWebhookPayload(body: unknown): {
    messages: WhatsAppMessage[]
    contacts: WhatsAppContact[]
    phoneNumberId: string | null
  } {
    if (!body || !Array.isArray(body.entry)) {
      throw new Error('Invalid WhatsApp webhook payload')
    }

    const payload: WhatsAppWebhookPayload = body
    const messages = this.extractMessages(payload)
    const contacts = this.extractContacts(payload)
    const phoneNumberId = this.extractPhoneNumberId(payload) || null
    return { messages, contacts, phoneNumberId }
  }

  isMessageProcessed(messageId: string, lastMessageId?: string): boolean {
    return !!lastMessageId && messageId === lastMessageId
  }

  formatConversationHistory(history: string): string {
    if (!history || history.trim() === '') {
      return 'No prior conversation — this is the first message.'
    }
    return history
  }

  formatInventoryResults(items: Array<{ name?: string; quantity?: number; price?: number | string; sku?: string }>): string {
    if (!items || items.length === 0) {
      return 'No inventory results found for this query.'
    }

    return items
      .map(item => {
        const name = item.name || 'Unknown item'
        const quantity = item.quantity ?? 0
        const price = item.price ?? 'N/A'
        const sku = item.sku || 'N/A'
        return `${name} | Stock: ${quantity} units | Price: $${price} | SKU: ${sku}`
      })
      .join('\n')
  }

  getCustomerName(contact?: WhatsAppContact): string {
    return contact?.profile?.name || 'there'
  }

  normalizePhoneNumber(raw: string): string {
    return raw.replace(/[^0-9]/g, '')
  }
}

export const whatsappService = new WhatsAppService()
