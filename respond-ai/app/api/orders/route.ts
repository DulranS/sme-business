import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString().slice(-8)}`

    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({ ...body, order_number: orderNumber })
      .select()
      .single()

    if (error) throw error

    // Update inventory quantities
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        await supabaseAdmin.rpc('decrement_inventory', {
          part_id: item.part_id,
          qty: item.quantity,
        })
      }
    }

    // Update customer stats
    if (body.customer_id) {
      await supabaseAdmin.rpc('update_customer_stats', {
        cust_id: body.customer_id,
        order_total: body.total,
      })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}