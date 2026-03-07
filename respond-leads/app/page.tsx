'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { InventoryItem, Conversation } from '@/types'
import { CurrencyService } from '@/lib/currency'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import BulkOperations from '@/components/BulkOperations'
import NotificationCenter from '@/components/NotificationCenter'
import ForecastingDashboard from '@/components/ForecastingDashboard'
import ReportingDashboard from '@/components/ReportingDashboard'
import WhatsAppDashboard from '@/components/WhatsAppDashboard'
import WhatsAppChat from '@/components/WhatsAppChat'

type Tab = 'inventory' | 'conversations' | 'analytics' | 'bulk-ops' | 'forecasting' | 'reporting' | 'whatsapp-dashboard' | 'whatsapp-chat'
type Modal = 'add' | 'edit' | null

const EMPTY_ITEM: InventoryItem = { name: '', sku: '', quantity: 0, price: 0, currency: 'USD', price_usd: 0 }

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('inventory')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [form, setForm] = useState<InventoryItem>(EMPTY_ITEM)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [currentCurrency, setCurrentCurrency] = useState(CurrencyService.getCurrentCurrency())
  const [searchCurrency, setSearchCurrency] = useState('')

  const supabase = getSupabaseClient()

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('inventory').select('*').order('name')
    if (search) query = query.ilike('name', `%${search}%`)
    const { data } = await query
    setItems(data || [])
    setLoading(false)
  }, [search])

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
    setConversations(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'inventory') fetchInventory()
    else fetchConversations()
  }, [tab, fetchInventory, fetchConversations])

  // ─── Inventory CRUD ────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ ...EMPTY_ITEM, currency: CurrencyService.getCurrentCurrency() })
    setEditId(null)
    setModal('add')
  }

  const openEdit = (item: InventoryItem) => {
    setForm({ name: item.name, sku: item.sku, quantity: item.quantity, price: item.price, currency: item.currency, price_usd: item.price_usd })
    setEditId(item.id!)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name || !form.sku) return showToast('Name and SKU are required')
    setSaving(true)
    try {
      if (modal === 'add') {
        const { error } = await supabase.from('inventory').insert(form)
        if (error) throw error
        showToast('Item added')
      } else {
        const { error } = await supabase.from('inventory').update(form).eq('id', editId)
        if (error) throw error
        showToast('Item updated')
      }
      setModal(null)
      fetchInventory()
    } catch (e: unknown) {
      showToast('Error saving: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (error) return showToast('Delete failed')
    setDeleteConfirm(null)
    showToast('Item deleted')
    fetchInventory()
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ─── Parse conversation history into messages ──────────────────────────────
  const parseHistory = (history: string) => {
    return history.split('\n')
      .filter(line => line.trim())
      .map(line => {
        if (line.startsWith('[Customer]:')) return { role: 'customer', text: line.replace('[Customer]:', '').trim() }
        if (line.startsWith('[Assistant]:')) return { role: 'assistant', text: line.replace('[Assistant]:', '').trim() }
        return null
      })
      .filter(Boolean)
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const totalItems = items.length
  const lowStock = items.filter(i => i.quantity <= 5 && i.quantity > 0).length
  const outOfStock = items.filter(i => i.quantity === 0).length
  const totalValue = items.reduce((sum, i) => sum + (i.price_usd * i.quantity), 0)

  const handleCurrencyChange = (currencyCode: string) => {
    setCurrentCurrency(currencyCode)
    CurrencyService.setCurrentCurrency(currencyCode)
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <style>{css}</style>

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerBrand}>
          <div style={s.brandMark}>▣</div>
          <div>
            <div style={s.brandName}>INVENTORY MANAGER</div>
            <div style={s.brandSub}>WHATSAPP AI SYSTEM</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Currency Selector */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            padding: '4px 8px'
          }}>
            <select 
              value={currentCurrency} 
              onChange={(e) => handleCurrencyChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#e5e5e5',
                fontSize: '12px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {Object.entries(CurrencyService.getAvailableCurrencies()).map(([code, currency]) => (
                <option key={code} value={code} style={{ background: '#1a1a1a' }}>
                  {currency.code} ({currency.symbol})
                </option>
              ))}
            </select>
          </div>
          <div style={s.headerStatus}>
            <div style={s.statusDot} />
            <span style={s.statusText}>LIVE</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['inventory', 'conversations', 'analytics', 'bulk-ops', 'forecasting', 'reporting', 'whatsapp-dashboard', 'whatsapp-chat'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="tab"
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
          >
            {t === 'inventory' ? '▣ INVENTORY' : 
             t === 'conversations' ? '◎ CONVERSATIONS' :
             t === 'analytics' ? '📊 ANALYTICS' :
             t === 'bulk-ops' ? '⚙️ BULK OPS' :
             t === 'forecasting' ? '🔮 FORECASTING' :
             t === 'reporting' ? '📋 REPORTING' :
             t === 'whatsapp-dashboard' ? '📱 WHATSAPP DASHBOARD' :
             '💬 WHATSAPP CHAT'}
          </button>
        ))}
      </div>

      <main style={s.main}>

        {/* ── INVENTORY TAB ── */}
        {tab === 'inventory' && (
          <div>
            {/* Stats row */}
            <div style={s.statsRow}>
              {[
                { label: 'TOTAL SKUs', value: totalItems, color: '#E8FF47' },
                { label: 'INVENTORY VALUE', value: CurrencyService.formatPrice(totalValue, currentCurrency), color: '#E8FF47' },
                { label: 'LOW STOCK', value: lowStock, color: '#F59E0B' },
                { label: 'OUT OF STOCK', value: outOfStock, color: '#EF4444' },
              ].map(stat => (
                <div key={stat.label} style={s.statCard}>
                  <div style={s.statLabel}>{stat.label}</div>
                  <div style={{ ...s.statValue, color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={s.toolbar}>
              <input
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchInventory()}
                style={s.searchInput}
              />
              <button onClick={fetchInventory} style={s.ghostBtn}>SEARCH</button>
              <button onClick={openAdd} style={s.primaryBtn}>+ ADD ITEM</button>
            </div>

            {/* Table */}
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['NAME', 'SKU', 'QUANTITY', 'PRICE', 'CURRENCY', 'STATUS', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={s.emptyCell}>Loading...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={7} style={s.emptyCell}>No items found. Add your first item.</td></tr>
                  ) : items.map(item => (
                    <tr key={item.id} className="tr-hover">
                      <td style={s.td}>{item.name}</td>
                      <td style={{ ...s.td, color: '#666', fontSize: 11 }}>{item.sku}</td>
                      <td style={{ ...s.td, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: item.quantity === 0 ? '#EF4444' : item.quantity <= 5 ? '#F59E0B' : '#E8FF47' }}>
                        {item.quantity}
                      </td>
                      <td style={{ ...s.td, color: '#aaa' }}>{CurrencyService.formatPrice(item.price, item.currency)}</td>
                      <td style={{ ...s.td, color: '#888', fontSize: 11 }}>{item.currency}</td>
                      <td style={s.td}>
                        <span style={{
                          ...s.badge,
                          background: item.quantity === 0 ? 'rgba(239,68,68,0.1)' : item.quantity <= 5 ? 'rgba(245,158,11,0.1)' : 'rgba(232,255,71,0.08)',
                          color: item.quantity === 0 ? '#EF4444' : item.quantity <= 5 ? '#F59E0B' : '#E8FF47',
                          borderColor: item.quantity === 0 ? 'rgba(239,68,68,0.2)' : item.quantity <= 5 ? 'rgba(245,158,11,0.2)' : 'rgba(232,255,71,0.15)',
                        }}>
                          {item.quantity === 0 ? 'OUT OF STOCK' : item.quantity <= 5 ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                      <td style={{ ...s.td, display: 'flex', gap: 8 }}>
                        <button onClick={() => openEdit(item)} className="action-btn" style={s.editBtn}>EDIT</button>
                        {deleteConfirm === item.id ? (
                          <>
                            <button onClick={() => handleDelete(item.id!)} style={s.deleteConfirmBtn}>CONFIRM</button>
                            <button onClick={() => setDeleteConfirm(null)} style={s.cancelBtn}>✕</button>
                          </>
                        ) : (
                          <button onClick={() => setDeleteConfirm(item.id!)} className="action-btn" style={s.deleteBtn}>DEL</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CONVERSATIONS TAB ── */}
        {tab === 'conversations' && (
          <div style={s.convoLayout}>
            {/* List */}
            <div style={s.convoList}>
              <div style={s.convoListHeader}>
                {conversations.length} CONVERSATIONS
              </div>
              {loading ? (
                <div style={s.convoEmpty}>Loading...</div>
              ) : conversations.length === 0 ? (
                <div style={s.convoEmpty}>No conversations yet. WhatsApp messages will appear here automatically.</div>
              ) : conversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConvo(c)}
                  className="convo-item"
                  style={{
                    ...s.convoItem,
                    ...(selectedConvo?.id === c.id ? s.convoItemActive : {}),
                  }}
                >
                  <div style={s.convoName}>{c.customer_name || 'Unknown'}</div>
                  <div style={s.convoPhone}>+{c.phone_number}</div>
                  <div style={s.convoTime}>
                    {new Date(c.updated_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {/* Messages */}
            <div style={s.convoMessages}>
              {selectedConvo ? (
                <>
                  <div style={s.convoHeader}>
                    <div>
                      <div style={s.convoHeaderName}>{selectedConvo.customer_name || 'Unknown Customer'}</div>
                      <div style={s.convoHeaderPhone}>+{selectedConvo.phone_number}</div>
                    </div>
                    <div style={s.convoHeaderTime}>
                      Last active: {new Date(selectedConvo.updated_at || '').toLocaleString()}
                    </div>
                  </div>
                  <div style={s.messageList}>
                    {parseHistory(selectedConvo.history).map((msg, i) => msg && (
                      <div key={i} style={{
                        ...s.messageBubble,
                        alignSelf: msg.role === 'customer' ? 'flex-start' : 'flex-end',
                        background: msg.role === 'customer' ? '#161616' : 'rgba(232,255,71,0.06)',
                        borderColor: msg.role === 'customer' ? '#1E1E1E' : 'rgba(232,255,71,0.15)',
                      }}>
                        <div style={{ fontSize: 9, color: msg.role === 'customer' ? '#555' : '#E8FF47', letterSpacing: 1, marginBottom: 6 }}>
                          {msg.role === 'customer' ? '◎ CUSTOMER' : '▣ AI ASSISTANT'}
                        </div>
                        <div style={s.messageText}>{msg.text}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={s.convoPlaceholder}>
                  <div style={s.convoPlaceholderIcon}>◎</div>
                  <div style={s.convoPlaceholderText}>Select a conversation</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab === 'analytics' && (
          <AnalyticsDashboard />
        )}

        {/* ── BULK OPERATIONS TAB ── */}
        {tab === 'bulk-ops' && (
          <BulkOperations onRefresh={fetchInventory} />
        )}

        {/* ── FORECASTING TAB ── */}
        {tab === 'forecasting' && (
          <ForecastingDashboard />
        )}

        {/* ── REPORTING TAB ── */}
        {tab === 'reporting' && (
          <ReportingDashboard />
        )}

        {/* ── WHATSAPP DASHBOARD TAB ── */}
        {tab === 'whatsapp-dashboard' && (
          <WhatsAppDashboard />
        )}

        {/* ── WHATSAPP CHAT TAB ── */}
        {tab === 'whatsapp-chat' && (
          <WhatsAppChat />
        )}
      </main>

      {/* ── MODAL ── */}
      {modal && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalTitle}>
              {modal === 'add' ? '+ ADD ITEM' : 'EDIT ITEM'}
            </div>

            <div style={s.modalGrid}>
              <div style={s.modalField}>
                <label style={s.modalLabel}>CURRENCY</label>
                <input
                  type="search"
                  value={searchCurrency}
                  onChange={e => setSearchCurrency(e.target.value)}
                  placeholder="Search currency..."
                  style={{ ...s.modalInput, width: '100%', marginBottom: 10 }}
                />
                <select
                  value={form.currency}
                  onChange={e => setForm({ ...form, currency: e.target.value })}
                  style={{ ...s.modalInput, cursor: 'pointer' }}
                >
                  <optgroup label="Major Global Currencies">
                    {['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Americas">
                    {['CAD', 'AUD', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Europe">
                    {['CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'RUB', 'TRY'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Asia & Middle East">
                    {['KRW', 'TWD', 'HKD', 'SGD', 'MYR', 'THB', 'VND', 'PHP', 'IDR', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'JOD', 'LKR', 'PKR', 'BDT', 'NPR', 'AFN', 'MMK', 'LAK', 'KHR', 'MVR', 'BTN', 'GEL', 'AMD', 'AZN', 'KZT', 'KGS', 'UZS', 'TJS', 'TMT', 'MNT', 'KPW'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Africa">
                    {['ZAR', 'NGN', 'GHS', 'KES', 'UGX', 'TZS', 'EGP', 'MAD', 'DZD', 'TND'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Oceania">
                    {['NZD', 'FJD', 'PGK', 'SBD', 'VUV', 'WST', 'TOP'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                  <optgroup label="Cryptocurrencies">
                    {['BTC', 'ETH', 'USDT'].map(code => {
                      const currency = CurrencyService.getCurrencyInfo(code)
                      return (
                        <option key={code} value={code}>
                          {currency.code} ({currency.symbol}) - {currency.name}
                        </option>
                      )
                    })}
                  </optgroup>
                </select>
              </div>
              {[
                { key: 'name', label: 'PRODUCT NAME *', type: 'text', placeholder: 'Nike Air Max 90' },
                { key: 'sku', label: 'SKU *', type: 'text', placeholder: 'SKU-4821' },
                { key: 'price', label: `PRICE (${CurrencyService.getCurrencyInfo(form.currency).symbol})`, type: 'number', placeholder: '0.00' },
                { key: 'quantity', label: 'QUANTITY', type: 'number', placeholder: '0' },
              ].map(field => (
                <div key={field.key} style={s.modalField}>
                  <label style={s.modalLabel}>{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof InventoryItem] as string}
                    onChange={e => setForm({ ...form, [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                    placeholder={field.placeholder}
                    style={s.modalInput}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                  />
                </div>
              ))}
            </div>

            <div style={s.modalActions}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'SAVING...' : modal === 'add' ? 'ADD ITEM' : 'SAVE CHANGES'}
              </button>
              <button onClick={() => setModal(null)} style={s.ghostBtn}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Notification Center */}
      <NotificationCenter />
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: { 
    minHeight: '100vh', 
    background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)', 
    color: '#e5e5e5', 
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    position: 'relative'
  },
  
  toast: { 
    position: 'fixed', 
    top: 24, 
    right: 24, 
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
    color: '#ffffff', 
    padding: '12px 20px', 
    fontSize: 12, 
    fontWeight: 600, 
    zIndex: 999, 
    animation: 'slideIn 0.3s ease',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
  },

  header: { 
    background: 'linear-gradient(135deg, rgba(15, 15, 15, 0.8), rgba(26, 26, 26, 0.8))', 
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(139, 92, 246, 0.2)', 
    padding: '24px 32px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  
  headerBrand: { display: 'flex', alignItems: 'center', gap: 16 },
  brandMark: { fontSize: 28, color: '#8b5cf6', fontWeight: 700 },
  brandName: { fontFamily: "'Inter', sans-serif", fontSize: 20, fontWeight: 800, color: '#ffffff', letterSpacing: 1 },
  brandSub: { fontSize: 11, color: '#a78bfa', letterSpacing: 1, marginTop: 2, fontWeight: 500 },
  headerStatus: { display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' },
  statusText: { fontSize: 10, color: '#10b981', letterSpacing: 1, fontWeight: 600 },

  tabs: { 
    background: 'linear-gradient(135deg, rgba(15, 15, 15, 0.6), rgba(26, 26, 26, 0.6))', 
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(139, 92, 246, 0.2)', 
    padding: '0 32px', 
    display: 'flex',
    position: 'sticky',
    top: 89,
    zIndex: 90
  },
  
  tab: { 
    background: 'none', 
    border: 'none', 
    color: '#6b7280', 
    fontSize: 12, 
    fontWeight: 600, 
    padding: '16px 24px', 
    cursor: 'pointer', 
    borderBottom: '3px solid transparent', 
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '12px 12px 0 0',
    margin: '0 2px'
  },
  
  tabActive: { 
    color: '#ffffff', 
    borderBottom: '3px solid #8b5cf6',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))'
  },

  main: { 
    padding: '32px', 
    animation: 'fadeIn 0.4s ease',
    minHeight: 'calc(100vh - 180px)'
  },

  statsRow: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(4, 1fr)', 
    gap: 20, 
    marginBottom: 32 
  },
  
  statCard: { 
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))', 
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)', 
    padding: '24px', 
    borderRadius: '16px',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },
  
  statLabel: { 
    fontSize: 11, 
    color: '#a78bfa', 
    fontWeight: 600, 
    marginBottom: 8, 
    textTransform: 'uppercase',
    letterSpacing: 1 
  },
  
  statValue: { 
    fontFamily: "'Inter', sans-serif", 
    fontSize: 28, 
    fontWeight: 800, 
    color: '#ffffff',
    lineHeight: 1.2
  },

  toolbar: { 
    display: 'flex', 
    gap: 12, 
    marginBottom: 24, 
    alignItems: 'center', 
    flexWrap: 'wrap' 
  },
  
  searchInput: { 
    background: 'rgba(255, 255, 255, 0.05)', 
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.3)', 
    color: '#e5e5e5', 
    padding: '12px 16px', 
    fontSize: 14, 
    width: 320, 
    transition: 'all 0.3s ease', 
    flex: 1, 
    minWidth: 200,
    borderRadius: '12px'
  },
  
  primaryBtn: { 
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
    border: 'none', 
    color: '#ffffff', 
    padding: '12px 24px', 
    fontSize: 12, 
    fontWeight: 600, 
    cursor: 'pointer', 
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
    whiteSpace: 'nowrap',
    borderRadius: '12px',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
  },
  
  ghostBtn: { 
    background: 'rgba(255, 255, 255, 0.05)', 
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.3)', 
    color: '#e5e5e5', 
    padding: '12px 24px', 
    fontSize: 12, 
    fontWeight: 600, 
    cursor: 'pointer', 
    transition: 'all 0.3s ease', 
    whiteSpace: 'nowrap',
    borderRadius: '12px'
  },

  tableWrap: { 
    background: 'rgba(255, 255, 255, 0.02)', 
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)', 
    overflow: 'hidden', 
    overflowX: 'auto',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
  },
  
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 600 },
  th: { 
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))', 
    padding: '16px', 
    textAlign: 'left' as const, 
    fontSize: 11, 
    color: '#a78bfa', 
    fontWeight: 700, 
    borderBottom: '1px solid rgba(139, 92, 246, 0.3)', 
    position: 'sticky', 
    top: 0, 
    zIndex: 10,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  
  td: { 
    padding: '16px', 
    fontSize: 13, 
    borderBottom: '1px solid rgba(139, 92, 246, 0.1)', 
    verticalAlign: 'middle' as const,
    color: '#e5e5e5'
  },
  
  emptyCell: { 
    padding: '48px 16px', 
    textAlign: 'center' as const, 
    color: '#6b7280', 
    fontSize: 13,
    fontStyle: 'italic'
  },
  
  badge: { 
    fontSize: 10, 
    fontWeight: 600, 
    padding: '4px 10px', 
    border: '1px solid', 
    borderRadius: '8px', 
    whiteSpace: 'nowrap',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  
  editBtn: { 
    background: 'rgba(99, 102, 241, 0.1)', 
    border: '1px solid rgba(99, 102, 241, 0.3)', 
    color: '#818cf8', 
    padding: '6px 12px', 
    fontSize: 10, 
    fontWeight: 600, 
    cursor: 'pointer', 
    transition: 'all 0.3s ease', 
    borderRadius: '8px'
  },
  
  deleteBtn: { 
    background: 'rgba(239, 68, 68, 0.1)', 
    border: '1px solid rgba(239, 68, 68, 0.3)', 
    color: '#f87171', 
    padding: '6px 12px', 
    fontSize: 10, 
    fontWeight: 600, 
    cursor: 'pointer', 
    transition: 'all 0.3s ease', 
    borderRadius: '8px'
  },
  
  deleteConfirmBtn: { 
    background: 'rgba(239,68,68,0.2)', 
    border: '1px solid rgba(239,68,68,0.5)', 
    color: '#ef4444', 
    padding: '6px 12px', 
    fontSize: 10, 
    fontWeight: 600,
    cursor: 'pointer', 
    borderRadius: '8px'
  },
  
  cancelBtn: { 
    background: 'rgba(107, 114, 128, 0.1)', 
    border: '1px solid rgba(107, 114, 128, 0.3)', 
    color: '#9ca3af', 
    padding: '6px 12px', 
    fontSize: 10, 
    fontWeight: 600,
    cursor: 'pointer', 
    borderRadius: '8px'
  },

  convoLayout: { 
    display: 'grid', 
    gridTemplateColumns: '300px 1fr', 
    gap: 0, 
    border: '1px solid rgba(139, 92, 246, 0.2)', 
    height: 'calc(100vh - 220px)', 
    overflow: 'hidden',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(10px)'
  },
  
  convoList: { 
    borderRight: '1px solid rgba(139, 92, 246, 0.2)', 
    overflow: 'auto', 
    background: 'rgba(255, 255, 255, 0.01)'
  },
  
  convoListHeader: { 
    padding: '16px 20px', 
    fontSize: 11, 
    color: '#a78bfa', 
    fontWeight: 700, 
    borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  
  convoEmpty: { 
    padding: 32, 
    fontSize: 12, 
    color: '#6b7280', 
    lineHeight: 1.6,
    textAlign: 'center' as const
  },
  
  convoItem: { 
    padding: '16px 20px', 
    borderBottom: '1px solid rgba(139, 92, 246, 0.1)', 
    transition: 'all 0.3s ease', 
    borderLeft: '3px solid transparent', 
    cursor: 'pointer'
  },
  
  convoItemActive: { 
    background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))', 
    borderLeftColor: '#8b5cf6'
  },
  
  convoName: { 
    fontSize: 13, 
    color: '#ffffff', 
    marginBottom: 4, 
    fontWeight: 600
  },
  
  convoPhone: { 
    fontSize: 11, 
    color: '#6b7280', 
    marginBottom: 4 
  },
  
  convoTime: { 
    fontSize: 10, 
    color: '#9ca3af', 
    fontWeight: 500
  },

  convoMessages: { 
    display: 'flex', 
    flexDirection: 'column', 
    overflow: 'hidden', 
    background: 'rgba(255, 255, 255, 0.005)'
  },
  
  convoHeader: { 
    padding: '20px 24px', 
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))', 
    borderBottom: '1px solid rgba(139, 92, 246, 0.2)', 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    flexWrap: 'wrap'
  },
  
  convoHeaderName: { 
    fontSize: 15, 
    color: '#ffffff', 
    marginBottom: 2, 
    fontWeight: 700
  },
  
  convoHeaderPhone: { 
    fontSize: 12, 
    color: '#6b7280' 
  },
  
  convoHeaderTime: { 
    fontSize: 11, 
    color: '#9ca3af',
    fontWeight: 500
  },
  
  messageList: { 
    flex: 1, 
    overflow: 'auto', 
    padding: 24, 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 16 
  },
  
  messageBubble: { 
    maxWidth: '70%', 
    padding: '12px 16px', 
    border: '1px solid rgba(139, 92, 246, 0.2)', 
    borderRadius: '16px', 
    wordBreak: 'break-word',
    backdropFilter: 'blur(10px)'
  },
  
  messageText: { 
    fontSize: 13, 
    lineHeight: 1.6, 
    color: '#e5e5e5' 
  },
  
  convoPlaceholder: { 
    flex: 1, 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 16 
  },
  
  convoPlaceholderIcon: { 
    fontSize: 48, 
    color: '#4b5563' 
  },
  
  convoPlaceholderText: { 
    fontSize: 13, 
    color: '#6b7280', 
    fontWeight: 500 
  },

  overlay: { 
    position: 'fixed', 
    inset: 0, 
    background: 'rgba(0, 0, 0, 0.8)', 
    backdropFilter: 'blur(10px)',
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 200, 
    padding: 20 
  },
  
  modalCard: { 
    background: 'linear-gradient(135deg, rgba(15, 15, 15, 0.95), rgba(26, 26, 26, 0.95))', 
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(139, 92, 246, 0.3)', 
    padding: '40px', 
    width: 520, 
    maxWidth: '95vw', 
    animation: 'fadeIn 0.3s ease', 
    borderRadius: '20px', 
    maxHeight: '90vh', 
    overflow: 'auto',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
  },
  
  modalTitle: { 
    fontFamily: "'Inter', sans-serif", 
    fontSize: 22, 
    fontWeight: 800, 
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: 32, 
    letterSpacing: -0.5
  },
  
  modalGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: 24, 
    marginBottom: 32 
  },
  
  modalField: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 8 
  },
  
  modalLabel: { 
    fontSize: 11, 
    color: '#a78bfa', 
    fontWeight: 600, 
    textTransform: 'uppercase',
    letterSpacing: 1 
  },
  
  modalInput: { 
    background: 'rgba(255, 255, 255, 0.05)', 
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.3)', 
    color: '#e5e5e5', 
    padding: '12px 16px', 
    fontSize: 14, 
    width: '100%', 
    transition: 'all 0.3s ease', 
    borderRadius: '12px'
  },
  
  modalActions: { 
    display: 'flex', 
    gap: 12, 
    flexWrap: 'wrap' 
  },
}

// ─── CSS ──────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@300;400;500;600;700&family=Geist:wght@300;400;500;600;700;800&display=swap');
  
  * { 
    box-sizing: border-box; 
    margin: 0; 
    padding: 0; 
  }
  
  body { 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
    color: #e5e5e5;
    line-height: 1.6;
  }
  
  ::-webkit-scrollbar { 
    width: 8px; 
    height: 8px; 
  }
  
  ::-webkit-scrollbar-track { 
    background: rgba(255, 255, 255, 0.05); 
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb { 
    background: linear-gradient(135deg, #6366f1, #8b5cf6); 
    border-radius: 4px;
    transition: background 0.2s;
  }
  
  ::-webkit-scrollbar-thumb:hover { 
    background: linear-gradient(135deg, #818cf8, #a78bfa); 
  }
  
  input, button, select, textarea { 
    font-family: 'Inter', sans-serif; 
    outline: none;
    border: none;
  }
  
  /* Animations */
  @keyframes fadeIn { 
    from { opacity: 0; transform: translateY(10px); } 
    to { opacity: 1; transform: translateY(0); } 
  }
  
  @keyframes slideIn { 
    from { opacity: 0; transform: translateX(-20px); } 
    to { opacity: 1; transform: translateX(0); } 
  }
  
  @keyframes pulse { 
    0%, 100% { opacity: 1; transform: scale(1); } 
    50% { opacity: 0.8; transform: scale(1.05); } 
  }
  
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  
  /* Utility Classes */
  .tab:hover { 
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    color: #a78bfa !important;
    transform: translateY(-1px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .tr-hover:hover { 
    background: linear-gradient(90deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
    transform: scale(1.01);
    transition: all 0.2s ease;
  }
  
  .action-btn:hover { 
    background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; 
    color: #ffffff !important; 
    border-color: transparent !important;
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .convo-item:hover { 
    background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08));
    cursor: pointer;
    transform: translateX(4px);
    transition: all 0.3s ease;
  }
  
  .currency-selector {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10;
  }
  
  .currency-selector select {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #e5e5e5;
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }
  
  .currency-selector select:hover {
    border-color: rgba(139, 92, 246, 0.5);
    transform: translateY(-1px);
  }
  
  .currency-selector select:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .stats-row { 
      grid-template-columns: repeat(2, 1fr) !important; 
      gap: 20px !important;
    }
    .modal-grid { 
      grid-template-columns: 1fr !important; 
    }
    .modal-card { 
      width: 90vw !important; 
      max-height: 90vh;
    }
  }

  @media (max-width: 768px) {
    .header { 
      padding: 20px !important; 
      flex-direction: column; 
      gap: 16px !important;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
      backdrop-filter: blur(20px);
    }
    .header-brand { 
      font-size: 16px !important; 
    }
    .brand-name { 
      font-size: 18px !important; 
      font-weight: 700;
    }
    .brand-sub { 
      font-size: 10px !important; 
      opacity: 0.7;
    }
    .tabs { 
      padding: 0 20px !important; 
      overflow-x: auto; 
      scrollbar-width: thin;
      scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
    }
    .tab { 
      padding: 12px 20px !important; 
      font-size: 12px !important; 
      font-weight: 600;
      border-radius: 12px 12px 0 0;
      margin: 0 2px;
    }
    .main { 
      padding: 24px !important; 
    }
    .stats-row { 
      grid-template-columns: 1fr !important; 
      gap: 16px !important; 
    }
    .stat-card { 
      padding: 20px !important; 
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05));
      backdrop-filter: blur(10px);
    }
    .stat-value { 
      font-size: 24px !important; 
      font-weight: 700;
    }
    .toolbar { 
      flex-direction: column !important; 
      gap: 12px !important;
    }
    .search-input { 
      width: 100% !important; 
      margin-bottom: 0 !important;
      padding: 12px 16px !important;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(139, 92, 246, 0.2);
      color: #e5e5e5;
      font-size: 14px;
    }
    .search-input:focus {
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }
    .table-wrap { 
      overflow-x: auto !important; 
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .table { 
      min-width: 600px !important; 
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(10px);
    }
    .th, .td { 
      padding: 12px 16px !important; 
      font-size: 12px !important;
      border-bottom: 1px solid rgba(139, 92, 246, 0.1);
    }
    .th {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
      font-weight: 600;
      color: #a78bfa;
    }
    .modal-card { 
      width: 95vw !important; 
      padding: 32px !important; 
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(15, 15, 15, 0.95), rgba(26, 26, 26, 0.95));
      backdrop-filter: blur(20px);
      border: 1px solid rgba(139, 92, 246, 0.2);
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-title { 
      font-size: 20px !important; 
      font-weight: 700;
      margin-bottom: 24px !important;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .modal-grid { 
      grid-template-columns: 1fr !important; 
      gap: 20px !important; 
    }
    .modal-actions { 
      flex-direction: column !important; 
      gap: 12px !important;
    }
    .primary-btn, .ghost-btn { 
      width: 100% !important; 
      padding: 14px 24px !important;
      border-radius: 12px;
      font-weight: 600;
      transition: all 0.3s ease;
    }
    .primary-btn {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    }
    .ghost-btn {
      background: rgba(255, 255, 255, 0.05);
      color: #e5e5e5;
      border: 1px solid rgba(139, 92, 246, 0.3);
    }
    .convo-layout { 
      grid-template-columns: 1fr !important; 
      height: auto !important; 
      border-radius: 16px;
      overflow: hidden;
    }
    .convo-list { 
      height: 250px !important; 
      border-right: none !important; 
      border-bottom: 1px solid rgba(139, 92, 246, 0.2) !important;
      background: rgba(255, 255, 255, 0.02);
    }
    .convo-messages { 
      min-height: 450px !important; 
    }
    .convo-header { 
      padding: 16px !important; 
    }
    .convo-header-name { 
      font-size: 14px !important; 
    }
    .convo-header-phone { 
      font-size: 11px !important; 
    }
    .message-list { 
      padding: 16px !important; 
    }
    .message-bubble { 
      max-width: 85% !important; 
      padding: 12px 16px !important; 
    }
    .message-text { 
      font-size: 12px !important; 
    }
    .toast { 
      top: 16px !important; 
      right: 16px !important; 
      padding: 12px 20px !important; 
      font-size: 12px !important; 
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    }
  }

  @media (max-width: 480px) {
    .header { 
      padding: 16px !important; 
    }
    .brand-name { 
      font-size: 16px !important; 
    }
    .brand-sub { 
      font-size: 9px !important; 
    }
    .tabs { 
      padding: 0 16px !important; 
    }
    .tab { 
      padding: 10px 16px !important; 
      font-size: 11px !important; 
    }
    .main { 
      padding: 16px !important; 
    }
    .stats-row { 
      gap: 12px !important; 
    }
    .stat-card { 
      padding: 16px !important; 
      border-radius: 12px;
    }
    .stat-value { 
      font-size: 20px !important; 
    }
    .stat-label { 
      font-size: 10px !important; 
    }
    .toolbar { 
      gap: 8px !important; 
    }
    .search-input { 
      padding: 10px 14px !important; 
      font-size: 13px !important; 
    }
    .primary-btn, .ghost-btn { 
      padding: 12px 20px !important; 
      font-size: 13px !important; 
    }
    .th, .td { 
      padding: 10px 12px !important; 
      font-size: 11px !important; 
    }
    .badge { 
      font-size: 9px !important; 
      padding: 4px 8px !important; 
      border-radius: 8px;
    }
    .edit-btn, .delete-btn { 
      padding: 6px 12px !important; 
      font-size: 10px !important; 
      border-radius: 8px;
    }
    .modal-card { 
      width: 98vw !important; 
      padding: 24px !important; 
      margin: 16px !important; 
      border-radius: 16px;
    }
    .modal-title { 
      font-size: 18px !important; 
      margin-bottom: 20px !important; 
    }
    .modal-grid { 
      gap: 16px !important; 
    }
    .modal-field { 
      gap: 6px !important; 
    }
    .modal-label { 
      font-size: 10px !important; 
    }
    .modal-input { 
      padding: 10px 14px !important; 
      font-size: 13px !important; 
      border-radius: 10px;
    }
    .convo-list { 
      height: 200px !important; 
    }
    .convo-messages { 
      min-height: 400px !important; 
    }
    .convo-header { 
      padding: 16px !important; 
    }
    .convo-header-name { 
      font-size: 14px !important; 
    }
    .convo-header-phone { 
      font-size: 11px !important; 
    }
    .message-list { 
      padding: 16px !important; 
    }
    .message-bubble { 
      max-width: 90% !important; 
      padding: 12px 16px !important; 
    }
    .message-text { 
      font-size: 12px !important; 
    }
    .toast { 
      top: 16px !important; 
      right: 16px !important; 
      padding: 12px 20px !important; 
      font-size: 12px !important; 
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
    }
  }

  @media (max-width: 320px) {
    .brand-name { 
      font-size: 14px !important; 
    }
    .tab { 
      padding: 8px 12px !important; 
      font-size: 10px !important; 
    }
    .stat-value { 
      font-size: 18px !important; 
    }
    .modal-card { 
      width: 100vw !important; 
      margin: 0 !important; 
      border-radius: 0 !important; 
      height: 100vh;
    }
    .modal-title { 
      font-size: 16px !important; 
      margin-bottom: 20px !important; 
    }
  }
`
