'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

export type OrderItem = { name: string; quantity: number; price: number }
export type Order = {
  id: string
  order_number: string
  whatsapp_number: string
  total: number
  status: string
  created_at: string
  items: OrderItem[]
  payment_status?: string
}
export type Inquiry = {
  id: string
  whatsapp_number: string
  message: string
  ai_response: string
  intent: string
  created_at: string
}
export type InventoryItem = {
  id: string
  part_number: string
  name: string
  brand: string
  quantity: number
  low_stock_threshold: number
  price: number
  category: string
}
export type Stats = {
  inventory: {
    totalItems: number
    totalValue: number
    lowStockCount: number
    outOfStockCount: number
    categories: Record<string, number>
  }
  orders: {
    total: number
    totalRevenue: number
    pendingOrders: number
    completedOrders: number
    todayOrders: number
    todayRevenue: number
  }
  customers: { total: number; totalSpent: number }
  inquiries: {
    total: number
    resolved: number
    escalated: number
    resolutionRate: number
    intentBreakdown: Record<string, number>
  }
  recentOrders: Order[]
  recentInquiries: Inquiry[]
  lowStockItems: InventoryItem[]
}

const statusColors: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  processing: '#8B5CF6',
  ready: '#10B981',
  delivered: '#6B7280',
  cancelled: '#EF4444',
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'conversations' | 'orders'>('overview')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [showAddPart, setShowAddPart] = useState(false)
  const [newPart, setNewPart] = useState({ part_number: '', name: '', brand: '', category: '', price: '', quantity: '', low_stock_threshold: '5', description: '', supplier: '' })
  const [saving, setSaving] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard')
      const data = await res.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchInventory = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory?search=${inventorySearch}&limit=50`)
      const data = await res.json()
      setInventory(data.data || [])
    } catch (error) {
      console.error('Failed to fetch inventory:', error)
    }
  }, [inventorySearch])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => {
    if (activeTab === 'inventory') fetchInventory()
  }, [activeTab, fetchInventory])

  const handleAddPart = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newPart,
          price: parseFloat(newPart.price),
          quantity: parseInt(newPart.quantity),
          low_stock_threshold: parseInt(newPart.low_stock_threshold),
        }),
      })
      if (res.ok) {
        setShowAddPart(false)
        setNewPart({ part_number: '', name: '', brand: '', category: '', price: '', quantity: '', low_stock_threshold: '5', description: '', supplier: '' })
        fetchInventory()
        fetchStats()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePart = async (id: string) => {
    if (!confirm('Delete this part?')) return
    await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' })
    fetchInventory()
    fetchStats()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #FF4500', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}>
            <p style={{ color: '#666', fontFamily: 'monospace' }}>LOADING SYSTEM...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#E5E5E5', fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Condensed:wght@500;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #FF4500; border-radius: 2px; }
        input, select, textarea { outline: none; }
        button { cursor: pointer; }
        .stat-card:hover { border-color: #FF4500 !important; transform: translateY(-2px); }
        .stat-card { transition: all 0.2s ease; }
        .row-hover:hover { background: rgba(255,69,0,0.05) !important; }
        .tab-btn:hover { color: #FF4500 !important; }
        .action-btn:hover { background: #FF4500 !important; color: white !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#FF4500', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚙</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 2, color: '#FF4500' }}>AUTOPARTS AI</div>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 1 }}>INVENTORY & AI CUSTOMER SYSTEM</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }}>
            <span style={{ fontSize: 11, color: '#10B981', letterSpacing: 1 }}>AI ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a1a', padding: '0 32px', display: 'flex', gap: 0 }}>
        {(['overview', 'inventory', 'conversations', 'orders'] as const).map((tab) => (
          <button
            key={tab}
            className="tab-btn"
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === tab ? '#FF4500' : '#555',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: 2,
              padding: '14px 24px',
              borderBottom: activeTab === tab ? '2px solid #FF4500' : '2px solid transparent',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: '32px' }}>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <div>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
              {([
                { label: 'TOTAL PARTS', value: stats.inventory.totalItems, sub: `${stats.inventory.outOfStockCount} out of stock`, color: '#FF4500', icon: '🔧' },
                { label: 'INVENTORY VALUE', value: `LKR ${stats.inventory.totalValue.toLocaleString()}`, sub: `${stats.inventory.lowStockCount} low stock`, color: '#F59E0B', icon: '💰' },
                { label: 'TODAY REVENUE', value: `LKR ${stats.orders.todayRevenue.toLocaleString()}`, sub: `${stats.orders.todayOrders} orders today`, color: '#10B981', icon: '📈' },
                { label: 'AI RESOLUTION', value: `${stats.inquiries.resolutionRate}%`, sub: `${stats.inquiries.total} inquiries this week`, color: '#3B82F6', icon: '🤖' },
                { label: 'CUSTOMERS', value: stats.customers.total, sub: `${stats.inquiries.escalated} escalated`, color: '#8B5CF6', icon: '👥' },
                { label: 'TOTAL REVENUE', value: `LKR ${stats.orders.totalRevenue.toLocaleString()}`, sub: `${stats.orders.completedOrders} completed orders`, color: '#EC4899', icon: '💎' },
              ]).map((stat) => (
                <div key={stat.label} className="stat-card" style={{ background: '#111', border: '1px solid #1a1a1a', padding: 20, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 12, right: 16, fontSize: 24, opacity: 0.15 }}>{stat.icon}</div>
                  <div style={{ fontSize: 10, color: '#444', letterSpacing: 2, marginBottom: 8 }}>{stat.label}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: stat.color, letterSpacing: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Low Stock Alert */}
            {stats.lowStockItems.length > 0 && (
              <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245,158,11,0.2)', padding: 20, marginBottom: 32 }}>
                <div style={{ fontSize: 11, color: '#F59E0B', letterSpacing: 2, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>⚠</span> LOW STOCK ALERTS ({stats.lowStockItems.length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {stats.lowStockItems.map((item) => (
                    <div key={item.id} style={{ background: '#111', border: '1px solid #2a2a2a', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#ddd', marginBottom: 2 }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: '#555' }}>{item.part_number}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: item.quantity === 0 ? '#EF4444' : '#F59E0B', fontFamily: "'Barlow Condensed', sans-serif" }}>{item.quantity}</div>
                        <div style={{ fontSize: 9, color: '#444' }}>IN STOCK</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Recent Inquiries */}
              <div style={{ background: '#111', border: '1px solid #1a1a1a', padding: 24 }}>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, marginBottom: 20 }}>RECENT AI INQUIRIES</div>
                {stats.recentInquiries.length === 0 ? (
                  <div style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: 32 }}>No inquiries yet</div>
                ) : (
                  stats.recentInquiries.slice(0, 5).map((inquiry) => (
                    <div key={inquiry.id} style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#3B82F6' }}>+{inquiry.whatsapp_number}</span>
                        <span style={{ fontSize: 10, background: '#1a1a1a', color: '#666', padding: '2px 8px' }}>{inquiry.intent}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inquiry.message}</div>
                      <div style={{ fontSize: 10, color: '#333', marginTop: 4 }}>{new Date(inquiry.created_at).toLocaleString()}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Recent Orders */}
              <div style={{ background: '#111', border: '1px solid #1a1a1a', padding: 24 }}>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, marginBottom: 20 }}>RECENT ORDERS</div>
                {stats.recentOrders.length === 0 ? (
                  <div style={{ color: '#333', fontSize: 12, textAlign: 'center', padding: 32 }}>No orders yet</div>
                ) : (
                  stats.recentOrders.map((order) => (
                    <div key={order.id} className="row-hover" style={{ borderBottom: '1px solid #1a1a1a', padding: '12px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: '#FF4500' }}>#{order.order_number}</span>
                        <span style={{ fontSize: 11, color: statusColors[order.status] || '#666' }}>{order.status.toUpperCase()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 10, color: '#555' }}>+{order.whatsapp_number}</span>
                        <span style={{ fontSize: 12, color: '#10B981', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>LKR {order.total.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <input
                placeholder="Search parts, brands, part numbers..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchInventory()}
                style={{ background: '#111', border: '1px solid #222', color: '#ddd', padding: '10px 16px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, width: 380 }}
              />
              <button
                onClick={() => setShowAddPart(true)}
                style={{ background: '#FF4500', border: 'none', color: 'white', padding: '10px 24px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2 }}
              >
                + ADD PART
              </button>
            </div>

            {/* Add Part Modal */}
            {showAddPart && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                <div style={{ background: '#111', border: '1px solid #FF4500', padding: 32, width: 560, maxHeight: '80vh', overflow: 'auto' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700, color: '#FF4500', marginBottom: 24, letterSpacing: 2 }}>ADD NEW PART</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {([
                      { key: 'part_number', label: 'PART NUMBER *' },
                      { key: 'name', label: 'PART NAME *' },
                      { key: 'brand', label: 'BRAND' },
                      { key: 'category', label: 'CATEGORY *' },
                      { key: 'price', label: 'PRICE (LKR) *', type: 'number' },
                      { key: 'quantity', label: 'QUANTITY *', type: 'number' },
                      { key: 'low_stock_threshold', label: 'LOW STOCK THRESHOLD', type: 'number' },
                      { key: 'supplier', label: 'SUPPLIER' },
                    ]).map((field) => (
                      <div key={field.key}>
                        <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>{field.label}</div>
                        <input
                          type={field.type || 'text'}
                          value={newPart[field.key as keyof typeof newPart]}
                          onChange={(e) => setNewPart({ ...newPart, [field.key]: e.target.value })}
                          style={{ background: '#0A0A0A', border: '1px solid #222', color: '#ddd', padding: '8px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, width: '100%' }}
                        />
                      </div>
                    ))}
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 6 }}>DESCRIPTION</div>
                      <textarea
                        value={newPart.description}
                        onChange={(e) => setNewPart({ ...newPart, description: e.target.value })}
                        rows={3}
                        style={{ background: '#0A0A0A', border: '1px solid #222', color: '#ddd', padding: '8px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, width: '100%', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button onClick={handleAddPart} disabled={saving} style={{ background: '#FF4500', border: 'none', color: 'white', padding: '10px 32px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 2, opacity: saving ? 0.5 : 1 }}>
                      {saving ? 'SAVING...' : 'SAVE PART'}
                    </button>
                    <button onClick={() => setShowAddPart(false)} style={{ background: 'none', border: '1px solid #333', color: '#666', padding: '10px 24px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Inventory Table */}
            <div style={{ background: '#111', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0A0A0A', borderBottom: '1px solid #1a1a1a' }}>
                    {['PART NO.', 'NAME', 'BRAND', 'CATEGORY', 'PRICE', 'QTY', 'STATUS', ''].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 9, color: '#444', letterSpacing: 2 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((item) => (
                    <tr key={item.id} className="row-hover" style={{ borderBottom: '1px solid #111' }}>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#FF4500' }}>{item.part_number}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#ddd' }}>{item.name}</td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#888' }}>{item.brand}</td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: '#666' }}>{item.category}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#10B981', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>LKR {Number(item.price).toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: item.quantity === 0 ? '#EF4444' : item.quantity <= item.low_stock_threshold ? '#F59E0B' : '#ddd', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{item.quantity}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 9, letterSpacing: 1, padding: '3px 8px', background: item.quantity === 0 ? 'rgba(239,68,68,0.1)' : item.quantity <= item.low_stock_threshold ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)', color: item.quantity === 0 ? '#EF4444' : item.quantity <= item.low_stock_threshold ? '#F59E0B' : '#10B981' }}>
                          {item.quantity === 0 ? 'OUT OF STOCK' : item.quantity <= item.low_stock_threshold ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button className="action-btn" onClick={() => handleDeletePart(item.id)} style={{ background: 'none', border: '1px solid #333', color: '#555', padding: '4px 12px', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, transition: 'all 0.2s' }}>
                          DEL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {inventory.length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: '#333', fontSize: 12 }}>
                  No parts found. Add your first part or adjust search.
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONVERSATIONS TAB */}
        {activeTab === 'conversations' && (
          <ConversationsTab />
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <OrdersTab />
        )}
      </div>
    </div>
  )
}

// Conversations Component
function ConversationsTab() {
  const [conversations, setConversations] = useState<Array<{ id: string; whatsapp_number: string; status: string; messages: Array<{role: string; content: string; timestamp: string}>; updated_at: string }>>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    const fetch_ = async () => {
      const res = await fetch('/api/conversations')
      const data = await res.json()
      setConversations(data.data || [])
    }
    fetch_()
  }, [])

  const selectedConv = conversations.find((c) => c.id === selected)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 0, height: 'calc(100vh - 200px)', border: '1px solid #1a1a1a' }}>
      {/* Sidebar */}
      <div style={{ background: '#111', borderRight: '1px solid #1a1a1a', overflow: 'auto' }}>
        <div style={{ padding: '16px', fontSize: 9, color: '#444', letterSpacing: 2, borderBottom: '1px solid #1a1a1a' }}>CONVERSATIONS ({conversations.length})</div>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => setSelected(conv.id)}
            style={{ padding: '16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', background: selected === conv.id ? 'rgba(255,69,0,0.05)' : 'transparent', borderLeft: selected === conv.id ? '2px solid #FF4500' : '2px solid transparent' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#3B82F6' }}>+{conv.whatsapp_number}</span>
              <span style={{ fontSize: 9, color: conv.status === 'escalated' ? '#EF4444' : conv.status === 'resolved' ? '#10B981' : '#F59E0B', letterSpacing: 1 }}>{conv.status.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 10, color: '#444' }}>{new Date(conv.updated_at).toLocaleString()}</div>
          </div>
        ))}
        {conversations.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#333', fontSize: 11 }}>No conversations yet</div>
        )}
      </div>

      {/* Messages */}
      <div style={{ background: '#0A0A0A', display: 'flex', flexDirection: 'column' }}>
        {selectedConv ? (
          <>
            <div style={{ padding: '16px 24px', background: '#111', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#3B82F6' }}>+{selectedConv.whatsapp_number}</span>
              <span style={{ fontSize: 9, color: '#444', letterSpacing: 1 }}>{selectedConv.messages.length} MESSAGES</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedConv.messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '70%', background: msg.role === 'user' ? '#111' : 'rgba(255,69,0,0.1)', border: `1px solid ${msg.role === 'user' ? '#1a1a1a' : 'rgba(255,69,0,0.2)'}`, padding: '12px 16px' }}>
                    <div style={{ fontSize: 9, color: msg.role === 'user' ? '#3B82F6' : '#FF4500', letterSpacing: 1, marginBottom: 6 }}>{msg.role === 'user' ? 'CUSTOMER' : 'AI AGENT'}</div>
                    <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    <div style={{ fontSize: 9, color: '#333', marginTop: 6 }}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222', fontSize: 12 }}>
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  )
}

// Orders Component  
function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch_ = async () => {
      const res = await fetch('/api/orders')
      const data = await res.json()
      setOrders(data.data || [])
      setLoading(false)
    }
    fetch_()
  }, [])

  const updateOrderStatus = async (id: string, status: string) => {
    await fetch('/api/orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    const res = await fetch('/api/orders')
    const data = await res.json()
    setOrders(data.data || [])
  }

  if (loading) return <div style={{ color: '#444', fontSize: 12, textAlign: 'center', padding: 48 }}>Loading orders...</div>

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#0A0A0A', borderBottom: '1px solid #1a1a1a' }}>
            {['ORDER #', 'CUSTOMER', 'ITEMS', 'TOTAL', 'STATUS', 'PAYMENT', 'DATE', 'ACTION'].map((h) => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 9, color: '#444', letterSpacing: 2 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="row-hover" style={{ borderBottom: '1px solid #111' }}>
              <td style={{ padding: '12px 16px', fontSize: 11, color: '#FF4500' }}>#{order.order_number}</td>
              <td style={{ padding: '12px 16px', fontSize: 11, color: '#3B82F6' }}>+{order.whatsapp_number}</td>
              <td style={{ padding: '12px 16px', fontSize: 11, color: '#666' }}>{order.items?.length || 0} items</td>
              <td style={{ padding: '12px 16px', fontSize: 13, color: '#10B981', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>LKR {Number(order.total).toLocaleString()}</td>
              <td style={{ padding: '12px 16px' }}>
                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                  style={{ background: '#0A0A0A', border: '1px solid #222', color: statusColors[order.status] || '#666', fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, padding: '4px 8px' }}
                >
                  {['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'].map((s) => (
                    <option key={s} value={s}>{s.toUpperCase()}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span style={{ fontSize: 9, padding: '3px 8px', background: order.payment_status === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: order.payment_status === 'paid' ? '#10B981' : '#EF4444', letterSpacing: 1 }}>
                  {order.payment_status?.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '12px 16px', fontSize: 10, color: '#444' }}>{new Date(order.created_at).toLocaleDateString()}</td>
              <td style={{ padding: '12px 16px', fontSize: 10, color: '#555' }}>—</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#333', fontSize: 12 }}>No orders yet</div>
      )}
    </div>
  )
}