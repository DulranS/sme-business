'use client'

import React, { useState, useEffect } from 'react'
import { analyticsService } from '../lib/analytics'
import { AnalyticsMetrics } from '../types'

interface AnalyticsDashboardProps {
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
  
  timeframeSelector: {
    display: 'flex',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: '6px',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)'
  },
  
  timeframeButton: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    fontFamily: "'Inter', sans-serif",
    transition: 'all 0.3s ease'
  },
  
  timeframeButtonActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff'
  },
  
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  
  metricCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '28px',
    position: 'relative',
    overflow: 'hidden'
  },
  
  metricIcon: {
    fontSize: '32px',
    marginBottom: '16px',
    opacity: 0.8
  },
  
  metricValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: "'Inter', sans-serif",
    lineHeight: '1.1'
  },
  
  metricLabel: {
    fontSize: '14px',
    color: '#a78bfa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: "'Inter', sans-serif"
  },
  
  metricChange: {
    fontSize: '12px',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontFamily: "'Inter', sans-serif"
  },
  
  positiveChange: {
    color: '#10b981'
  },
  
  negativeChange: {
    color: '#ef4444'
  },
  
  chartsSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },
  
  chartCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px'
  },
  
  chartTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: "'Inter', sans-serif"
  },
  
  chartPlaceholder: {
    height: '200px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif"
  },
  
  insightsSection: {
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
  
  insightsList: {
    display: 'grid',
    gap: '16px'
  },
  
  insightItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(139, 92, 246, 0.1)'
  },
  
  insightIcon: {
    fontSize: '20px',
    marginTop: '2px'
  },
  
  insightContent: {
    flex: 1
  },
  
  insightTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px',
    fontFamily: "'Inter', sans-serif"
  },
  
  insightDescription: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.5',
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

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMetrics()
  }, [timeframe])

  const loadMetrics = async () => {
    try {
      setLoading(true)
      const data = await analyticsService.getMetrics(timeframe)
      setMetrics(data)
    } catch (error) {
      console.error('Failed to load analytics metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  if (loading) {
    return <div style={styles.loading}>Loading analytics...</div>
  }

  if (!metrics) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>📊</div>
        <div style={styles.emptyText}>No analytics data available</div>
      </div>
    )
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>Analytics Dashboard</h1>
        <div style={styles.timeframeSelector}>
          {(['7d', '30d', '90d'] as const).map(period => (
            <button
              key={period}
              style={{
                ...styles.timeframeButton,
                ...(timeframe === period ? styles.timeframeButtonActive : {})
              }}
              onClick={() => setTimeframe(period)}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>💰</div>
          <div style={styles.metricValue}>{formatCurrency(metrics.revenue)}</div>
          <div style={styles.metricLabel}>Revenue</div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.revenueChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            {metrics.revenueChange >= 0 ? '↑' : '↓'} {formatPercent(metrics.revenueChange)}
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>📦</div>
          <div style={styles.metricValue}>{metrics.orders.toLocaleString()}</div>
          <div style={styles.metricLabel}>Orders</div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.ordersChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            {metrics.ordersChange >= 0 ? '↑' : '↓'} {formatPercent(metrics.ordersChange)}
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>💳</div>
          <div style={styles.metricValue}>{formatCurrency(metrics.averageOrderValue)}</div>
          <div style={styles.metricLabel}>Average Order Value</div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.aovChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            {metrics.aovChange >= 0 ? '↑' : '↓'} {formatPercent(metrics.aovChange)}
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIcon}>🎯</div>
          <div style={styles.metricValue}>{(metrics.conversionRate * 100).toFixed(1)}%</div>
          <div style={styles.metricLabel}>Conversion Rate</div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.conversionChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            {metrics.conversionChange >= 0 ? '↑' : '↓'} {formatPercent(metrics.conversionChange)}
          </div>
        </div>
      </div>

      <div style={styles.chartsSection}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Revenue Trend</h3>
          <div style={styles.chartPlaceholder}>
            📈 Revenue chart visualization
          </div>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Orders by Category</h3>
          <div style={styles.chartPlaceholder}>
            📊 Category breakdown chart
          </div>
        </div>
      </div>

      <div style={styles.insightsSection}>
        <h2 style={styles.sectionTitle}>Key Insights</h2>
        <div style={styles.insightsList}>
          <div style={styles.insightItem}>
            <div style={styles.insightIcon}>💡</div>
            <div style={styles.insightContent}>
              <div style={styles.insightTitle}>Revenue Growth</div>
              <div style={styles.insightDescription}>
                Revenue has increased by {formatPercent(metrics.revenueChange)} compared to the previous period.
              </div>
            </div>
          </div>

          <div style={styles.insightItem}>
            <div style={styles.insightIcon}>📈</div>
            <div style={styles.insightContent}>
              <div style={styles.insightTitle}>Conversion Optimization</div>
              <div style={styles.insightDescription}>
                Current conversion rate is {(metrics.conversionRate * 100).toFixed(1)}%. Consider A/B testing checkout flow.
              </div>
            </div>
          </div>

          <div style={styles.insightItem}>
            <div style={styles.insightIcon}>🎯</div>
            <div style={styles.insightContent}>
              <div style={styles.insightTitle}>Average Order Value</div>
              <div style={styles.insightDescription}>
                AOV is {formatCurrency(metrics.averageOrderValue)}. Consider upselling strategies to increase this metric.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
