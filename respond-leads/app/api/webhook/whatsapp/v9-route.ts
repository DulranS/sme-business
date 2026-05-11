import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { whatsappV9Service } from '@/lib/whatsapp-v9'
import { claudeV9Service } from '@/lib/claude-v9'
import { logger } from '@/lib/logger'
import { WhatsAppContact, WhatsAppMessage } from '@/types'

const supabase = createSupabaseServerClient()

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.webhook('V9 Webhook verified successfully', { mode, token })
    return new NextResponse(challenge || '', { status: 200 })
  }

  return NextResponse.json({ error: 'Invalid verification' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // V9 Blueprint: Enhanced webhook signature verification
    if (!whatsappV9Service.verifyWebhookSignature(body, signature)) {
      logger.warn('V9 Invalid WhatsApp webhook signature', { signature })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const parsedMessages = whatsappV9Service.parseWebhookPayload(payload)

    if (!parsedMessages.length) {
      logger.webhook('V9 Webhook payload contained no valid text messages', { payload })
      return NextResponse.json({ status: 'no_messages' })
    }

    // V9 Blueprint: Process each message with enhanced error handling
    for (const { message, contact } of parsedMessages) {
      await processV9WhatsAppMessage(message, contact)
    }

    return NextResponse.json({ status: 'processed' })
  } catch (error) {
    logger.error('V9 Webhook processing error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

// V9 Blueprint: Enhanced message processing with better error handling
async function processV9WhatsAppMessage(message: WhatsAppMessage, contact: WhatsAppContact | undefined) {
  const rawPhoneNumber = message.from
  const normalizedPhone = whatsappV9Service.normalizePhoneNumber(rawPhoneNumber)
  const messageId = message.id
  const messageText = message.text?.body?.trim() || ''
  const customerName = whatsappV9Service.getCustomerName(contact)

  try {
    // V9 Blueprint: Module 9 - Enhanced conversation lookup with better filtering
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      logger.database('V9 Failed to fetch conversation', { phoneNumber: normalizedPhone, error: fetchError })
      return
    }

    const conversation = conversations?.[0]
    const lastMessageId = conversation?.last_message_id
    const conversationHistory = conversation?.history || ''

    // V9 Blueprint: Module 8 - Enhanced deduplication check
    if (whatsappV9Service.isMessageProcessed(messageId, lastMessageId)) {
      logger.warn('V9 Duplicate message dropped', { messageId, phoneNumber: normalizedPhone, lastMessageId })
      return
    }

    // V9 Blueprint: Module 8 - Enhanced keyword extraction with conversation context
    const searchKeyword = await claudeV9Service.extractKeyword(messageText, conversationHistory)
    logger.ai('V9 Extracted inventory keyword', { searchKeyword, messageText: messageText.slice(0, 100) })

    // V9 Blueprint: Module 1 - Enhanced inventory search
    const inventoryResults = await searchV9Inventory(searchKeyword)
    
    // V9 Blueprint: Module 2 - Enhanced response generation with store knowledge
    const storeKnowledge = await claudeV9Service.getStoreKnowledge()
    const aiResponse = await claudeV9Service.generateResponse(
      customerName,
      messageText,
      inventoryResults,
      conversationHistory,
      searchKeyword,
      storeKnowledge
    )

    // V9 Blueprint: Module 6 - Enhanced message sending with better error handling
    await whatsappV9Service.sendMessage(normalizedPhone, aiResponse, messageId)
    logger.whatsapp('V9 WhatsApp reply sent', { to: normalizedPhone, messageId, responseLength: aiResponse.length })

    // V9 Blueprint: Module 10 - Enhanced conversation saving with better history management
    await saveV9Conversation(normalizedPhone, customerName, messageId, messageText, aiResponse, conversationHistory)
    
    // V9 Blueprint: Enhanced analytics tracking
    await trackV9ConversationAnalytics(normalizedPhone, searchKeyword, inventoryResults.length, Date.now() - Number(message.timestamp || Date.now()))

  } catch (error) {
    logger.error('V9 Error processing WhatsApp message', {
      phoneNumber: rawPhoneNumber,
      messageId,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

// V9 Blueprint: Enhanced inventory search with better error handling
async function searchV9Inventory(searchKeyword: string): Promise<any[]> {
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
      logger.database('V9 Inventory search failed', { searchKeyword, error })
      return []
    }

    return data || []
  } catch (error) {
    logger.error('V9 Inventory search error', error as Error)
    return []
  }
}

// V9 Blueprint: Enhanced conversation saving with better history management
async function saveV9Conversation(
  phoneNumber: string,
  customerName: string,
  messageId: string,
  customerMessage: string,
  assistantResponse: string,
  existingHistory: string
) {
  try {
    // V9 Blueprint: Enhanced conversation history formatting
    const newHistory = whatsappV9Service.formatConversationHistory(existingHistory, customerMessage, assistantResponse)

    const conversationData = {
      phone_number: phoneNumber,
      customer_name: customerName || 'Unknown',
      last_message_id: messageId,
      history: newHistory,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('conversations')
      .upsert(conversationData, {
        onConflict: 'phone_number'
      })

    if (error) {
      logger.database('V9 Failed to save conversation', { phoneNumber, error })
    } else {
      logger.database('V9 Conversation saved successfully', { phoneNumber, messageId })
    }
  } catch (error) {
    logger.error('V9 Conversation save error', error as Error)
  }
}

// V9 Blueprint: Enhanced analytics tracking with better metrics
async function trackV9ConversationAnalytics(
  phoneNumber: string,
  searchKeyword: string,
  inventoryResultCount: number,
  processingTime: number
) {
  try {
    const analyticsData = {
      phone_number: phoneNumber,
      search_keyword: searchKeyword,
      inventory_results_count: inventoryResultCount,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
      blueprint_version: 'V9'
    }

    const { error } = await supabase
      .from('conversation_analytics')
      .insert(analyticsData)

    if (error) {
      logger.database('V9 Failed to track analytics', { phoneNumber, error })
    }
  } catch (error) {
    logger.error('V9 Analytics tracking error', error as Error)
  }
}
