import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// WhatsApp webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge)
  }

  return NextResponse.json({ error: 'Invalid verification token' }, { status: 403 })
}

// Handle incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    
    // Verify webhook signature
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(body)
    
    // Process only message changes
    if (data.object === 'whatsapp_business_account') {
      for (const entry of data.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await processMessage(change.value)
          }
        }
      }
    }

    return NextResponse.json({ status: 'received' })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
    .update(body)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

async function processMessage(value: any) {
  const messages = value.messages || []
  
  for (const message of messages) {
    if (message.type === 'text') {
      await handleTextMessage(message, value.contacts?.[0])
    }
  }
}

async function handleTextMessage(message: any, contact: any) {
  const phoneNumber = message.from
  const customerName = contact?.profile?.name || 'Unknown'
  const messageText = message.text.body
  const messageId = message.id

  try {
    // Extract keyword using Claude
    const keyword = await extractKeyword(messageText)
    
    // Search inventory
    const inventoryResults = await searchInventory(keyword)
    
    // Get conversation history
    const conversationHistory = await getConversationHistory(phoneNumber)
    
    // Generate AI response
    const aiResponse = await generateResponse(
      customerName,
      messageText,
      inventoryResults,
      conversationHistory
    )
    
    // Update conversation history
    await updateConversationHistory(
      phoneNumber,
      customerName,
      messageText,
      aiResponse
    )
    
    // Send WhatsApp response
    await sendWhatsAppResponse(phoneNumber, aiResponse, messageId)
    
  } catch (error) {
    console.error('Error processing message:', error)
    // Send fallback response
    await sendWhatsAppResponse(
      phoneNumber,
      'Sorry, I encountered an error. Please try again later.',
      messageId
    )
  }
}

async function extractKeyword(messageText: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Extract the single most relevant inventory search keyword from the customer message below. Return ONLY the keyword or short phrase, no explanation, no punctuation, no extra text.

Examples:
- Do you have Nike Air Max in size 9? -> Nike Air Max
- Is the iPhone 15 in stock? -> iPhone 15
- What red dresses do you have? -> red dress
- How many units of SKU-4821 are left? -> SKU-4821

Customer message: ${messageText}`
      }]
    })
  })

  const data = await response.json()
  return data.content[0]?.text?.trim() || ''
}

async function searchInventory(keyword: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .ilike('name', `%${keyword}%`)
    .limit(5)

  if (error) throw error
  return data || []
}

async function getConversationHistory(phoneNumber: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('history')
    .eq('phone_number', phoneNumber)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data?.history || ''
}

async function generateResponse(
  customerName: string,
  messageText: string,
  inventoryResults: any[],
  conversationHistory: string
): Promise<string> {
  const inventoryText = inventoryResults
    .map(item => `${item.name} | qty: ${item.quantity} | price: ${item.price} | sku: ${item.sku}`)
    .join(', ')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are a friendly customer support assistant for a retail business. You reply via WhatsApp.

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
      }]
    })
  })

  const data = await response.json()
  return data.content[0]?.text || 'Sorry, I could not generate a response.'
}

async function updateConversationHistory(
  phoneNumber: string,
  customerName: string,
  customerMessage: string,
  aiResponse: string
) {
  const { data: existing } = await supabase
    .from('conversations')
    .select('history')
    .eq('phone_number', phoneNumber)
    .single()

  const newEntry = `\n[Customer]: ${customerMessage}\n[Assistant]: ${aiResponse}`
  const updatedHistory = existing?.history 
    ? (existing.history + newEntry).slice(-4000) // Keep last 4000 chars
    : newEntry.slice(-4000)

  await supabase
    .from('conversations')
    .upsert({
      phone_number: phoneNumber,
      customer_name: customerName,
      history: updatedHistory,
      updated_at: new Date().toISOString()
    })
}

async function sendWhatsAppResponse(
  phoneNumber: string,
  message: string,
  replyToMessageId: string
) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        text: {
          body: message
        },
        context: {
          message_id: replyToMessageId
        }
      })
    }
  )

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.statusText}`)
  }
}
