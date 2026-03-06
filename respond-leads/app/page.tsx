'use client'

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { InventoryItem, Conversation } from '@/types'
import { CurrencyService } from '@/lib/currency'

type Tab = 'inventory' | 'conversations'
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
        <div style={s.headerStatus}>
          <div style={s.statusDot} />
          <span style={s.statusText}>LIVE</span>
        </div>
      </header>

      {/* Currency Selector */}
      <div className="currency-selector">
        <select 
          value={currentCurrency} 
          onChange={(e) => handleCurrencyChange(e.target.value)}
        >
          {Object.entries(CurrencyService.getAvailableCurrencies()).map(([code, currency]) => (
            <option key={code} value={code}>
              {currency.code} ({currency.symbol})
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['inventory', 'conversations'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="tab"
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
          >
            {t === 'inventory' ? '▣ INVENTORY' : '◎ CONVERSATIONS'}
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
                    {['KRW', 'TWD', 'HKD', 'SGD', 'MYR', 'THB', 'VND', 'PHP', 'IDR', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'JOD'].map(code => {
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
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Mono', monospace; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #E8FF47; border-radius: 2px; }
  input, button, select { font-family: 'DM Mono', monospace; outline: none; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toastIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .tab:hover { color: #E8FF47 !important; }
  .tr-hover:hover { background: rgba(232,255,71,0.02) !important; }
  .action-btn:hover { background: #E8FF47 !important; color: #0C0C0C !important; border-color: #E8FF47 !important; }
  .convo-item:hover { background: rgba(232,255,71,0.03) !important; cursor: pointer; }
`

const s: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#0C0C0C', color: '#D4D4D4', fontFamily: "'DM Mono', monospace" },

  toast: { position: 'fixed', top: 24, right: 24, background: '#E8FF47', color: '#0C0C0C', padding: '10px 20px', fontSize: 11, letterSpacing: 1, fontWeight: 600, zIndex: 999, animation: 'toastIn 0.2s ease' },

  header: { background: '#0F0F0F', borderBottom: '1px solid #181818', padding: '18px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerBrand: { display: 'flex', alignItems: 'center', gap: 14 },
  brandMark: { fontSize: 24, color: '#E8FF47' },
  brandName: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: '#E8FF47', letterSpacing: 3 },
  brandSub: { fontSize: 9, color: '#2A2A2A', letterSpacing: 2, marginTop: 2 },
  headerStatus: { display: 'flex', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: '50%', background: '#22C55E', animation: 'pulse 2s infinite' },
  statusText: { fontSize: 9, color: '#22C55E', letterSpacing: 2 },

  tabs: { background: '#0F0F0F', borderBottom: '1px solid #141414', padding: '0 32px', display: 'flex' },
  tab: { background: 'none', border: 'none', color: '#3A3A3A', fontSize: 10, letterSpacing: 2, padding: '14px 24px', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.15s' },
  tabActive: { color: '#E8FF47', borderBottom: '2px solid #E8FF47' },

  main: { padding: 32, animation: 'fadeUp 0.3s ease' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 },
  statCard: { background: '#0F0F0F', border: '1px solid #181818', padding: '20px 24px' },
  statLabel: { fontSize: 9, color: '#333', letterSpacing: 2, marginBottom: 10 },
  statValue: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: -0.5 },

  toolbar: { display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  searchInput: { background: '#0F0F0F', border: '1px solid #1A1A1A', color: '#D4D4D4', padding: '10px 16px', fontSize: 12, width: 320, transition: 'border-color 0.2s', flex: 1, minWidth: 200 },
  primaryBtn: { background: '#E8FF47', border: 'none', color: '#0C0C0C', padding: '10px 20px', fontSize: 10, letterSpacing: 2, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  ghostBtn: { background: 'none', border: '1px solid #1A1A1A', color: '#555', padding: '10px 20px', fontSize: 10, letterSpacing: 2, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' },

  tableWrap: { border: '1px solid #141414', overflow: 'hidden', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 600 },
  th: { background: '#0A0A0A', padding: '11px 16px', textAlign: 'left' as const, fontSize: 9, color: '#2E2E2E', letterSpacing: 2, borderBottom: '1px solid #141414', position: 'sticky', top: 0, zIndex: 10 },
  td: { padding: '13px 16px', fontSize: 12, borderBottom: '1px solid #111', verticalAlign: 'middle' as const },
  emptyCell: { padding: '48px 16px', textAlign: 'center' as const, color: '#2A2A2A', fontSize: 12 },
  badge: { fontSize: 9, letterSpacing: 1, padding: '3px 10px', border: '1px solid', borderRadius: 4, whiteSpace: 'nowrap' },
  editBtn: { background: 'none', border: '1px solid #222', color: '#555', padding: '4px 12px', fontSize: 9, letterSpacing: 1, cursor: 'pointer', transition: 'all 0.15s', borderRadius: 4 },
  deleteBtn: { background: 'none', border: '1px solid #1E1E1E', color: '#3A3A3A', padding: '4px 12px', fontSize: 9, letterSpacing: 1, cursor: 'pointer', transition: 'all 0.15s', borderRadius: 4 },
  deleteConfirmBtn: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', padding: '4px 12px', fontSize: 9, cursor: 'pointer', borderRadius: 4 },
  cancelBtn: { background: 'none', border: '1px solid #1E1E1E', color: '#444', padding: '4px 8px', fontSize: 9, cursor: 'pointer', borderRadius: 4 },

  convoLayout: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, border: '1px solid #141414', height: 'calc(100vh - 220px)', overflow: 'hidden' },
  convoList: { borderRight: '1px solid #141414', overflow: 'auto', background: '#0A0A0A' },
  convoListHeader: { padding: '14px 20px', fontSize: 9, color: '#2E2E2E', letterSpacing: 2, borderBottom: '1px solid #141414' },
  convoEmpty: { padding: 32, fontSize: 11, color: '#2A2A2A', lineHeight: 1.8 },
  convoItem: { padding: '16px 20px', borderBottom: '1px solid #111', transition: 'background 0.1s', borderLeft: '2px solid transparent', cursor: 'pointer' },
  convoItemActive: { background: 'rgba(232,255,71,0.03)', borderLeftColor: '#E8FF47' },
  convoName: { fontSize: 12, color: '#C4C4C4', marginBottom: 3 },
  convoPhone: { fontSize: 10, color: '#444', marginBottom: 4 },
  convoTime: { fontSize: 9, color: '#2E2E2E', letterSpacing: 0.5 },

  convoMessages: { display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0C0C0C' },
  convoHeader: { padding: '16px 24px', background: '#0F0F0F', borderBottom: '1px solid #141414', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  convoHeaderName: { fontSize: 13, color: '#D4D4D4', marginBottom: 3 },
  convoHeaderPhone: { fontSize: 10, color: '#444' },
  convoHeaderTime: { fontSize: 9, color: '#2E2E2E' },
  messageList: { flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 },
  messageBubble: { maxWidth: '68%', padding: '14px 18px', border: '1px solid', borderRadius: 8, wordBreak: 'break-word' },
  messageText: { fontSize: 12, lineHeight: 1.7, color: '#C4C4C4' },
  convoPlaceholder: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  convoPlaceholderIcon: { fontSize: 32, color: '#1A1A1A' },
  convoPlaceholderText: { fontSize: 11, color: '#2A2A2A', letterSpacing: 2 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 },
  modalCard: { background: '#0F0F0F', border: '1px solid #E8FF47', padding: 36, width: 480, maxWidth: '95vw', animation: 'fadeUp 0.2s ease', borderRadius: 8, maxHeight: '90vh', overflow: 'auto' },
  modalTitle: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: '#E8FF47', marginBottom: 28, letterSpacing: 2 },
  modalGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 },
  modalField: { display: 'flex', flexDirection: 'column', gap: 6 },
  modalLabel: { fontSize: 9, color: '#333', letterSpacing: 2 },
  modalInput: { background: '#080808', border: '1px solid #1A1A1A', color: '#D4D4D4', padding: '10px 14px', fontSize: 12, width: '100%', transition: 'border-color 0.2s', borderRadius: 4 },
  modalActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
}