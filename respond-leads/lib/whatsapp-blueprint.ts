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

  // Blueprint: Filter text messages only - drop status updates, images, audio, etc.
  isTextMessage(message: WhatsAppMessage): boolean {
    return message.type === 'text' && !!message.text?.body
  }

  // Blueprint: Extract messages from webhook payload
  extractMessages(payload: WhatsAppWebhookPayload): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = []
    
    for (const entry of payload.entry) {
      if (entry.changes) {
        for (const change of entry.changes) {
          if (change.value.messages) {
            // Filter text messages only as per blueprint requirement
            const textMessages = change.value.messages.filter(msg => this.isTextMessage(msg))
            messages.push(...textMessages)
          }
        }
      }
    }
    
    return messages
  }

  // Blueprint: Extract contact information
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

  // Blueprint: Get phone number ID from environment or payload
  getPhoneNumberId(): string {
    this.ensureInitialized()
    return this.phoneNumberId
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
      const error = await response.text()
      throw new Error(`WhatsApp API error: ${response.status} ${error}`)
    }
    
    const result = await response.json()
    return result
  }

  // Blueprint: Parse webhook payload for processing
  parseWebhookPayload(body: any): { 
    messages: WhatsAppMessage[], 
    contacts: WhatsAppContact[],
    phoneNumberId: string 
  } {
    const payload: WhatsAppWebhookPayload = body
    
    const messages = this.extractMessages(payload)
    const contacts = this.extractContacts(payload)
    const phoneNumberId = this.getPhoneNumberId()
    
    return { messages, contacts, phoneNumberId }
  }

  // Blueprint: Check if message was already processed (deduplication)
  isMessageProcessed(messageId: string, lastMessageId?: string): boolean {
    return messageId === lastMessageId
  }

  // Blueprint: Format conversation history for AI prompt
  formatConversationHistory(history: string): string {
    if (!history || history.trim() === '') {
      return 'No prior conversation — this is the first message.'
    }
    return history
  }

  // Blueprint: Format inventory results for AI prompt
  formatInventoryResults(items: any[]): string {
    if (!items || items.length === 0) {
      return 'No inventory results found for this query.'
    }
    
    return items.map(item => {
      const name = item.name || 'Unknown item'
      const quantity = item.quantity || 0
      const price = item.price || 'N/A'
      const sku = item.sku || 'N/A'
      
      return `${name} | Stock: ${quantity} units | Price: $${price} | SKU: ${sku}`
    }).join('\n')
  }

  // Blueprint: Get customer name from contact or fallback
  getCustomerName(contact?: WhatsAppContact): string {
    return contact?.profile?.name || 'there'
  }
}

// Singleton instance
export const whatsappService = new WhatsAppService()
