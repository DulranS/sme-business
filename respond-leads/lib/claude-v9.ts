import { getSupabaseClient } from './supabase'
import { logger } from './logger'

export class ClaudeV9Service {
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || ''
    this.baseUrl = 'https://api.anthropic.com/v1/messages'
  }

  private ensureInitialized() {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }
  }

  // V9 Blueprint: Enhanced keyword extraction with better context understanding
  async extractKeyword(customerMessage: string, conversationHistory: string = ''): Promise<string> {
    this.ensureInitialized()

    try {
      const prompt = `Extract the single best product search keyword from the customer message below.
If the message is NOT about a specific product or inventory, return exactly: GENERAL

If the message uses a vague reference like it, that, this one, the same — look at the conversation history to resolve which product is being referred to and return that product name as the keyword.

Rules:
- Return ONLY the keyword or the word GENERAL
- No punctuation, no explanation, no extra words
- Max 5 words

Examples:
- Do you have Nike Air Max in size 9? -> Nike Air Max
- Is the iPhone 15 in stock? -> iPhone 15
- What red dresses do you have? -> red dress
- How many units of SKU-4821 left? -> SKU-4821
- History shows Nike Air Max discussed, customer says does it come in white -> Nike Air Max
- Hello, what are your store hours? -> GENERAL
- Hi! -> GENERAL
- Can I make a return? -> GENERAL
- What payment methods do you accept? -> GENERAL
- Thank you! -> GENERAL
- [empty] -> GENERAL

Conversation history:
${conversationHistory || 'No prior conversation.'}

Customer message: ${customerMessage || '[empty]'}`

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 50,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const keyword = data.content[0]?.text?.trim() || 'GENERAL'
      
      logger.ai('V9 Keyword extracted', { keyword, customerMessage: customerMessage.slice(0, 100) })
      return keyword

    } catch (error) {
      logger.error('V9 Keyword extraction failed', error as Error)
      return 'GENERAL'
    }
  }

  // V9 Blueprint: Enhanced response generation with store knowledge integration
  async generateResponse(
    customerName: string,
    customerMessage: string,
    inventoryResults: any[],
    conversationHistory: string,
    searchKeyword: string,
    storeKnowledge?: {
      storeName?: string
      storeHours?: string
      location?: string
      phone?: string
      email?: string
      returnPolicy?: string
      shipping?: string
      payment?: string
      sizing?: string
    }
  ): Promise<string> {
    this.ensureInitialized()

    try {
      // V9 Blueprint: Enhanced inventory formatting
      const inventoryText = this.formatInventoryForAI(inventoryResults)

      const prompt = `You are a warm, helpful customer support assistant for a retail store. You are replying via WhatsApp.

STORE KNOWLEDGE:
Store name: ${storeKnowledge?.storeName || '[YOUR STORE NAME]'}
Store hours: ${storeKnowledge?.storeHours || '[e.g. Mon-Sat 9am-6pm, closed Sundays]'}
Location: ${storeKnowledge?.location || '[e.g. 123 Main Street, Colombo 03]'}
Phone: ${storeKnowledge?.phone || '[e.g. +94 11 234 5678]'}
Email: ${storeKnowledge?.email || '[e.g. support@yourstore.com]'}
Return policy: ${storeKnowledge?.returnPolicy || '[e.g. Free returns within 30 days, item must be unworn, reply with order number to start]'}
Shipping: ${storeKnowledge?.shipping || '[e.g. Free over LKR 5000, standard 2-3 days, express same-day in Colombo]'}
Payment: ${storeKnowledge?.payment || '[e.g. Visa, Mastercard, cash on delivery, bank transfer]'}
Sizing: ${storeKnowledge?.sizing || '[e.g. Tops true to size, jeans run slim so size up if between sizes]'}

STRICT FORMATTING RULES (WhatsApp renders markdown badly — never use it):
- Plain text only
- No asterisks, underscores, dashes, bullet points, or any symbols used for formatting
- No numbered lists
- Short paragraphs or single sentences only
- Your reply must be under 220 words

BEHAVIOUR RULES:
- Be conversational and friendly, not robotic or corporate
- For stock levels, prices, SKUs: use inventory results only, never guess or invent
- For store policies, hours, returns, payment, shipping, sizing: use the store knowledge above
- If inventory results are empty, tell the customer you could not find that item and ask them to describe it differently or share the SKU
- If the search keyword was GENERAL or the message is not inventory-related, respond helpfully using store knowledge or general knowledge
- Never mention Make, Supabase, Claude, AI, automation, or any internal tools or systems
- If the customer seems frustrated or upset, acknowledge their frustration warmly before answering
- Never make up a phone number, email, address, or policy — if you do not know, say so

Customer name: ${customerName}
Customer message: ${customerMessage}
Search keyword: ${searchKeyword}

Inventory results:
${inventoryText}

Conversation history:
${conversationHistory || 'No prior conversation.'}`

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const aiResponse = data.content[0]?.text?.trim() || 'I apologize, but I had trouble processing your request. Could you please try again?'
      
      logger.ai('V9 Response generated', { 
        customerName, 
        responseLength: aiResponse.length,
        inventoryCount: inventoryResults.length 
      })
      
      return aiResponse

    } catch (error) {
      logger.error('V9 Response generation failed', error as Error)
      return 'I apologize, but I had trouble processing your request. Could you please try again?'
    }
  }

  // V9 Blueprint: Enhanced inventory formatting for AI
  private formatInventoryForAI(inventory: any[]): string {
    if (!inventory || inventory.length === 0) {
      return 'No items found matching your search.'
    }

    return inventory.map(item => {
      const name = item.name || 'Unknown Item'
      const quantity = item.quantity || 0
      const price = item.price || 'N/A'
      const sku = item.sku || 'N/A'
      
      return `${name} | Stock: ${quantity} units | Price: $${price} | SKU: ${sku}`
    }).join('\n')
  }

  // V9 Blueprint: Enhanced store knowledge management
  async getStoreKnowledge(): Promise<any> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data || {
        storeName: 'Your Store',
        storeHours: 'Mon-Sat 9am-6pm, closed Sundays',
        location: '123 Main Street, Colombo 03',
        phone: '+94 11 234 5678',
        email: 'support@yourstore.com',
        returnPolicy: 'Free returns within 30 days, item must be unworn',
        shipping: 'Free over LKR 5000, standard 2-3 days',
        payment: 'Visa, Mastercard, cash on delivery, bank transfer',
        sizing: 'Tops true to size, jeans run slim so size up if between sizes'
      }
    } catch (error) {
      logger.error('Failed to get store knowledge', error as Error)
      return null
    }
  }
}

// Singleton instance
export const claudeV9Service = new ClaudeV9Service()
