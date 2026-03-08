import { ClaudeMessage, ClaudeResponse } from '@/types'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_VERSION = '2023-06-01'

export class ClaudeService {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not found - AI features will be disabled')
    }
  }

  async extractKeyword(messageText: string): Promise<string> {
    if (!this.apiKey) {
      // Fallback to simple keyword extraction
      return this.simpleKeywordExtraction(messageText)
    }

    try {
      const prompt = `Extract the single most relevant inventory search keyword from the customer message below. Return ONLY the keyword or short phrase, no explanation, no punctuation, no extra text.

Examples:
- Do you have Nike Air Max in size 9? -> Nike Air Max
- Is the iPhone 15 in stock? -> iPhone 15
- What red dresses do you have? -> red dress
- How many units of SKU-4821 are left? -> SKU-4821

Customer message: ${messageText}

Keyword:`

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_VERSION
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
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
      const keyword = data.content?.[0]?.text?.trim() || this.simpleKeywordExtraction(messageText)
      
      // Clean up the keyword
      return keyword.replace(/[^\w\s-]/g, '').trim()
    } catch (error) {
      console.error('Claude API error, falling back to simple extraction:', error)
      return this.simpleKeywordExtraction(messageText)
    }
  }

  private simpleKeywordExtraction(messageText: string): string {
    // Simple fallback keyword extraction
    const words = messageText.toLowerCase().split(/\s+/)
    
    // Common product indicators
    const productWords = ['iphone', 'nike', 'air', 'max', 'dress', 'shirt', 'shoes', 'sneakers', 'phone', 'laptop', 'tablet']
    
    // Find product-related words
    for (const word of words) {
      for (const productWord of productWords) {
        if (word.includes(productWord)) {
          return word
        }
      }
    }
    
    // Look for SKU patterns
    const skuMatch = messageText.match(/(?:sku|item|product)[\s-#]?([a-z0-9\-]+)/i)
    if (skuMatch) {
      return skuMatch[1]
    }
    
    // Return first meaningful word
    const meaningfulWords = words.filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'you', 'have', 'do', 'is', 'are', 'what', 'how', 'many'].includes(word))
    return meaningfulWords[0] || 'product'
  }

  private simpleResponseGeneration(
    customerName: string,
    messageText: string,
    inventoryResults: any[],
    conversationHistory: string
  ): string {
    // Simple fallback response generation
    if (inventoryResults.length === 0) {
      return `Hi ${customerName}! I couldn't find any items matching your request. Could you please provide more details or check the product name?`
    }

    if (inventoryResults.length === 1) {
      const item = inventoryResults[0]
      if (item.quantity === 0) {
        return `Hi ${customerName}! Unfortunately, ${item.name} is currently out of stock. Would you like me to notify you when it's available?`
      }
      return `Hi ${customerName}! Yes, we have ${item.name} in stock (${item.quantity} units available). The price is ${item.price}. Would you like to know more?`
    }

    const itemsList = inventoryResults
      .filter(item => item.quantity > 0)
      .slice(0, 3)
      .map(item => `${item.name} (${item.quantity} available)`)
      .join(', ')

    return `Hi ${customerName}! I found several items: ${itemsList}. Which one would you like to know more about?`
  }

  async generateResponse(
    customerName: string,
    messageText: string,
    inventoryResults: any[],
    conversationHistory: string
  ): Promise<string> {
    if (!this.apiKey) {
      // Fallback to simple response generation
      return this.simpleResponseGeneration(customerName, messageText, inventoryResults, conversationHistory)
    }

    try {
      const inventoryText = inventoryResults
        .map(item => `${item.name} | qty: ${item.quantity} | price: ${item.price} | sku: ${item.sku}`)
        .join(', ')

      const prompt = `You are a friendly customer support assistant for a retail business. You reply via WhatsApp.

Rules:
- Plain text only. No markdown, asterisks, bullet points or formatting
- Be concise and conversational
- Only use information from the inventory records below. Never invent stock levels, prices or product details
- If the item is not found or out of stock, say so politely
- Keep replies under 150 words

Customer name: ${customerName}
Customer message: ${messageText}
Inventory records: ${inventoryText || 'No matching items found'}

Response:`

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_VERSION
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 500,
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
      const aiResponse = data.content?.[0]?.text?.trim() || this.simpleResponseGeneration(customerName, messageText, inventoryResults, conversationHistory)
      
      return aiResponse
    } catch (error) {
      console.error('Claude API error, falling back to simple response:', error)
      return this.simpleResponseGeneration(customerName, messageText, inventoryResults, conversationHistory)
    }
  }

  private async makeClaudeRequest(prompt: string, maxTokens: number): Promise<ClaudeResponse> {
    if (!this.apiKey) {
      throw new Error('Claude API key is not available')
    }

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': CLAUDE_VERSION
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    return response.json()
  }
}

// Singleton instance
export const claudeService = new ClaudeService()
