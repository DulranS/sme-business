import { NextRequest, NextResponse } from 'next/server'
import { processCustomerMessage } from '@/lib/ai-agent'
import { sendWhatsAppMessage, markMessageAsRead, parseWhatsAppWebhook } from '@/lib/whatsapp'
import { supabaseAdmin } from '@/lib/supabase'

// GET - Webhook verification (required by Meta)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST - Receive messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Acknowledge receipt immediately (Meta requires fast response)
    const parsed = parseWhatsAppWebhook(body)

    if (!parsed) {
      // Could be a status update, not a message - ignore
      return NextResponse.json({ status: 'ok' }, { status: 200 })
    }

    const { from, messageId, text } = parsed

    // Mark message as read
    await markMessageAsRead(messageId)

    // Send typing indicator by processing in background
    // Process the message with AI agent
    const { response, intent, escalate } = await processCustomerMessage(from, text)

    // Send AI response back to customer
    const sent = await sendWhatsAppMessage(from, response)

    if (!sent) {
      console.error('Failed to send WhatsApp message to:', from)
    }

    // If escalation needed, notify admin
    if (escalate) {
      await notifyAdminEscalation(from, text, response)
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 })

  } catch (error) {
    console.error('WhatsApp webhook error:', error)
    // Always return 200 to Meta to prevent retries
    return NextResponse.json({ status: 'ok' }, { status: 200 })
  }
}

// Notify admin of escalated conversations
async function notifyAdminEscalation(
  customerNumber: string,
  customerMessage: string,
  aiResponse: string
) {
  try {
    // Update conversation status to escalated
    await supabaseAdmin
      .from('conversations')
      .update({ status: 'escalated' })
      .eq('whatsapp_number', customerNumber)
      .eq('status', 'active')

    // You can add additional notification here (email, Slack, etc.)
    console.log(`🚨 ESCALATION: Customer ${customerNumber} needs human support`)
    console.log(`Customer said: ${customerMessage}`)
    console.log(`AI responded: ${aiResponse}`)

    // Optional: Send notification to your admin WhatsApp number
    const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER
    if (adminNumber) {
      await sendWhatsAppMessage(
        adminNumber,
        `🚨 *Escalation Alert*\n\nCustomer: +${customerNumber}\nMessage: "${customerMessage}"\n\nPlease follow up with this customer.`
      )
    }
  } catch (error) {
    console.error('Failed to handle escalation:', error)
  }
}