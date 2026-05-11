'use client'

import React, { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { 
  Brain, 
  MessageSquare, 
  Database, 
  Activity, 
  TrendingUp, 
  Users, 
  Search, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Filter,
  Eye,
  Phone,
  User
} from 'lucide-react'

interface V9Metrics {
  totalConversations: number
  todayConversations: number
  averageResponseTime: number
  keywordExtractionRate: number
  inventoryHitRate: number
  customerSatisfaction: number
  automationEfficiency: number
  errorRate: number
}

interface V9Conversation {
  id: number
  phone_number: string
  customer_name: string
  last_message_id: string
  history: string
  created_at: string
  updated_at: string
  search_keyword?: string
  inventory_results_count?: number
  processing_time_ms?: number
  blueprint_version: string
}

interface V9Analytics {
  topKeywords: Array<{
    keyword: string
    count: number
    success_rate: number
  }>
  responseTimeTrend: Array<{
    date: string
    avg_time: number
  }>
  inventoryPerformance: Array<{
    product_name: string
    search_count: number
    conversion_rate: number
  }>
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
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },

  subtitle: {
    fontSize: 'clamp(12px, 2vw, 14px)',
    color: '#9ca3af',
    fontWeight: '500',
    marginTop: '4px'
  },

  versionBadge: {
    padding: '6px 12px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#ffffff',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },

  metricCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },

  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },

  metricIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff'
  },

  metricTitle: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  metricValue: {
    fontSize: 'clamp(20px, 3vw, 28px)',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    lineHeight: 1.2
  },

  metricChange: {
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },

  positive: {
    color: '#10b981'
  } as React.CSSProperties,

  negative: {
    color: '#ef4444'
  } as React.CSSProperties,

  neutral: {
    color: '#6b7280'
  } as React.CSSProperties,

  sectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginBottom: '32px'
  },

  sectionCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)'
  },

  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },

  searchBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center'
  },

  searchInput: {
    flex: 1,
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    outline: 'none'
  },

  refreshButton: {
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  conversationsList: {
    display: 'grid',
    gap: '12px',
    maxHeight: '400px',
    overflowY: 'auto'
  },

  conversationCard: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.3s ease',
    cursor: 'pointer'
  },

  conversationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },

  customerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  customerName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px'
  },

  phoneNumber: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: 'monospace'
  },

  conversationMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '12px',
    color: '#6b7280'
  },

  keywordBadge: {
    padding: '4px 8px',
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
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
    padding: '20px'
  },

  modalContent: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '600px',
    width: '100%',
    maxHeight: '80vh',
    overflowY: 'auto',
    backdropFilter: 'blur(20px)'
  },

  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },

  modalTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    margin: 0
  },

  closeButton: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0'
  },

  historyContent: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '12px',
    padding: '20px',
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#e5e5e5',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6'
  },

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px'
  }
}

export default function V9BlueprintDashboard() {
  const [metrics, setMetrics] = useState<V9Metrics | null>(null)
  const [conversations, setConversations] = useState<V9Conversation[]>([])
  const [analytics, setAnalytics] = useState<V9Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<V9Conversation | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const supabase = getSupabaseClient()

  useEffect(() => {
    loadV9Data()
  }, [])

  const loadV9Data = async () => {
    try {
      setLoading(true)

      // Load V9 conversations with enhanced analytics
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .eq('blueprint_version', 'V9')
        .order('updated_at', { ascending: false })
        .limit(50)

      if (conversationsError) throw conversationsError

      const conversations = conversationsData || []

      // Calculate V9-specific metrics
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const v9Metrics: V9Metrics = {
        totalConversations: conversations.length,
        todayConversations: conversations.filter(c => 
          new Date(c.updated_at) >= today
        ).length,
        averageResponseTime: conversations.reduce((sum, c) => 
          sum + (c.processing_time_ms || 0), 0) / conversations.length || 0,
        keywordExtractionRate: conversations.filter(c => 
          c.search_keyword && c.search_keyword !== 'GENERAL'
        ).length / conversations.length * 100 || 0,
        inventoryHitRate: conversations.filter(c => 
          (c.inventory_results_count || 0) > 0
        ).length / conversations.length * 100 || 0,
        customerSatisfaction: 94.5, // Would come from feedback system
        automationEfficiency: 87.3,
        errorRate: 2.1
      }

      // Generate V9 analytics
      const keywordCounts = conversations.reduce((acc, c) => {
        const keyword = c.search_keyword || 'GENERAL'
        acc[keyword] = (acc[keyword] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topKeywords = Object.entries(keywordCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([keyword, count]) => ({
          keyword,
          count: count as number,
          success_rate: conversations.filter(c => 
            c.search_keyword === keyword && (c.inventory_results_count || 0) > 0
          ).length / conversations.filter(c => c.search_keyword === keyword).length * 100 || 0
        }))

      const v9Analytics: V9Analytics = {
        topKeywords,
        responseTimeTrend: [], // Would be calculated from historical data
        inventoryPerformance: [] // Would be calculated from inventory analytics
      }

      setMetrics(v9Metrics)
      setConversations(conversations)
      setAnalytics(v9Analytics)
      setLastRefreshed(new Date())

    } catch (error) {
      console.error('Error loading V9 data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const filteredConversations = conversations.filter(c => 
    c.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone_number.includes(search)
  )

  if (loading) {
    return <div style={styles.loading}>Loading V9 Blueprint data...</div>
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Brain size={32} />
            V9 Blueprint Dashboard
          </h1>
          <div style={styles.subtitle}>
            Enhanced WhatsApp AI Support • Last updated: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
        <div style={styles.versionBadge}>V9 Clean</div>
      </div>

      {/* V9 Metrics */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <MessageSquare size={20} />
            </div>
            <div style={styles.metricTitle}>Total Conversations</div>
          </div>
          <div style={styles.metricValue}>{metrics?.totalConversations || 0}</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <TrendingUp size={12} />
            V9 Enhanced
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Clock size={20} />
            </div>
            <div style={styles.metricTitle}>Avg Response Time</div>
          </div>
          <div style={styles.metricValue}>{formatDuration(metrics?.averageResponseTime || 0)}</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <Zap size={12} />
            Optimized
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <Search size={20} />
            </div>
            <div style={styles.metricTitle}>Keyword Extraction Rate</div>
          </div>
          <div style={styles.metricValue}>{metrics?.keywordExtractionRate.toFixed(1)}%</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <Target size={12} />
            Enhanced AI
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <Database size={20} />
            </div>
            <div style={styles.metricTitle}>Inventory Hit Rate</div>
          </div>
          <div style={styles.metricValue}>{metrics?.inventoryHitRate.toFixed(1)}%</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <BarChart3 size={12} />
            Smart Search
          </div>
        </div>
      </div>

      <div style={styles.sectionGrid}>
        {/* Recent V9 Conversations */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <MessageSquare size={20} />
            Recent V9 Conversations
          </h2>
          
          <div style={styles.searchBar}>
            <input
              style={styles.searchInput}
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button style={styles.refreshButton} onClick={loadV9Data}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div style={styles.conversationsList}>
            {filteredConversations.map((conversation) => (
              <div 
                key={conversation.id} 
                style={styles.conversationCard}
                onClick={() => setSelectedConversation(conversation)}
              >
                <div style={styles.conversationHeader}>
                  <div style={styles.customerInfo}>
                    <User size={16} style={{ color: '#9ca3af' }} />
                    <div>
                      <div style={styles.customerName}>{conversation.customer_name}</div>
                      <div style={styles.phoneNumber}>{conversation.phone_number}</div>
                    </div>
                  </div>
                  <div style={styles.conversationMeta}>
                    {conversation.search_keyword && (
                      <div style={styles.keywordBadge}>
                        {conversation.search_keyword}
                      </div>
                    )}
                    {conversation.inventory_results_count !== undefined && (
                      <span>{conversation.inventory_results_count} results</span>
                    )}
                  </div>
                </div>
                <div style={styles.conversationMeta}>
                  <Clock size={12} />
                  {formatDate(conversation.updated_at)}
                  {conversation.processing_time_ms && (
                    <span>• {formatDuration(conversation.processing_time_ms)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* V9 Analytics */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <BarChart3 size={20} />
            V9 Performance Analytics
          </h2>
          
          {analytics?.topKeywords && (
            <div>
              <h3 style={{ color: '#ffffff', marginBottom: '16px', fontSize: '16px' }}>
                Top Search Keywords
              </h3>
              {analytics.topKeywords.map((item, index) => (
                <div key={item.keyword} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ color: '#ffffff', fontWeight: '600' }}>
                      {item.keyword}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                      {item.count} searches
                    </span>
                    <span style={{ 
                      color: item.success_rate > 70 ? '#10b981' : '#f59e0b',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {item.success_rate.toFixed(1)}% success
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Conversation Detail Modal */}
      {selectedConversation && (
        <div style={styles.modal} onClick={() => setSelectedConversation(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Conversation History</h3>
              <button style={styles.closeButton} onClick={() => setSelectedConversation(null)}>
                ×
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>
                Customer: {selectedConversation.customer_name} ({selectedConversation.phone_number})
              </div>
              <div style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '8px' }}>
                Keyword: {selectedConversation.search_keyword || 'N/A'}
              </div>
              <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                Last Updated: {formatDate(selectedConversation.updated_at)}
              </div>
            </div>
            <div style={styles.historyContent}>
              {selectedConversation.history || 'No history available'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
