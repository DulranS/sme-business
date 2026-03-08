import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { claudeService } from '@/lib/claude'
import { whatsappService } from '@/lib/whatsapp'
import { getSupabaseClient } from '@/lib/supabase'
import { handleDatabaseError, handleExternalServiceError } from '@/lib/errors'

const supabase = getSupabaseClient()

// Simple in-memory rate limiter for Vercel free tier
const rateLimiter = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20 // Very conservative for hobby plan
const QUEUE_RETRY_DELAY = 10000 // 10 seconds between queued requests (more conservative)

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

// Rate limiting helper
function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const record = rateLimiter.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimiter.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

// Simple message queue for handling bursts
const messageQueue = Array<{
  message: any
  contact: any
  timestamp: number
}>()

// Process queued messages
async function processQueue() {
  if (messageQueue.length === 0) return

  const message = messageQueue.shift()
  if (!message) return

  try {
    await processMessage(message.message, message.contact)
    logger.info('Processed queued message', { queueLength: messageQueue.length })
  } catch (error) {
    logger.error('Failed to process queued message', { error }, error as Error)
  }

  // Process next message after delay if queue still has items
  if (messageQueue.length > 0) {
    setTimeout(processQueue, QUEUE_RETRY_DELAY)
  }
}

// Handle incoming WhatsApp messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    
    // Verify webhook signature
    if (!whatsappService.verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(body)
    
    // Process only message changes
    if (data.object === 'whatsapp_business_account') {
      for (const entry of data.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const messages = change.value.messages || []
            
            for (const message of messages) {
              if (message.type === 'text') {
                const phoneNumber = message.from
                const contact = change.value.contacts?.[0]
                
                // Check rate limit per phone number
                if (!checkRateLimit(phoneNumber)) {
                  logger.warn('Rate limit exceeded', { phoneNumber })
                  return NextResponse.json({ 
                    error: 'Vercel Hobby plan rate limit exceeded (20 req/min). Please consider upgrading to Pro for unlimited usage.' 
                  }, { status: 429 })
                }

                // Add to queue for processing
                messageQueue.push({
                  message,
                  contact,
                  timestamp: Date.now()
                })

                logger.info('Message queued', { 
                  phoneNumber, 
                  queueLength: messageQueue.length 
                })
              }
            }
          }
        }
      }
    }

    // Start processing queue if not already running
    if (messageQueue.length === 1) {
      setTimeout(processQueue, QUEUE_RETRY_DELAY) // Conservative delay for hobby plan
    }

    return NextResponse.json({ 
      status: 'received',
      queued: messageQueue.length,
      message: 'Messages queued for processing'
    })

  } catch (error) {
    logger.error('Webhook error', { error }, error as Error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Please try again later'
    }, { status: 500 })
  }
}

async function processMessage(message: any, contact: any) {
  const phoneNumber = message.from
  const customerName = contact?.profile?.name || message?.contact?.name || 'Unknown'
  const messageText = message.text.body
  const messageId = message.id

  try {
    // Extract keyword using Claude
    const keyword = await claudeService.extractKeyword(messageText)
    
    // Search inventory
    const inventoryResults = await searchInventory(keyword)
    
    // Get conversation history
    const conversationHistory = await getConversationHistory(phoneNumber)
    
    // Generate AI response
    const aiResponse = await claudeService.generateResponse(
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
    await whatsappService.sendMessage(phoneNumber, aiResponse, messageId)
    
    // Track analytics for business intelligence
    await trackConversationAnalytics(phoneNumber, keyword, inventoryResults.length)
    
    logger.info('Message processed successfully', { 
      phoneNumber,
      keyword,
      inventoryCount: inventoryResults.length 
    })
    
  } catch (error) {
    logger.error('Error processing message', { 
      phoneNumber, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, error as Error)
    
    // Send fallback response
    try {
      await whatsappService.sendMessage(
        phoneNumber,
        'Sorry, I encountered an error. Please try again later.',
        messageId
      )
    } catch (fallbackError) {
      logger.error('Failed to send fallback message', { 
        phoneNumber, 
        error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error'
      }, fallbackError as Error)
    }
  }
}

// NEW: Business Intelligence Tracking
async function trackConversationAnalytics(phoneNumber: string, keyword: string, resultCount: number) {
  try {
    const { error } = await supabase
      .from('conversation_analytics')
      .insert({
        phone_number: phoneNumber,
        search_keyword: keyword,
        result_count: resultCount,
        timestamp: new Date().toISOString(),
        converted: resultCount > 0 // Simple conversion tracking
      })
    
    if (error) throw error
  } catch (error) {
    logger.error('Failed to track analytics', { phoneNumber, keyword }, error as Error)
  }
}

async function searchInventory(keyword: string) {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .ilike('name', `%${keyword}%`)
      .limit(5)

    if (error) throw handleDatabaseError(error)
    return data || []
  } catch (error) {
    logger.error('Inventory search failed', { keyword }, error as Error)
    return []
  }
}

async function getConversationHistory(phoneNumber: string) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('history')
      .eq('phone_number', phoneNumber)
      .single()

    if (error && error.code !== 'PGRST116') throw handleDatabaseError(error)
    return data?.history || ''
  } catch (error) {
    logger.error('Failed to get conversation history', { phoneNumber }, error as Error)
    return ''
  }
}

async function updateConversationHistory(
  phoneNumber: string,
  customerName: string,
  customerMessage: string,
  aiResponse: string
) {
  try {
    const { data: existing } = await supabase
      .from('conversations')
      .select('history')
      .eq('phone_number', phoneNumber)
      .single()

    const newEntry = `\n[Customer]: ${customerMessage}\n[Assistant]: ${aiResponse}`
    const updatedHistory = existing?.history 
      ? (existing.history + newEntry).slice(-4000) // Keep last 4000 chars
      : newEntry.slice(-4000)

    const { error } = await supabase
      .from('conversations')
      .upsert({
        phone_number: phoneNumber,
        customer_name: customerName,
        history: updatedHistory,
        updated_at: new Date().toISOString()
      })

    if (error) throw handleDatabaseError(error)
    
    logger.database('Conversation updated', { phoneNumber })
  } catch (error) {
    logger.error('Failed to update conversation', { phoneNumber }, error as Error)
  }
}
