import { WhatsAppWebhookPayload, WhatsAppMessage, WhatsAppContact } from '@/types'

export class WhatsAppV9Service {
  private phoneNumberId: string
  private accessToken: string
  private appSecret: string

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '1013623275168542'
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
      this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
      this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!
      this.appSecret = process.env.WHATSAPP_APP_SECRET!
    }
  }

  // V9 Blueprint: Enhanced phone normalization with better validation
  normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    let normalized = phoneNumber.replace(/\D/g, '')
    
    // Handle different country codes
    if (normalized.startsWith('94') && normalized.length === 11) {
      // Sri Lanka: +94 -> remove prefix
      normalized = normalized.substring(2)
    } else if (normalized.startsWith('1') && normalized.length === 11) {
      // US/Canada: +1 -> remove prefix
      normalized = normalized.substring(1)
    } else if (normalized.startsWith('44') && normalized.length === 12) {
      // UK: +44 -> remove prefix
      normalized = normalized.substring(2)
    }
    
    // Validate mobile number format (Sri Lanka: 7 digits starting with 7)
    if (normalized.length === 7 && normalized.startsWith('7')) {
      return normalized
    }
    
    return normalized
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

  // V9 Blueprint: Enhanced message sending with better error handling
  async sendMessage(to: string, message: string, replyToMessageId?: string): Promise<void> {
    this.ensureInitialized()
    
    const url = `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`
    
    // V9 Blueprint: Enhanced payload with better structure
    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: {
        body: message,
        preview_url: false // V9: Disable link previews for cleaner messages
      },
      ...(replyToMessageId && {
        context: {
          message_id: replyToMessageId
        }
      })
    }

    try {
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
      console.log('V9 WhatsApp message sent successfully:', data)
    } catch (error) {
      console.error('V9 WhatsApp send error:', error)
      throw error
    }
  }

  // V9 Blueprint: Enhanced webhook parsing with better validation
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
            // V9 Blueprint: Enhanced validation for text messages
            if (message.type === 'text' && message.text?.body) {
              // V9: Filter out empty or whitespace-only messages
              const trimmedBody = message.text.body.trim()
              if (trimmedBody.length > 0) {
                results.push({
                  message: {
                    ...message,
                    text: {
                      body: trimmedBody
                    }
                  },
                  contact: change.value.contacts?.[0]
                })
              }
            }
          }
        }
      }
    }

    return results
  }

  // V9 Blueprint: Enhanced customer name extraction with better fallbacks
  getCustomerName(contact?: WhatsAppContact): string {
    if (!contact?.profile?.name) return 'there'
    
    const name = contact.profile.name
    
    // Try different name fields in order of preference
    if (name.formatted_name) {
      return name.formatted_name
    } else if (name.first_name && name.last_name) {
      return `${name.first_name} ${name.last_name}`
    } else if (name.first_name) {
      return name.first_name
    } else if (name.last_name) {
      return name.last_name
    }
    
    return 'there'
  }

  // V9 Blueprint: Enhanced deduplication with better logic
  isMessageProcessed(messageId: string, lastMessageId?: string): boolean {
    // V9: More robust deduplication
    if (!lastMessageId) return false
    return messageId === lastMessageId
  }

  // V9 Blueprint: Enhanced conversation history management
  formatConversationHistory(existingHistory: string, customerMessage: string, assistantResponse: string): string {
    const timestamp = new Date().toISOString()
    const newEntry = `\n[Customer - ${timestamp}]: ${customerMessage}\n[Assistant - ${timestamp}]: ${assistantResponse}`
    
    // V9: Enhanced rolling window with better truncation
    const fullHistory = existingHistory + newEntry
    
    // Keep last 4000 characters as per blueprint
    if (fullHistory.length > 4000) {
      return fullHistory.slice(-4000).trim()
    }
    
    return fullHistory
  }

  // V9 Blueprint: Enhanced inventory search formatting
  formatInventoryResults(inventory: any[]): string {
    if (!inventory || inventory.length === 0) {
      return "No items found matching your search."
    }

    return inventory.map(item => {
      const name = item.name || 'Unknown Item'
      const quantity = item.quantity || 0
      const price = item.price || 'N/A'
      const sku = item.sku || 'N/A'
      
      // V9: Enhanced formatting with better readability
      return `${name} | Stock: ${quantity} units | Price: $${price} | SKU: ${sku}`
    }).join('\n')
  }
}

// Singleton instance
export const whatsappV9Service = new WhatsAppV9Service()
