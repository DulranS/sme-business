import { ClaudeMessage, ClaudeResponse } from '@/types'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_VERSION = '2023-06-01'

export class ClaudeService {
  private apiKey: string

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required')
    }
    this.apiKey = process.env.ANTHROPIC_API_KEY
  }

  async extractKeyword(messageText: string): Promise<string> {
    const prompt = `Extract the single most relevant inventory search keyword from the customer message below. Return ONLY the keyword or short phrase, no explanation, no punctuation, no extra text.

Examples:
- Do you have Nike Air Max in size 9? -> Nike Air Max
- Is the iPhone 15 in stock? -> iPhone 15
- What red dresses do you have? -> red dress
- How many units of SKU-4821 are left? -> SKU-4821

Customer message: ${messageText}`

    const response = await this.makeClaudeRequest(prompt, 50)
    return response.content[0]?.text?.trim() || ''
  }

  async generateResponse(
    customerName: string,
    messageText: string,
    inventoryResults: any[],
    conversationHistory: string
  ): Promise<string> {
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

Previous conversation:
${conversationHistory}

Inventory results for ${inventoryResults.length > 0 ? 'items' : 'no items'}:
${inventoryText || 'No items found'}

Write your reply:`

    const response = await this.makeClaudeRequest(prompt, 500)
    return response.content[0]?.text || 'Sorry, I could not generate a response.'
  }

  private async makeClaudeRequest(prompt: string, maxTokens: number): Promise<ClaudeResponse> {
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
