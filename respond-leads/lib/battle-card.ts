import { getSupabaseClient } from './supabase'
import { logger } from './logger'

export interface BattleCard {
  leadSnapshot: string
  topSellingPoints: string[]
  objections: Array<{
    name: string
    why: string
    script: string
  }>
  closerTip: string
}

export interface BattleCardGenerationResult {
  success: boolean
  battleCard?: BattleCard
  rawContent?: string
  error?: string
}

export class BattleCardService {
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

  // V10 Blueprint: Generate battle card for sales closer
  async generateBattleCard(
    customerName: string,
    customerMessage: string,
    conversationHistory: string,
    searchKeyword: string,
    inventoryResults: any[]
  ): Promise<BattleCardGenerationResult> {
    this.ensureInitialized()

    try {
      // V10 Blueprint: Only generate battle card for product queries (not GENERAL)
      if (!searchKeyword || searchKeyword === 'GENERAL') {
        logger.ai('V10 Battle card skipped - keyword is GENERAL', { searchKeyword })
        return { success: false, error: 'Keyword is GENERAL, battle card not needed' }
      }

      // V10 Blueprint: Format inventory for battle card
      const inventoryText = this.formatInventoryForBattleCard(inventoryResults)

      const prompt = `You are a sales intelligence assistant. A lead just messaged our business on WhatsApp and our inventory system found matching products. Generate a concise closer battle card for our human sales rep. Plain text only — no markdown, no asterisks, no bullet dashes.

OUTPUT — use exactly this structure:

LEAD SNAPSHOT
[One sentence: who this person appears to be, what they want, any budget or timeline signals from their message or history. Be specific and direct.]

TOP 3 SELLING POINTS
1. [Lead with a concrete inventory fact — stock level, price, a specific attribute — tied directly to what the customer asked about.]
2. [Second point. Specific, not generic. Translate numbers into customer value where possible.]
3. [Third point. Frame around the customer's situation or implied concern.]

OBJECTION 1: [Name it in 5 words or fewer]
Why: [One sentence on the emotion or psychology driving this objection.]
Script: [Natural, warm — the way a real salesperson coaches a colleague before a call. Never start with 'I understand', 'Certainly', or 'Absolutely'. Start mid-thought.]

OBJECTION 2: [Name it in 5 words or fewer]
Why: [One sentence on what's really behind it.]
Script: [Same rules — human, direct, no corporate opener. Under 3 sentences.]

CLOSER TIP
[One tactical observation unique to this lead based on their message and history — something to watch for or lean into during the conversation.]

RULES:
- Never invent inventory data — only use what is provided
- Scripts must sound like a real person, not a sales training manual
- No asterisks, no dashes as bullets, no markdown of any kind
- Keep the whole card under 300 words
- Address the lead by name throughout if it is known

Customer name: ${customerName}
Customer message: ${customerMessage}
Conversation history: ${conversationHistory || 'No prior history — first contact.'}
Inventory search keyword: ${searchKeyword}

Inventory results:
${inventoryText}`

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 420,
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
      const rawContent = data.content[0]?.text?.trim() || ''

      if (!rawContent) {
        throw new Error('Empty battle card content received')
      }

      // Parse the battle card content
      const battleCard = this.parseBattleCardContent(rawContent)
      
      logger.ai('V10 Battle card generated successfully', { 
        customerName, 
        searchKeyword,
        contentLength: rawContent.length 
      })

      return {
        success: true,
        battleCard,
        rawContent
      }

    } catch (error) {
      logger.error('V10 Battle card generation failed', error as Error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // V10 Blueprint: Parse battle card content into structured format
  private parseBattleCardContent(content: string): BattleCard {
    const sections = content.split('\n\n')
    
    let leadSnapshot = ''
    const topSellingPoints: string[] = []
    const objections: Array<{ name: string; why: string; script: string }> = []
    let closerTip = ''

    let currentSection = ''
    let currentObjection: { name: string; why: string; script: string } | null = null

    for (const line of sections) {
      if (line.startsWith('LEAD SNAPSHOT')) {
        currentSection = 'leadSnapshot'
        leadSnapshot = line.replace('LEAD SNAPSHOT\n', '').trim()
      } else if (line.startsWith('TOP 3 SELLING POINTS')) {
        currentSection = 'sellingPoints'
      } else if (line.startsWith('OBJECTION')) {
        currentSection = 'objections'
        if (currentObjection) {
          objections.push(currentObjection)
        }
        const objectionName = line.replace('OBJECTION ', '').trim()
        currentObjection = { name: objectionName, why: '', script: '' }
      } else if (line.startsWith('Why:')) {
        if (currentObjection) {
          currentObjection.why = line.replace('Why: ', '').trim()
        }
      } else if (line.startsWith('Script:')) {
        if (currentObjection) {
          currentObjection.script = line.replace('Script: ', '').trim()
        }
      } else if (line.startsWith('CLOSER TIP')) {
        if (currentObjection) {
          objections.push(currentObjection)
          currentObjection = null
        }
        currentSection = 'closerTip'
        closerTip = line.replace('CLOSER TIP\n', '').trim()
      } else if (currentSection === 'sellingPoints' && line.match(/^\d+\./)) {
        topSellingPoints.push(line.replace(/^\d+\.\s*/, '').trim())
      }
    }

    // Add the last objection if exists
    if (currentObjection) {
      objections.push(currentObjection)
    }

    return {
      leadSnapshot,
      topSellingPoints,
      objections,
      closerTip
    }
  }

  // V10 Blueprint: Format inventory for battle card
  private formatInventoryForBattleCard(inventory: any[]): string {
    if (!inventory || inventory.length === 0) {
      return 'No inventory results found.'
    }

    return inventory.map(item => {
      const name = item.name || 'Unknown Item'
      const quantity = item.quantity || 0
      const price = item.price || 'N/A'
      const sku = item.sku || 'N/A'
      
      return `${name} | Stock: ${quantity} units | Price: $${price} | SKU: ${sku}`
    }).join('\n')
  }

  // V10 Blueprint: Send battle card to closer
  async sendBattleCardToCloser(
    battleCardContent: string,
    customerName: string,
    closerPhoneNumber: string
  ): Promise<boolean> {
    try {
      // This would integrate with WhatsApp service to send to closer
      // For now, we'll log it and store in database
      logger.whatsapp('V10 Battle card ready for closer', {
        customerName,
        closerPhoneNumber,
        contentLength: battleCardContent.length
      })

      // Store in database for tracking
      const supabase = getSupabaseClient()
      const { error } = await supabase
        .from('conversation_analytics')
        .insert({
          battle_card_generated: true,
          timestamp: new Date().toISOString(),
          blueprint_version: 'V10'
        })

      if (error) {
        logger.error('Failed to track battle card analytics', error)
      }

      return true
    } catch (error) {
      logger.error('V10 Failed to send battle card to closer', error as Error)
      return false
    }
  }

  // V10 Blueprint: Get store configuration from database
  async getStoreConfig(phoneNumber: string): Promise<Record<string, string>> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('conversations')
        .select('store_name, store_hours, store_location, store_contact, return_policy, shipping_info, payment_methods, additional_info')
        .eq('phone_number', phoneNumber)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return data || {
        store_name: '[Business Name]',
        store_hours: '[Business Hours]',
        store_location: '[Location]',
        store_contact: '[Contact]',
        return_policy: '[Return Policy]',
        shipping_info: '[Shipping Info]',
        payment_methods: '[Payment Methods]',
        additional_info: ''
      }
    } catch (error) {
      logger.error('Failed to get store config', error as Error)
      return {}
    }
  }
}

// Singleton instance
export const battleCardService = new BattleCardService()
