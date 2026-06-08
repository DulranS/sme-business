import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { whatsappV9Service } from '@/lib/whatsapp-v9'
import { claudeV9Service } from '@/lib/claude-v9'
import { battleCardService } from '@/lib/battle-card'
import { logger } from '@/lib/logger'
import { WhatsAppContact, WhatsAppMessage } from '@/types'

const supabase = createSupabaseServerClient()

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.webhook('V10 Webhook verified successfully', { mode, token })
    return new NextResponse(challenge || '', { status: 200 })
  }

  return NextResponse.json({ error: 'Invalid verification' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // V10 Blueprint: Enhanced webhook signature verification
    if (!whatsappV9Service.verifyWebhookSignature(body, signature)) {
      logger.warn('V10 Invalid WhatsApp webhook signature', { signature })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const parsedMessages = whatsappV9Service.parseWebhookPayload(payload)

    if (!parsedMessages.length) {
      logger.webhook('V10 Webhook payload contained no valid text messages', { payload })
      return NextResponse.json({ status: 'no_messages' })
    }

    // V10 Blueprint: Process each message with two-channel architecture
    for (const { message, contact } of parsedMessages) {
      await processV10WhatsAppMessage(message, contact)
    }

    return NextResponse.json({ status: 'processed' })
  } catch (error) {
    logger.error('V10 Webhook processing error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

// V10 Blueprint: Two-channel message processing
async function processV10WhatsAppMessage(message: WhatsAppMessage, contact: WhatsAppContact | undefined) {
  const rawPhoneNumber = message.from
  const normalizedPhone = whatsappV9Service.normalizePhoneNumber(rawPhoneNumber)
  const messageId = message.id
  const messageText = message.text?.body?.trim() || ''
  const customerName = whatsappV9Service.getCustomerName(contact)
  const startTime = Date.now()

  try {
    // V10 Blueprint: Module 9 - Enhanced conversation lookup
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      logger.database('V10 Failed to fetch conversation', { phoneNumber: normalizedPhone, error: fetchError })
      return
    }

    const conversation = conversations?.[0]
    const lastMessageId = conversation?.last_message_id
    const conversationHistory = conversation?.history || ''

    // V10 Blueprint: Module 8 - Enhanced deduplication check
    if (whatsappV9Service.isMessageProcessed(messageId, lastMessageId)) {
      logger.warn('V10 Duplicate message dropped', { messageId, phoneNumber: normalizedPhone, lastMessageId })
      return
    }

    // V10 Blueprint: Module 8 - Enhanced keyword extraction with conversation context
    const searchKeyword = await claudeV9Service.extractKeyword(messageText, conversationHistory)
    logger.ai('V10 Extracted inventory keyword', { searchKeyword, messageText: messageText.slice(0, 100) })

    // V10 Blueprint: Module 1 - Enhanced inventory search
    const inventoryResults = await searchV10Inventory(searchKeyword)
    
    // V10 Blueprint: Get store config from database
    const storeConfig = await battleCardService.getStoreConfig(normalizedPhone)

    // V10 Blueprint: TWO-CHANNEL ARCHITECTURE - Run in parallel
    // Channel A: Customer-facing reply (Module 2)
    // Channel B: Battle card generation (Module 11)
    const [customerReply, battleCardResult] = await Promise.allSettled([
      claudeV9Service.generateResponse(
        customerName,
        messageText,
        inventoryResults,
        conversationHistory,
        searchKeyword,
        storeConfig
      ),
      // V10 Blueprint: Only generate battle card for product queries
      searchKeyword !== 'GENERAL' 
        ? battleCardService.generateBattleCard(
            customerName,
            messageText,
            conversationHistory,
            searchKeyword,
            inventoryResults
          )
        : Promise.resolve({ success: false, error: 'Keyword is GENERAL' })
    ])

    const aiResponse = customerReply.status === 'fulfilled' ? customerReply.value : 'I apologize, but I had trouble processing your request. Could you please try again?'
    const battleCard = battleCardResult.status === 'fulfilled' && battleCardResult.value.success ? (battleCardResult.value as any).battleCard : null

    // V10 Blueprint: Module 6 - Send customer reply
    await whatsappV9Service.sendMessage(normalizedPhone, aiResponse, messageId)
    logger.whatsapp('V10 Customer reply sent', { to: normalizedPhone, messageId, responseLength: aiResponse.length })

    // V10 Blueprint: Module 12 - Send battle card to closer (if generated)
    if (battleCard && battleCardResult.status === 'fulfilled' && (battleCardResult.value as any).rawContent) {
      const closerPhoneNumber = process.env.CLOSER_WHATSAPP_NUMBER || '+94771234567'
      await battleCardService.sendBattleCardToCloser(
        (battleCardResult.value as any).rawContent,
        customerName,
        closerPhoneNumber
      )
      logger.whatsapp('V10 Battle card sent to closer', { customerName, closerPhoneNumber })
    }

    // V10 Blueprint: Module 10 - Enhanced conversation saving with battle card tracking
    const processingTime = Date.now() - startTime
    await saveV10Conversation(
      normalizedPhone,
      customerName,
      messageId,
      messageText,
      aiResponse,
      conversationHistory,
      battleCardResult.status === 'fulfilled' && battleCardResult.value.success,
      battleCardResult.status === 'fulfilled' ? (battleCardResult.value as any).rawContent : undefined,
      processingTime,
      searchKeyword,
      inventoryResults.length,
      storeConfig
    )
    
    // V10 Blueprint: Enhanced analytics tracking
    await trackV10ConversationAnalytics(
      normalizedPhone,
      searchKeyword,
      inventoryResults.length,
      processingTime,
      battleCardResult.status === 'fulfilled' && battleCardResult.value.success
    )

  } catch (error) {
    logger.error('V10 Error processing WhatsApp message', {
      phoneNumber: rawPhoneNumber,
      messageId,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

// V10 Blueprint: Enhanced inventory search
async function searchV10Inventory(searchKeyword: string): Promise<any[]> {
  try {
    if (!searchKeyword || searchKeyword === 'GENERAL') {
      return []
    }

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .ilike('name', `%${searchKeyword}%`)
      .limit(5)

    if (error) {
      logger.database('V10 Inventory search failed', { searchKeyword, error })
      return []
    }

    return data || []
  } catch (error) {
    logger.error('V10 Inventory search error', error as Error)
    return []
  }
}

// V10 Blueprint: Enhanced conversation saving with battle card data
async function saveV10Conversation(
  phoneNumber: string,
  customerName: string,
  messageId: string,
  customerMessage: string,
  assistantResponse: string,
  existingHistory: string,
  battleCardGenerated: boolean,
  battleCardContent: string | undefined,
  processingTime: number,
  searchKeyword: string,
  inventoryResultCount: number,
  storeConfig: Record<string, string>
) {
  try {
    const newHistory = whatsappV9Service.formatConversationHistory(existingHistory, customerMessage, assistantResponse)

    const conversationData = {
      phone_number: phoneNumber,
      customer_name: customerName || 'Unknown',
      last_message_id: messageId,
      history: newHistory,
      updated_at: new Date().toISOString(),
      // V10 Blueprint: Battle card tracking
      battle_card_generated: battleCardGenerated,
      battle_card_content: battleCardContent,
      battle_card_sent_at: battleCardGenerated ? new Date().toISOString() : null,
      // V10 Blueprint: Analytics fields
      search_keyword: searchKeyword,
      inventory_results_count: inventoryResultCount,
      processing_time_ms: processingTime,
      blueprint_version: 'V10',
      // V10 Blueprint: Store config (persist for future use)
      ...storeConfig
    }

    const { error } = await supabase
      .from('conversations')
      .upsert(conversationData, {
        onConflict: 'phone_number'
      })

    if (error) {
      logger.database('V10 Failed to save conversation', { phoneNumber, error })
    } else {
      logger.database('V10 Conversation saved successfully', { 
        phoneNumber, 
        messageId, 
        battleCardGenerated 
      })
    }
  } catch (error) {
    logger.error('V10 Conversation save error', error as Error)
  }
}

// V10 Blueprint: Enhanced analytics tracking
async function trackV10ConversationAnalytics(
  phoneNumber: string,
  searchKeyword: string,
  inventoryResultCount: number,
  processingTime: number,
  battleCardGenerated: boolean
) {
  try {
    const analyticsData = {
      phone_number: phoneNumber,
      search_keyword: searchKeyword,
      inventory_results_count: inventoryResultCount,
      processing_time_ms: processingTime,
      battle_card_generated: battleCardGenerated,
      customer_reply_sent: true,
      timestamp: new Date().toISOString(),
      blueprint_version: 'V10'
    }

    const { error } = await supabase
      .from('conversation_analytics')
      .insert(analyticsData)

    if (error) {
      logger.database('V10 Failed to track analytics', { phoneNumber, error })
    }
  } catch (error) {
    logger.error('V10 Analytics tracking error', error as Error)
  }
}
