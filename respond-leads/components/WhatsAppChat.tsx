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

interface WhatsAppChatProps {
  className?: string
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
    margin: 0,
    letterSpacing: '-0.5px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  conversationsList: {
    display: 'grid',
    gap: '20px',
    maxHeight: '600px',
    overflow: 'auto'
  },
  
  conversationCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '24px',
    transition: 'all 0.3s ease'
  },
  
  conversationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  
  customerInfo: {
    flex: 1
  },
  
  phoneNumber: {
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
  
  lastUpdated: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: "'Inter', sans-serif"
  },
  
  conversationHistory: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '13px',
    color: '#e5e5e5',
    lineHeight: '1.6',
    fontFamily: "'Inter', sans-serif",
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflow: 'auto'
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

export default function WhatsAppChat({ className = '' }: WhatsAppChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      setLoading(true)
      const data = await databaseService.getConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown date'
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return <div style={styles.loading}>Loading conversations...</div>
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>WhatsApp Conversations</h1>
      </div>

      {conversations.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>💬</div>
          <div style={styles.emptyText}>No conversations yet</div>
        </div>
      ) : (
        <div style={styles.conversationsList}>
          {conversations.map((conversation, index) => (
            <div key={index} style={styles.conversationCard}>
              <div style={styles.conversationHeader}>
                <div style={styles.customerInfo}>
                  <div style={styles.phoneNumber}>{conversation.phone_number}</div>
                  <div style={styles.customerName}>{conversation.customer_name}</div>
                </div>
                <div style={styles.lastUpdated}>
                  {formatDate(conversation.updated_at)}
                </div>
              </div>
              <div style={styles.conversationHistory}>
                {conversation.history || 'No history available'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
