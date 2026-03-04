import OpenAI from 'openai'
import { supabaseAdmin } from './supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Search inventory based on natural language query
async function searchInventory(query: string, vehicleInfo?: string): Promise<Record<string, unknown>[]> {
  let supabaseQuery = supabaseAdmin
    .from('inventory')
    .select('*')
    .gt('quantity', 0)

  // Text search across name, description, part_number, brand
  if (query) {
    supabaseQuery = supabaseQuery.or(
      `name.ilike.%${query}%,description.ilike.%${query}%,part_number.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`
    )
  }

  const { data, error } = await supabaseQuery.limit(5)
  if (error) return []
  return data || []
}

// Check specific item availability by item code / SKU
async function checkPartAvailability(partNumber: string) {
  const { data } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .eq('part_number', partNumber)
    .single()
  return data
}

// Get or create customer
async function getOrCreateCustomer(whatsappNumber: string) {
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .single()

  if (existing) {
    // Update last interaction
    await supabaseAdmin
      .from('customers')
      .update({ last_interaction: new Date().toISOString() })
      .eq('id', existing.id)
    return existing
  }

  const { data: newCustomer } = await supabaseAdmin
    .from('customers')
    .insert({ whatsapp_number: whatsappNumber, last_interaction: new Date().toISOString() })
    .select()
    .single()

  return newCustomer
}

// Get conversation history
async function getConversation(whatsappNumber: string) {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('whatsapp_number', whatsappNumber)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data
}

// Save/update conversation
async function saveConversation(
  whatsappNumber: string,
  customerId: string,
  messages: Array<{ role: string; content: string; timestamp: string }>,
  context: Record<string, unknown>
) {
  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('whatsapp_number', whatsappNumber)
    .eq('status', 'active')
    .single()

  if (existing) {
    await supabaseAdmin
      .from('conversations')
      .update({ messages, context, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin
      .from('conversations')
      .insert({ whatsapp_number: whatsappNumber, customer_id: customerId, messages, context })
  }
}

// Log inquiry
async function logInquiry(
  whatsappNumber: string,
  customerId: string,
  message: string,
  aiResponse: string,
  intent: string,
  partsMentioned: string[]
) {
  await supabaseAdmin.from('inquiry_logs').insert({
    whatsapp_number: whatsappNumber,
    customer_id: customerId,
    message,
    ai_response: aiResponse,
    intent,
    parts_mentioned: partsMentioned,
    resolved: true,
  })
}

// Check low stock and create alerts
async function checkAndCreateStockAlerts() {
  const { data: lowStockItems } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .filter('quantity', 'lte', 'low_stock_threshold')

  if (lowStockItems && lowStockItems.length > 0) {
    for (const item of lowStockItems) {
      await supabaseAdmin.from('stock_alerts').upsert({
        inventory_id: item.id,
        part_number: item.part_number,
        part_name: item.name,
        current_quantity: item.quantity,
        threshold: item.low_stock_threshold,
        alert_sent: false,
      })
    }
  }
}

// OpenAI tools definition for the AI agent
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_inventory',
      description: 'Search for inventory items by name, category, brand, or description. Use this when a customer asks about a specific item or type of item.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - part name, type, brand, or category',
          },
          vehicle_info: {
            type: 'string',
            description: 'Vehicle make/model/year if customer mentioned it',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_part_availability',
      description: 'Check availability of a specific inventory item by item code / SKU',
      parameters: {
        type: 'object',
        properties: {
          part_number: {
            type: 'string',
            description: 'The specific part number to check',
          },
        },
        required: ['part_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_status',
      description: 'Get the status of a customer order by order number',
      parameters: {
        type: 'object',
        properties: {
          order_number: {
            type: 'string',
            description: 'The order number to check',
          },
        },
        required: ['order_number'],
      },
    },
  },
]

// Process tool calls from OpenAI
async function processToolCall(toolName: string, toolArgs: Record<string, string>) {
  switch (toolName) {
    case 'search_inventory': {
      const results = await searchInventory(toolArgs.query, toolArgs.vehicle_info)
      if (results.length === 0) {
        return 'No matching items found in inventory for this query.'
      }
      return JSON.stringify(
        results.map((item: Record<string, unknown>) => ({
          part_number: item.part_number,
          name: item.name,
          brand: item.brand,
          price: (item.price as number)?.toLocaleString(),
          quantity: item.quantity,
          available: (item.quantity as number) > 0,
          compatible_vehicles: item.compatible_vehicles,
          description: item.description,
        }))
      )
    }

    case 'check_part_availability': {
      const part = await checkPartAvailability(toolArgs.part_number)
      if (!part) return 'Item not found in our inventory.'
      return JSON.stringify({
        part_number: part.part_number,
        name: part.name,
        brand: part.brand,
        price: part.price?.toLocaleString(),
        quantity: part.quantity,
        available: part.quantity > 0,
        location: part.location,
      })
    }

    case 'get_order_status': {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('order_number', toolArgs.order_number)
        .single()

      if (!order) return 'Order not found. Please check your order number.'
      return JSON.stringify({
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        items: order.items,
        total: order.total?.toLocaleString(),
        created_at: new Date(order.created_at).toLocaleDateString(),
      })
    }

    default:
      return 'Tool not found.'
  }
}

// Main AI agent function
export async function processCustomerMessage(
  whatsappNumber: string,
  customerMessage: string
): Promise<{ response: string; intent: string; escalate: boolean }> {
  
  // Get or create customer
  const customer = await getOrCreateCustomer(whatsappNumber)
  if (!customer) throw new Error('Failed to get/create customer')

  // Get conversation history
  const conversation = await getConversation(whatsappNumber)
  const existingMessages = conversation?.messages || []

  // Build messages array for OpenAI
  const systemPrompt = `You are an expert AI assistant for a product-based business. 
Your job is to help customers find the right items from inventory, check availability, get prices, and track orders via WhatsApp.

IMPORTANT RULES:
- Always be helpful, professional, and concise (WhatsApp format - no long paragraphs)
- Use emojis appropriately for WhatsApp (📦 for items, ✅ for available, ❌ for unavailable, 💰 for prices)
- When items are found, always mention: name, brand, price, availability, and item code / SKU
- If you cannot help or need to escalate, say: "I'll connect you with our team member now." 
- Always use the business’s local currency for prices (do not assume a specific country)
- Be conversational and friendly
- If stock is low (3 or less), mention urgency: "⚠️ Only X left in stock!"
- Format WhatsApp messages properly - short, clear, with line breaks

ESCALATE when:
- Customer is angry or frustrated
- Complex technical questions beyond parts availability
- Complaints or refund requests
- Custom orders or bulk orders`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...existingMessages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: customerMessage },
  ]

  let aiResponse = ''
  let intent = 'general'
  let escalate = false
  const partsMentioned: string[] = []

  try {
    // First OpenAI call with tools
    let response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 500,
    })

    let assistantMessage = response.choices[0].message

    // Handle tool calls in a loop (agentic behavior)
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage)

      // Process all tool calls
      const toolResults: OpenAI.Chat.ChatCompletionMessageParam[] = []
      for (const toolCall of assistantMessage.tool_calls) {
        const toolArgs = JSON.parse(toolCall.function.arguments)
        const result = await processToolCall(toolCall.function.name, toolArgs)

        // Extract part numbers mentioned
        if (toolCall.function.name === 'search_inventory' || toolCall.function.name === 'check_part_availability') {
          try {
            const parsed = JSON.parse(result)
            if (Array.isArray(parsed)) {
              parsed.forEach((p) => p.part_number && partsMentioned.push(p.part_number))
            } else if (parsed.part_number) {
              partsMentioned.push(parsed.part_number)
            }
          } catch {}
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }

      messages.push(...toolResults)

      // Continue conversation with tool results
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 500,
      })

      assistantMessage = response.choices[0].message
    }

    aiResponse = assistantMessage.content || 'I apologize, I could not process your request.'

    // Detect intent from response
    const lowerMessage = customerMessage.toLowerCase()
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
      intent = 'price_check'
    } else if (lowerMessage.includes('available') || lowerMessage.includes('stock') || lowerMessage.includes('have')) {
      intent = 'availability'
    } else if (lowerMessage.includes('order') || lowerMessage.includes('status') || lowerMessage.includes('track')) {
      intent = 'order_status'
    } else if (partsMentioned.length > 0) {
      intent = 'part_inquiry'
    }

    // Detect escalation
    escalate = aiResponse.toLowerCase().includes("connect you with our team")

    // Update conversation history
    const updatedMessages = [
      ...existingMessages,
      { role: 'user', content: customerMessage, timestamp: new Date().toISOString() },
      { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() },
    ]

    // Keep last 20 messages to avoid token overflow
    const trimmedMessages = updatedMessages.slice(-20)

    await saveConversation(whatsappNumber, customer.id, trimmedMessages, {
      last_intent: intent,
      parts_mentioned: partsMentioned,
    })

    // Log the inquiry
    await logInquiry(whatsappNumber, customer.id, customerMessage, aiResponse, intent, partsMentioned)

    // Check stock alerts
    await checkAndCreateStockAlerts()

  } catch (error) {
    console.error('AI Agent error:', error)
    aiResponse = "Sorry, I'm having trouble right now. Please try again or call us directly. 🙏"
  }

  return { response: aiResponse, intent, escalate }
}

export { getOrCreateCustomer, searchInventory }