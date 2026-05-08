'use client'

import React, { useState, useEffect } from 'react'
import { databaseService } from '../lib/database'
import { Conversation } from '../types'

interface InventoryResult {
  name: string
  quantity: number
  price: number
  sku: string
}

interface WhatsAppDashboardProps {
  className?: string
}

interface DashboardStats {
  totalConversations: number
  activeToday: number
  avgResponseTime: string
  totalMessages: number
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(139, 92, 246, 0.03))',
    borderRadius: '24px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    minHeight: 'calc(100vh - 200px)'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '40px',
    flexWrap: 'wrap',
    gap: '20px'
  },
  
  title: {
    fontSize: '32px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '-0.5px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  
  statCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '28px',
    textAlign: 'center',
    transition: 'all 0.3s ease'
  },
  
  statIcon: {
    fontSize: '32px',
    marginBottom: '16px',
    opacity: 0.8
  },
  
  statValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: "'Inter', sans-serif",
    lineHeight: '1.1'
  },
  
  statLabel: {
    fontSize: '14px',
    color: '#a78bfa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: "'Inter', sans-serif"
  },
  
  recentConversations: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px'
  },
  
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: "'Inter', sans-serif"
  },
  
  conversationList: {
    display: 'grid',
    gap: '16px',
    maxHeight: '400px',
    overflow: 'auto'
  },
  
  conversationItem: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '16px',
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'all 0.3s ease'
  },
  
  conversationInfo: {
    flex: 1
  },
  
  customerPhone: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px',
    fontFamily: "'Inter', sans-serif"
  },
  
  customerName: {
    fontSize: '14px',
    color: '#9ca3af',
    fontFamily: "'Inter', sans-serif"
  },
  
  lastMessage: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
    fontFamily: "'Inter', sans-serif",
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  
  timeAgo: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: "'Inter', sans-serif"
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
    fontFamily: "'Inter', sans-serif"
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px',
    fontFamily: "'Inter', sans-serif"
  }
}

export default function WhatsAppDashboard({ className = '' }: WhatsAppDashboardProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [inventoryResults, setInventoryResults] = useState<InventoryResult[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalConversations: 0,
    activeToday: 0,
    avgResponseTime: '2.3s',
    totalMessages: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      const data = await databaseService.getConversations()
      setConversations(data)
      
      // Calculate stats
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const activeToday = data.filter(conv => 
        conv.updated_at && new Date(conv.updated_at) >= today
      ).length
      
      const totalMessages = data.reduce((sum, conv) => 
        sum + (conv.history ? conv.history.split('[Customer]:').length - 1 : 0), 0
      )
      
      setStats({
        totalConversations: data.length,
        activeToday,
        avgResponseTime: '2.3s',
        totalMessages
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTimeAgo = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown'
    
    const date = new Date(dateString as string)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const getLastMessage = (history: string | undefined) => {
    if (!history) return 'No messages'
    
    const messages = history.split('[Customer]:')
    const lastCustomerMessage = messages[messages.length - 1]?.trim()
    
    if (!lastCustomerMessage) return 'No messages'
    
    // Extract just the customer message part
    const messageParts = lastCustomerMessage.split('[Assistant]:')
    return messageParts[0]?.trim() || 'No messages'
  }

  if (loading) {
    return <div style={styles.loading}>Loading WhatsApp dashboard...</div>
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>WhatsApp Support Dashboard</h1>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}>💬</div>
          <div style={styles.statValue}>{stats.totalConversations}</div>
          <div style={styles.statLabel}>Total Conversations</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>📅</div>
          <div style={styles.statValue}>{stats.activeToday}</div>
          <div style={styles.statLabel}>Active Today</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>⚡</div>
          <div style={styles.statValue}>{stats.avgResponseTime}</div>
          <div style={styles.statLabel}>Avg Response Time</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statIcon}>📨</div>
          <div style={styles.statValue}>{stats.totalMessages}</div>
          <div style={styles.statLabel}>Total Messages</div>
        </div>
      </div>

      <div style={styles.recentConversations}>
        <h2 style={styles.sectionTitle}>Recent Conversations</h2>
        
        {conversations.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📱</div>
            <div style={styles.emptyText}>No conversations yet</div>
          </div>
        ) : (
          <div style={styles.conversationList}>
            {conversations.slice(0, 10).map((conversation, index) => (
              <div key={index} style={styles.conversationItem}>
                <div style={styles.conversationInfo}>
                  <div style={styles.customerPhone}>{conversation.phone_number}</div>
                  <div style={styles.customerName}>{conversation.customer_name}</div>
                  <div style={styles.lastMessage}>
                    {getLastMessage(conversation.history)}
                  </div>
                </div>
                <div style={styles.timeAgo}>
                  {getTimeAgo(conversation.updated_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
