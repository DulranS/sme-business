import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { Config } from '@/lib/config'
import { whatsappService } from '@/lib/whatsapp-blueprint'
import { claudeBlueprintService } from '@/lib/claude-blueprint'
import { logger } from '@/lib/logger'
import { WhatsAppContact, WhatsAppMessage } from '@/types'

Config.validate()
const supabase = createSupabaseServerClient()

const INVENTORY_SEARCH_TTL_MS = 60 * 1000 // Cache inventory search results for 1 minute
const inventorySearchCache = new Map<string, { expiresAt: number; results: unknown[] }>()

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = whatsappService.verifyWebhookChallenge(mode, token)
  if (verifyToken && challenge) {
    logger.webhook('Webhook verification succeeded', { mode, challenge: challenge.slice(0, 16) })
    return new NextResponse(challenge)
  }

  logger.warn('Webhook verification failed', { mode, token })
  return NextResponse.json({ error: 'Invalid verification' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!whatsappService.verifyWebhookSignature(body, signature)) {
      logger.warn('Invalid WhatsApp webhook signature', { signature })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    const { messages, contacts, phoneNumberId } = whatsappService.parseWebhookPayload(payload)

    if (!messages.length) {
      logger.webhook('Webhook payload contained no text messages', { payload })
      return NextResponse.json({ status: 'no_messages' })
    }

    for (let i = 0; i < messages.length; i += 1) {
      const message = messages[i]
      const contact = contacts[i]
      await processWhatsAppMessage(message, contact, phoneNumberId)
    }

    return NextResponse.json({ status: 'processed' })
  } catch (error) {
    logger.error('Webhook processing error', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

async function processWhatsAppMessage(message: WhatsAppMessage, contact: WhatsAppContact | undefined, phoneNumberId: string | null) {
  const rawPhoneNumber = message.from
  const normalizedPhone = whatsappService.normalizePhoneNumber(rawPhoneNumber)
  const messageId = message.id
  const messageText = message.text?.body?.trim() || ''
  const customerName = whatsappService.getCustomerName(contact)

  const startTime = Date.now()

  try {
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      logger.database('Failed to fetch conversation', { phoneNumber: normalizedPhone })
      return
    }

    const conversation = conversations?.[0]
    const lastMessageId = conversation?.last_message_id
    const conversationHistory = conversation?.history || ''

    if (whatsappService.isMessageProcessed(messageId, lastMessageId)) {
      logger.warn('Duplicate message dropped', { messageId, phoneNumber: normalizedPhone, lastMessageId })
      return
    }

    const searchKeyword = await claudeBlueprintService.extractKeyword(messageText)
    logger.ai('Extracted inventory keyword', { searchKeyword, messageText })

    const inventoryResults = await searchInventory(searchKeyword)
    const aiResponse = await claudeBlueprintService.generateResponse(
      customerName,
      messageText,
      inventoryResults,
      conversationHistory,
      searchKeyword
    )

    await whatsappService.sendMessage(normalizedPhone, aiResponse, messageId, phoneNumberId || undefined)
    logger.whatsapp('WhatsApp reply sent', { to: normalizedPhone, messageId, preview: aiResponse.slice(0, 80) })

    await saveConversation(normalizedPhone, customerName, messageId, messageText, aiResponse, conversationHistory)
    await trackConversationAnalytics(normalizedPhone, searchKeyword, inventoryResults.length, Date.now() - startTime)
  } catch (error) {
    logger.error('Error processing WhatsApp message', {
      phoneNumber: rawPhoneNumber,
      messageId,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

async function searchInventory(searchKeyword: string) {
  if (!searchKeyword || searchKeyword === 'GENERAL') {
    return []
  }

  const cacheKey = `inventory_search:${searchKeyword.toLowerCase().trim()}`
  const cached = inventorySearchCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('Using cached inventory search results', { searchKeyword, cacheKey })
    return cached.results
  }

  const safeKeyword = searchKeyword.replace(/[%_]/g, match => `\\${match}`)
  const filter = `name.ilike.%${safeKeyword}%,sku.eq.${safeKeyword},description.ilike.%${safeKeyword}%,category.ilike.%${safeKeyword}%`

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .or(filter)
    .eq('is_active', true)
    .limit(5)

  if (error) {
    logger.database('Inventory search failed', { searchKeyword, filter })
    return []
  }

  const results = data || []
  inventorySearchCache.set(cacheKey, {
    expiresAt: Date.now() + INVENTORY_SEARCH_TTL_MS,
    results
  })

  return results
}

async function saveConversation(
  phoneNumber: string,
  customerName: string,
  messageId: string,
  customerMessage: string,
  assistantReply: string,
  existingHistory: string
) {
  try {
    const newHistory = `${existingHistory ? `${existingHistory}\n` : ''}[Customer]: ${customerMessage}\n[Assistant]: ${assistantReply}`
    const truncatedHistory = newHistory.length > 3800 ? newHistory.slice(-3800) : newHistory

    const conversationData = {
      phone_number: phoneNumber,
      customer_name: customerName || 'Unknown',
      last_message_id: messageId,
      history: truncatedHistory,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('conversations')
      .upsert(conversationData, { onConflict: 'phone_number' })

    if (error) {
      logger.database('Failed to save conversation', { phoneNumber })
    }
  } catch (error) {
    logger.error('Error saving conversation data', {
      phoneNumber,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

async function trackConversationAnalytics(phoneNumber: string, keyword: string, resultCount: number, responseTimeMs: number) {
  try {
    const { error } = await supabase.from('conversation_analytics').insert({
      phone_number: phoneNumber,
      search_keyword: keyword,
      result_count: resultCount,
      response_time_ms: responseTimeMs,
      timestamp: new Date().toISOString(),
      converted: resultCount > 0
    })

    if (error) {
      logger.database('Failed to track analytics', { phoneNumber, keyword, resultCount })
    }
  } catch (error) {
    logger.error('Analytics tracking failed', {
      phoneNumber,
      keyword,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
