import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for frontend (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for API routes (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

export type InventoryItem = {
  id: string
  part_number: string
  name: string
  description: string
  brand: string
  category: string
  compatible_vehicles: VehicleCompatibility[]
  price: number
  cost_price: number
  quantity: number
  low_stock_threshold: number
  location: string
  supplier: string
  supplier_part_number: string
  images: string[]
  weight_kg: number
  created_at: string
  updated_at: string
}

export type VehicleCompatibility = {
  make: string
  model: string
  year_from: number
  year_to: number
}

export type Customer = {
  id: string
  whatsapp_number: string
  name: string
  email: string
  vehicle_info: VehicleInfo[]
  total_orders: number
  total_spent: number
  last_interaction: string
  created_at: string
}

export type VehicleInfo = {
  make: string
  model: string
  year: number
  registration: string
}

export type Conversation = {
  id: string
  customer_id: string
  whatsapp_number: string
  status: 'active' | 'resolved' | 'escalated'
  messages: Message[]
  context: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type Message = {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export type Order = {
  id: string
  order_number: string
  customer_id: string
  whatsapp_number: string
  items: OrderItem[]
  subtotal: number
  total: number
  status: 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled'
  payment_status: 'unpaid' | 'paid' | 'refunded'
  notes: string
  created_at: string
  updated_at: string
}

export type OrderItem = {
  part_id: string
  part_number: string
  name: string
  quantity: number
  price: number
}

export type InquiryLog = {
  id: string
  whatsapp_number: string
  customer_id: string
  message: string
  ai_response: string
  intent: string
  parts_mentioned: string[]
  resolved: boolean
  escalated: boolean
  created_at: string
}