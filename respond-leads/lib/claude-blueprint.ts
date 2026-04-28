import { ClaudeMessage, ClaudeResponse } from '@/types'
import { claudeResponseCache } from '@/lib/cache'

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_VERSION = '2023-06-01'

export class ClaudeBlueprintService {
  private apiKey: string | undefined

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY
    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not found - AI features will be disabled')
    }
  }

  // Blueprint: Keyword extraction prompt (exact match)
  async extractKeyword(messageText: string): Promise<string> {
    if (!this.apiKey) {
      return this.simpleKeywordExtraction(messageText)
    }

    const cacheKey = `keyword:${messageText.toLowerCase().trim()}`
    const cached = claudeResponseCache.get(cacheKey)
    if (cached && typeof cached === 'string') {
      return cached
    }

    try {
      const prompt = `Extract the single best product search keyword from the customer message below.
If the message is NOT about a specific product or inventory, return exactly: GENERAL

Rules:
- Return ONLY the keyword or the word GENERAL
- No punctuation, no explanation, no extra words
- Max 5 words

Examples:
- Do you have Nike Air Max in size 9? -> Nike Air Max
- Is the iPhone 15 in stock? -> iPhone 15
- What red dresses do you have? -> red dress
- How many units of SKU-4821 left? -> SKU-4821
- Hello, what are your store hours? -> GENERAL
- Hi! -> GENERAL
- Can I make a return? -> GENERAL
- What payment methods do you accept? -> GENERAL
- Thank you! -> GENERAL
- [empty] -> GENERAL

Customer message: ${messageText || '[empty]'}`

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_VERSION
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', // Blueprint: exact model specification
          max_tokens: 50, // Blueprint: exact token limit
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
      
      claudeResponseCache.set(cacheKey, keyword)
      return keyword
    } catch (error) {
      console.error('Claude API error, falling back to simple extraction:', error)
      return this.simpleKeywordExtraction(messageText)
    }
  }

  // Blueprint: Response generation prompt (exact match)
  async generateResponse(
    customerName: string,
    messageText: string,
    inventoryResults: any[],
    conversationHistory: string,
    searchKeyword: string
  ): Promise<string> {
    if (!this.apiKey) {
      return this.simpleResponseGeneration(customerName, messageText, inventoryResults, conversationHistory)
    }

    const cacheKey = `response:${messageText.toLowerCase().trim()}:${searchKeyword}:${inventoryResults.length}`
    const cached = claudeResponseCache.get(cacheKey)
    if (cached && typeof cached === 'string') {
      return cached
    }

    try {
      const inventoryText = this.formatInventoryResults(inventoryResults)
      const historyText = conversationHistory || 'No prior conversation — this is the first message.'

      const prompt = `You are a warm, helpful customer support assistant for a retail store. You are replying via WhatsApp.

STRICT FORMATTING RULES (WhatsApp renders markdown badly — never use it):
- Plain text only
- No asterisks, underscores, dashes, bullet points, or any symbols used for formatting
- No numbered lists
- Short paragraphs or single sentences only
- Your reply must be under 220 words

BEHAVIOUR RULES:
- Be conversational and friendly, not robotic or corporate
- Only state inventory facts that appear in the data below — never guess, invent, or estimate stock levels, prices, or product details
- If inventory results are empty, tell the customer you could not find that item and ask them to describe it differently or share the SKU
- If the search keyword was GENERAL or the message is not inventory-related (greetings, returns, hours, payments, complaints, etc.), respond helpfully and naturally from general knowledge
- Never mention Make, Supabase, Claude, AI, automation, or any internal tools or systems
- If the customer seems frustrated or upset, acknowledge their frustration warmly before answering
- Never make up a phone number, email, address, or policy — if you do not know, say so and offer to help find the right person

Customer name: ${customerName}
Customer message: ${messageText || '[Non-text message received]'}

Conversation history (most recent at bottom, may be empty for new customers):
${historyText}

Inventory search keyword used: ${searchKeyword}
Inventory results:
${inventoryText}

Write your WhatsApp reply now...`

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': CLAUDE_VERSION
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5', // Blueprint: exact model specification
          max_tokens: 300, // Blueprint: exact token limit
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
      
      claudeResponseCache.set(cacheKey, aiResponse)
      return aiResponse
    } catch (error) {
      console.error('Claude API error, falling back to simple response:', error)
      return this.simpleResponseGeneration(customerName, messageText, inventoryResults, conversationHistory)
    }
  }

  private formatInventoryResults(items: any[]): string {
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
    
    // Check for non-product queries
    const generalQueries = ['hello', 'hi', 'thanks', 'thank you', 'help', 'hours', 'return', 'payment', 'price', 'cost']
    for (const query of generalQueries) {
      if (messageText.toLowerCase().includes(query)) {
        return 'GENERAL'
      }
    }
    
    // Return first meaningful word
    const meaningfulWords = words.filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'you', 'have', 'do', 'is', 'are', 'what', 'how', 'many'].includes(word))
    return meaningfulWords[0] || 'GENERAL'
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
}

// Singleton instance
export const claudeBlueprintService = new ClaudeBlueprintService()
