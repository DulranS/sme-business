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
    padding: '32px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(139, 92, 246, 0.03))',
    borderRadius: '24px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    minHeight: 'calc(100vh - 200px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  
  title: {
    fontSize: '32px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0
  },
  
  controls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  
  searchInput: {
    padding: '12px 16px 12px 44px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    width: '300px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  searchIcon: {
    position: 'absolute',
    left: '16px',
    color: '#9ca3af',
    fontSize: '16px'
  },
  
  button: {
    padding: '12px 20px',
    background: 'rgba(139, 92, 246, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    color: '#e5e5e5',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  primaryButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    border: 'none'
  },
  
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  
  statCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '20px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease'
  },
  
  statValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px'
  },
  
  statLabel: {
    fontSize: '14px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  
  conversationsList: {
    display: 'grid',
    gap: '16px'
  },
  
  conversationCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },
  
  conversationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  
  customerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  
  customerAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700'
  },
  
  customerDetails: {
    flex: 1
  },
  
  customerName: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px'
  },
  
  customerPhone: {
    fontSize: '14px',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  
  lastMessage: {
    fontSize: '14px',
    color: '#e5e5e5',
    marginBottom: '12px',
    lineHeight: '1.5',
    maxHeight: '60px',
    overflow: 'hidden'
  },
  
  conversationMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280'
  },
  
  messageId: {
    fontFamily: 'monospace',
    background: 'rgba(139, 92, 246, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px'
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
    zIndex: 1000
  },
  
  modalContent: {
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    backdropFilter: 'blur(20px)'
  },
  
  modalTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px'
  },
  
  historyContent: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '12px',
    padding: '20px',
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#e5e5e5',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px'
  },
  
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  },
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: '24px'
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
