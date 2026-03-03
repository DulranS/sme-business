import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Fetch all stats in parallel
    const [
      inventoryStats,
      orderStats,
      customerStats,
      inquiryStats,
      recentOrders,
      recentInquiries,
      lowStockItems,
      topCategories,
    ] = await Promise.all([
      // Inventory stats
      supabaseAdmin.from('inventory').select('quantity, price, cost_price, low_stock_threshold'),
      
      // Order stats
      supabaseAdmin.from('orders').select('status, total, created_at'),
      
      // Customer stats
      supabaseAdmin.from('customers').select('created_at, total_spent'),
      
      // Inquiry stats (last 7 days)
      supabaseAdmin
        .from('inquiry_logs')
        .select('intent, created_at, resolved, escalated')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      
      // Recent orders
      supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5),
      
      // Recent inquiries
      supabaseAdmin
        .from('inquiry_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
      
      // Low stock items
      supabaseAdmin
        .from('inventory')
        .select('*')
        .order('quantity', { ascending: true })
        .limit(10),
      
      // Category distribution
      supabaseAdmin
        .from('inventory')
        .select('category'),
    ])

    const inventory = inventoryStats.data || []
    const orders = orderStats.data || []
    const customers = customerStats.data || []
    const inquiries = inquiryStats.data || []

    // Calculate inventory stats
    const totalInventoryValue = inventory.reduce(
      (sum, item) => sum + item.price * item.quantity, 0
    )
    const totalItems = inventory.length
    const lowStockCount = inventory.filter(
      (item) => item.quantity <= item.low_stock_threshold
    ).length
    const outOfStockCount = inventory.filter((item) => item.quantity === 0).length

    // Calculate order stats
    const totalRevenue = orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0)
    const pendingOrders = orders.filter((o) => o.status === 'pending').length
    const completedOrders = orders.filter((o) => o.status === 'delivered').length

    // Today's orders
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter((o) => new Date(o.created_at) >= today).length
    const todayRevenue = orders
      .filter((o) => new Date(o.created_at) >= today && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.total, 0)

    // Inquiry stats
    const totalInquiries = inquiries.length
    const resolvedInquiries = inquiries.filter((i) => i.resolved).length
    const escalatedInquiries = inquiries.filter((i) => i.escalated).length
    const intentBreakdown = inquiries.reduce(
      (acc: Record<string, number>, i) => {
        acc[i.intent] = (acc[i.intent] || 0) + 1
        return acc
      },
      {}
    )

    // Category distribution
    const categories = (topCategories.data || []).reduce(
      (acc: Record<string, number>, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1
        return acc
      },
      {}
    )

    // Low stock items (actual items, not just count)
    const lowStockItemsList = (lowStockItems.data || []).filter(
      (item) => item.quantity <= item.low_stock_threshold
    )

    return NextResponse.json({
      inventory: {
        totalItems,
        totalValue: totalInventoryValue,
        lowStockCount,
        outOfStockCount,
        categories,
      },
      orders: {
        total: orders.length,
        totalRevenue,
        pendingOrders,
        completedOrders,
        todayOrders,
        todayRevenue,
      },
      customers: {
        total: customers.length,
        totalSpent: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0),
      },
      inquiries: {
        total: totalInquiries,
        resolved: resolvedInquiries,
        escalated: escalatedInquiries,
        resolutionRate: totalInquiries > 0 ? Math.round((resolvedInquiries / totalInquiries) * 100) : 0,
        intentBreakdown,
      },
      recentOrders: recentOrders.data || [],
      recentInquiries: recentInquiries.data || [],
      lowStockItems: lowStockItemsList,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}