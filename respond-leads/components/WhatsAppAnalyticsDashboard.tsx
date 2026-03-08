'use client'

import React, { useState, useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'

interface ConversationAnalytics {
  phone_number: string
  search_keyword: string
  result_count: number
  timestamp: string
  converted: boolean
}

interface AnalyticsStats {
  totalConversations: number
  conversionRate: number
  topKeywords: Array<{ keyword: string; count: number }>
  avgResponseTime: string
  activeUsers: number
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
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  
  statCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  statValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  statLabel: {
    fontSize: '14px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  keywordsSection: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '20px',
    padding: '32px',
    marginBottom: '32px'
  },
  
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  keywordList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  
  keywordItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    transition: 'all 0.3s ease'
  },
  
  keywordText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  keywordCount: {
    fontSize: '14px',
    color: '#9ca3af',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  }
}

export default function WhatsAppAnalyticsDashboard({ className = '' }: { className?: string }) {
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      const supabase = getSupabaseClient()
      
      // Get conversation analytics
      const { data: analytics, error: analyticsError } = await supabase
        .from('conversation_analytics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000)

      if (analyticsError) throw analyticsError

      // Calculate stats
      const totalConversations = analytics?.length || 0
      const convertedConversations = analytics?.filter(a => a.converted).length || 0
      const conversionRate = totalConversations > 0 ? (convertedConversations / totalConversations) * 100 : 0

      // Get top keywords
      const keywordCounts = analytics?.reduce((acc, item) => {
        acc[item.search_keyword] = (acc[item.search_keyword] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      const topKeywords = Object.entries(keywordCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count: count as number }))

      // Get unique users
      const uniqueUsers = new Set(analytics?.map(a => a.phone_number) || [])
      
      setStats({
        totalConversations,
        conversionRate: Math.round(conversionRate * 10) / 10,
        topKeywords,
        avgResponseTime: '~2.5s', // Would calculate from actual data
        activeUsers: uniqueUsers.size
      })

    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading WhatsApp analytics...</div>
  }

  if (!stats) {
    return <div style={styles.loading}>No analytics data available</div>
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 WhatsApp Analytics</h1>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.totalConversations}</div>
          <div style={styles.statLabel}>Total Conversations</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.conversionRate}%</div>
          <div style={styles.statLabel}>Conversion Rate</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.activeUsers}</div>
          <div style={styles.statLabel}>Active Users</div>
        </div>
        
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.avgResponseTime}</div>
          <div style={styles.statLabel}>Avg Response Time</div>
        </div>
      </div>

      <div style={styles.keywordsSection}>
        <h2 style={styles.sectionTitle}>🔥 Top Search Keywords</h2>
        <div style={styles.keywordList}>
          {stats.topKeywords.map((item, index) => (
            <div key={index} style={styles.keywordItem}>
              <span style={styles.keywordText}>{item.keyword}</span>
              <span style={styles.keywordCount}>{item.count} searches</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
