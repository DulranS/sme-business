// Database types matching Supabase schema
export interface InventoryItem {
  id?: number
  name: string
  sku: string
  quantity: number
  price: number
  currency: string
  price_usd: number
  created_at?: string
  updated_at?: string
}

export interface Conversation {
  id?: number
  phone_number: string
  customer_name: string
  history: string
  created_at?: string
  updated_at?: string
}

// Currency configuration
export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Record<string, Currency> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' }
}

// WhatsApp API types
export interface WhatsAppMessage {
  id: string
  from: string
  text: {
    body: string
  }
  timestamp: string
  type: string
}

export interface WhatsAppContact {
  profile: {
    name: string
  }
  wa_id: string
}

export interface WhatsAppWebhookEntry {
  id: string
  changes: Array<{
    field: string
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      messages?: WhatsAppMessage[]
      contacts?: WhatsAppContact[]
    }
  }>
}

export interface WhatsAppWebhookPayload {
  object: string
  entry: WhatsAppWebhookEntry[]
}

// AI/LLM types
export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeResponse {
  content: Array<{
    type: string
    text: string
  }>
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Conversation parsing
export interface ParsedMessage {
  role: 'customer' | 'assistant'
  text: string
}
