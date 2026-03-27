import { NextRequest, NextResponse } from 'next/server'
import { whatsappService } from '@/lib/whatsapp-blueprint'
import { claudeBlueprintService } from '@/lib/claude-blueprint'
import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

// WhatsApp webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Blueprint: Webhook verification
  const verifyToken = whatsappService.verifyWebhookChallenge(mode, token)
  
  if (verifyToken && challenge) {
    return new NextResponse(challenge)
  }
  
  return NextResponse.json({ error: 'Invalid verification' }, { status: 400 })
}


// Handle incoming WhatsApp messages - Blueprint 7-step flow
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    // Blueprint: Verify webhook signature
    if (!whatsappService.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(body)
    
    // Blueprint: Parse webhook payload (Module 7 equivalent)
    const { messages, contacts, phoneNumberId } = whatsappService.parseWebhookPayload(payload)
    
    if (messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' })
    }

    // Process each message (blueprint handles one message per webhook)
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]
      const contact = contacts[i]
      
      await processMessage(message, contact, phoneNumberId)
    }

    return NextResponse.json({ status: 'processed' })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}

// Blueprint: Complete message processing flow (Modules 9, 8, 1, 2, 6, 10)
async function processMessage(message: any, contact: any, phoneNumberId: string) {
  const phoneNumber = message.from
  const messageId = message.id
  const messageText = message.text?.body || ''
  const customerName = whatsappService.getCustomerName(contact)
  const startTime = Date.now()

  try {
    // Blueprint Module 9: Fetch conversation history
    const { data: conversations, error: fetchError } = await supabase
      .from('conversations')
      .select('*')
      .eq('phone_number', phoneNumber)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('Error fetching conversation:', fetchError)
      return
    }

    const conversation = conversations?.[0]
    const lastMessageId = conversation?.last_message_id
    const history = whatsappService.formatConversationHistory(conversation?.history || '')

    // Blueprint Module 8: Deduplication check
    if (whatsappService.isMessageProcessed(messageId, lastMessageId)) {
      console.log(`Message ${messageId} already processed, skipping`)
      return
    }

    // Blueprint Module 8: Keyword extraction with Claude
    const searchKeyword = await claudeBlueprintService.extractKeyword(messageText)
    console.log(`Extracted keyword: ${searchKeyword}`)

    // Blueprint Module 1: Inventory search
    let inventoryResults = []
    if (searchKeyword !== 'GENERAL') {
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('*')
        .or(`name.ilike.%${searchKeyword}%,sku.eq.${searchKeyword}`)
        .limit(5) // Blueprint: limit to 5 results

      if (inventoryError) {
        console.error('Error searching inventory:', inventoryError)
      } else {
        inventoryResults = inventory || []
      }
    }

    // Blueprint Module 2: Generate response with Claude
    const aiResponse = await claudeBlueprintService.generateResponse(
      customerName,
      messageText,
      inventoryResults,
      history,
      searchKeyword
    )

    // Blueprint Module 6: Send WhatsApp reply
    try {
      await whatsappService.sendMessage(phoneNumber, aiResponse, messageId)
      console.log(`Reply sent to ${phoneNumber}: ${aiResponse.substring(0, 50)}...`)

      // Blueprint Module 10: Save conversation history (only after successful send)
      await saveConversation(phoneNumber, customerName, messageId, messageText, aiResponse, history)
      
      // Track analytics for business intelligence
      await trackConversationAnalytics(phoneNumber, searchKeyword, inventoryResults.length, Date.now() - startTime)
      
    } catch (sendError) {
      console.error('Error sending WhatsApp message:', sendError)
      // Blueprint: Don't save history if send failed
    }

  } catch (error) {
    console.error('Error processing message:', error)
  }
}

// Blueprint: Business Intelligence Tracking
async function trackConversationAnalytics(phoneNumber: string, keyword: string, resultCount: number, responseTimeMs: number) {
  try {
    const { error } = await supabase
      .from('conversation_analytics')
      .insert({
        phone_number: phoneNumber,
        search_keyword: keyword,
        result_count: resultCount,
        response_time_ms: responseTimeMs,
        timestamp: new Date().toISOString(),
        converted: resultCount > 0 // Simple conversion tracking
      })
    
    if (error) throw error
  } catch (error) {
    console.error('Failed to track analytics', { phoneNumber, keyword }, error as Error)
  }
}


// Blueprint Module 10: Save conversation history with rolling window
async function saveConversation(
  phoneNumber: string,
  customerName: string,
  messageId: string,
  customerMessage: string,
  assistantReply: string,
  existingHistory: string
) {
  try {
    // Blueprint: Create new history with rolling window (last 4000 characters)
    const newHistory = `${existingHistory}\n[Customer]: ${customerMessage}\n[Assistant]: ${assistantReply}`
    const truncatedHistory = newHistory.length > 4000 
      ? newHistory.slice(-4000) 
      : newHistory

    const conversationData = {
      phone_number: phoneNumber,
      customer_name: customerName,
      last_message_id: messageId,
      history: truncatedHistory,
      updated_at: new Date().toISOString()
    }

    // Blueprint: Upsert conversation (create or update)
    const { error } = await supabase
      .from('conversations')
      .upsert(conversationData, {
        onConflict: 'phone_number'
      })

    if (error) {
      console.error('Error saving conversation:', error)
    } else {
      console.log(`Conversation saved for ${phoneNumber}`)
    }
  } catch (error) {
    console.error('Error in saveConversation:', error)
  }
}
