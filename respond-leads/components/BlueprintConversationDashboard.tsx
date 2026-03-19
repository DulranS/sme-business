'use client'

import React, { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { Conversation } from '@/types'
import { 
  MessageSquare, 
  User, 
  Clock, 
  Search, 
  Filter,
  RefreshCw,
  Eye,
  Trash2,
  Phone,
  Calendar
} from 'lucide-react'

interface BlueprintConversationDashboardProps {
  className?: string
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 'clamp(16px, 4vw, 32px)',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(139, 92, 246, 0.03))',
    borderRadius: 'clamp(12px, 2vw, 24px)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    minHeight: 'calc(100vh - 200px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflowX: 'hidden'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'clamp(20px, 4vw, 32px)',
    flexWrap: 'wrap',
    gap: 'clamp(12px, 2vw, 20px)'
  },
  
  title: {
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    wordBreak: 'break-word'
  },
  
  controls: {
    display: 'flex',
    gap: 'clamp(8px, 1.5vw, 12px)',
    alignItems: 'center',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '500px'
  },
  
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    minWidth: '200px'
  },
  
  searchInput: {
    padding: 'clamp(10px, 2vw, 12px) clamp(10px, 2vw, 12px) clamp(36px, 6vw, 44px)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: 'clamp(8px, 1.5vw, 12px)',
    color: '#ffffff',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    width: '100%',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    transition: 'all 0.3s ease'
  },
  
  searchIcon: {
    position: 'absolute',
    left: 'clamp(12px, 2vw, 16px)',
    color: '#9ca3af',
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    pointerEvents: 'none'
  },
  
  button: {
    padding: 'clamp(10px, 2vw, 12px) clamp(16px, 3vw, 20px)',
    background: 'rgba(139, 92, 246, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: 'clamp(8px, 1.5vw, 12px)',
    color: '#e5e5e5',
    fontSize: 'clamp(12px, 2vw, 14px)',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(6px, 1vw, 8px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    whiteSpace: 'nowrap'
  },
  
  primaryButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    border: 'none'
  },
  
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: 'clamp(12px, 2vw, 20px)',
    marginBottom: 'clamp(24px, 4vw, 32px)'
  },
  
  statCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: 'clamp(12px, 2vw, 16px)',
    padding: 'clamp(16px, 3vw, 20px)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    textAlign: 'center'
  },
  
  statValue: {
    fontSize: 'clamp(24px, 4vw, 28px)',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 'clamp(6px, 1vw, 8px)'
  },
  
  statLabel: {
    fontSize: 'clamp(11px, 2vw, 14px)',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  
  conversationsList: {
    display: 'grid',
    gap: 'clamp(12px, 2vw, 16px)'
  },
  
  conversationCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: 'clamp(12px, 2vw, 16px)',
    padding: 'clamp(16px, 3vw, 24px)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  
  conversationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'clamp(12px, 2vw, 16px)',
    gap: 'clamp(12px, 2vw, 16px)'
  },
  
  customerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'clamp(10px, 1.5vw, 12px)',
    flex: 1,
    minWidth: 0
  },
  
  customerAvatar: {
    width: 'clamp(36px, 5vw, 40px)',
    height: 'clamp(36px, 5vw, 40px)',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: 'clamp(14px, 3vw, 16px)',
    fontWeight: '700',
    flexShrink: 0
  },
  
  customerDetails: {
    flex: 1,
    minWidth: 0
  },
  
  customerName: {
    fontSize: 'clamp(14px, 2.5vw, 16px)',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px',
    wordBreak: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  
  customerPhone: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    wordBreak: 'break-all'
  },
  
  lastMessage: {
    fontSize: 'clamp(13px, 2vw, 14px)',
    color: '#e5e5e5',
    marginBottom: 'clamp(10px, 1.5vw, 12px)',
    lineHeight: '1.5',
    maxHeight: 'clamp(50px, 6vw, 60px)',
    overflow: 'hidden',
    wordBreak: 'break-word'
  },
  
  conversationMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 'clamp(10px, 1.5vw, 12px)',
    color: '#6b7280',
    flexWrap: 'wrap',
    gap: 'clamp(8px, 1vw, 12px)'
  },
  
  messageId: {
    fontFamily: 'monospace',
    background: 'rgba(139, 92, 246, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: 'clamp(9px, 1.5vw, 10px)',
    wordBreak: 'break-all'
  },
  
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'clamp(16px, 3vw, 32px)'
  },
  
  modalContent: {
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: 'clamp(16px, 3vw, 20px)',
    padding: 'clamp(20px, 4vw, 32px)',
    maxWidth: 'clamp(90%, 600px, 95%)',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    backdropFilter: 'blur(20px)'
  },
  
  modalTitle: {
    fontSize: 'clamp(18px, 3vw, 24px)',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 'clamp(16px, 3vw, 24px)',
    wordBreak: 'break-word'
  },
  
  historyContent: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: 'clamp(8px, 1.5vw, 12px)',
    padding: 'clamp(16px, 3vw, 20px)',
    fontFamily: 'monospace',
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#e5e5e5',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    maxHeight: 'clamp(300px, 40vh, 400px)',
    overflowY: 'auto',
    wordBreak: 'break-word'
  },
  
  modalActions: {
    display: 'flex',
    gap: 'clamp(8px, 1.5vw, 12px)',
    justifyContent: 'flex-end',
    marginTop: 'clamp(16px, 3vw, 24px)',
    flexWrap: 'wrap'
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'clamp(300px, 40vh, 400px)',
    color: '#6b7280',
    fontSize: 'clamp(14px, 2vw, 16px)',
    textAlign: 'center'
  },
  
  emptyState: {
    textAlign: 'center',
    padding: 'clamp(40px, 6vw, 60px) clamp(20px, 3vw, 32px)',
    color: '#6b7280'
  },
  
  emptyIcon: {
    fontSize: 'clamp(36px, 6vw, 48px)',
    marginBottom: 'clamp(12px, 2vw, 16px)',
    opacity: 0.5
  },
  
  emptyText: {
    fontSize: 'clamp(14px, 2vw, 16px)',
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 'clamp(20px, 3vw, 24px)',
    wordBreak: 'break-word'
  }
}

export default function BlueprintConversationDashboard({ className = '' }: BlueprintConversationDashboardProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    active: 0,
    avgLength: 0
  })

  const supabase = getSupabaseClient()

  useEffect(() => {
    loadConversations()
    loadStats()
  }, [])

  const loadConversations = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
      
      if (search) {
        query = query.or(`customer_name.ilike.%${search}%,phone_number.ilike.%${search}%`)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error loading conversations:', error)
      } else {
        setConversations(data || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const { data: allConvs } = await supabase
        .from('conversations')
        .select('updated_at, history')
      
      if (allConvs) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const todayConvs = allConvs.filter(conv => 
          new Date(conv.updated_at!) >= today
        )
        
        const avgHistoryLength = allConvs.reduce((sum, conv) => 
          sum + (conv.history?.length || 0), 0
        ) / (allConvs.length || 1)
        
        setStats({
          total: allConvs.length,
          today: todayConvs.length,
          active: allConvs.filter(conv => conv.history && conv.history.length > 100).length,
          avgLength: Math.round(avgHistoryLength)
        })
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 48) return 'Yesterday'
    return date.toLocaleDateString()
  }

  const getLastMessage = (history: string) => {
    if (!history) return 'No messages yet'
    
    const lines = history.split('\n').filter(line => line.trim())
    const lastLine = lines[lines.length - 1]
    
    if (lastLine.includes('[Customer]:')) {
      return lastLine.replace('[Customer]:', '').trim()
    }
    
    return lastLine
  }

  const getCustomerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const viewConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setShowModal(true)
  }

  if (loading) {
    return <div style={styles.loading}>Loading blueprint conversations...</div>
  }

  return (
    <div style={styles.container} className={className}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <div style={styles.header}>
        <h1 style={styles.title}>💬 Blueprint Conversations</h1>
        <div style={styles.controls}>
          <div style={styles.searchBox}>
            <Search style={styles.searchIcon} size={16} />
            <input
              type="text"
              placeholder="Search conversations..."
              style={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadConversations()}
            />
          </div>
          <button 
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={loadConversations}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.total}</div>
          <div style={styles.statLabel}>Total Conversations</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.today}</div>
          <div style={styles.statLabel}>Today</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.active}</div>
          <div style={styles.statLabel}>Active Chats</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.avgLength}</div>
          <div style={styles.statLabel}>Avg History Length</div>
        </div>
      </div>

      <div style={styles.conversationsList}>
        {conversations.map((conversation) => (
          <div 
            key={conversation.id} 
            style={styles.conversationCard}
            onClick={() => viewConversation(conversation)}
          >
            <div style={styles.conversationHeader}>
              <div style={styles.customerInfo}>
                <div style={styles.customerAvatar}>
                  {getCustomerInitials(conversation.customer_name)}
                </div>
                <div style={styles.customerDetails}>
                  <div style={styles.customerName}>{conversation.customer_name}</div>
                  <div style={styles.customerPhone}>
                    <Phone size={14} />
                    {conversation.phone_number}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                  {conversation.updated_at && formatDate(conversation.updated_at)}
                </div>
                {conversation.last_message_id && (
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    ID: <span style={styles.messageId}>{conversation.last_message_id.slice(-8)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div style={styles.lastMessage}>
              {getLastMessage(conversation.history)}
            </div>
            
            <div style={styles.conversationMeta}>
              <span>
                <Clock size={12} style={{ marginRight: '4px' }} />
                {conversation.updated_at && new Date(conversation.updated_at).toLocaleString()}
              </span>
              <span>
                <MessageSquare size={12} style={{ marginRight: '4px' }} />
                {conversation.history ? conversation.history.split('\n').length / 2 : 0} messages
              </span>
            </div>
          </div>
        ))}
      </div>

      {conversations.length === 0 && !loading && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💬</div>
          <div style={styles.emptyText}>No conversations yet</div>
          <button 
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={loadConversations}
          >
            Refresh Data
          </button>
        </div>
      )}

      {/* Conversation Detail Modal */}
      {showModal && selectedConversation && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>
              Conversation with {selectedConversation.customer_name}
            </h3>
            
            <div style={{ marginBottom: '16px', fontSize: '14px', color: '#9ca3af' }}>
              <div>📱 {selectedConversation.phone_number}</div>
              <div>🕐 Last updated: {selectedConversation.updated_at && new Date(selectedConversation.updated_at).toLocaleString()}</div>
              {selectedConversation.last_message_id && (
                <div>🆔 Message ID: {selectedConversation.last_message_id}</div>
              )}
            </div>
            
            <div style={styles.historyContent}>
              {selectedConversation.history || 'No conversation history yet'}
            </div>
            
            <div style={styles.modalActions}>
              <button 
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
