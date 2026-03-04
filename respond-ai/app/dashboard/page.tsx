'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import type { Order, InventoryItem, InquiryLog, Conversation } from '@/lib/supabase'

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
  recentInquiries: InquiryLog[]
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
  const router = useRouter()
  const { user, isAuthenticated, loading: authLoading, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'conversations' | 'orders'>('overview')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [inventorySearch, setInventorySearch] = useState('')
  const [showAddPart, setShowAddPart] = useState(false)
  const [newPart, setNewPart] = useState({ part_number: '', name: '', brand: '', category: '', price: '', quantity: '', low_stock_threshold: '5', description: '', supplier: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

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

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading || authLoading) {
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
          <div style={{ background: '#FF4500', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 2, color: '#FF4500' }}>BUSINESS INVENTORY AI</div>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 1 }}>INVENTORY & WHATSAPP CONVERSATION CONSOLE</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }}>
            <span style={{ fontSize: 11, color: '#10B981', letterSpacing: 1 }}>AI ACTIVE</span>
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                background: 'none',
                border: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.9rem',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
              }}
            >
              👤 {user?.name || user?.email || 'User'}
            </button>
            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                  minWidth: '200px',
                  zIndex: 1000,
                }}
              >
                <a
                  href="/api-keys"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    display: 'block',
                    padding: '0.75rem 1rem',
                    color: '#fff',
                    textDecoration: 'none',
                    borderBottom: '1px solid #333',
                    fontSize: '0.9rem',
                  }}
                >
                  🔑 API Keys
                </a>
                <a
                  href="/supplies"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    display: 'block',
                    padding: '0.75rem 1rem',
                    color: '#fff',
                    textDecoration: 'none',
                    borderBottom: '1px solid #333',
                    fontSize: '0.9rem',
                  }}
                >
                  📦 Supply Tracking
                </a>
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    handleLogout()
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    color: '#EF4444',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
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
        {/* Overview and other tabs content would go here */}
        {activeTab === 'overview' && stats && (
          <div style={{ color: '#999' }}>Dashboard content loaded. View tabs for inventory, conversations, and orders.</div>
        )}
      </div>
    </div>
  )
}
