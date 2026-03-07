'use client'

import React, { useState, useEffect } from 'react'
import { analyticsService, AnalyticsMetrics } from '../lib/analytics'
import { bulkOperationsService } from '../lib/bulk-operations'
import { CurrencyService } from '../lib/currency'

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
    fontFamily:  Inter -apple-system BlinkMacSystemFont Segoe UI sans-serif
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
    padding: '10px 20px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'transparent',
    color: '#9ca3af',
    fontFamily: Inter sans-serif
  },
  
  timeframeButtonActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
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
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },
  
  metricLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#a78bfa',
    marginBottom: '12px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontFamily: Inter sans-serif
  },
  
  metricValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: Inter sans-serif,
    lineHeight: '1.1'
  },
  
  metricChange: {
    fontSize: '14px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: Inter sans-serif
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
    gap: '32px',
    marginBottom: '40px'
  },
  
  chartCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px',
    position: 'relative'
  },
  
  chartTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: Inter sans-serif
  },
  
  chartPlaceholder: {
    height: '300px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '14px',
    fontFamily: Inter sans-serif
  },
  
  insightsSection: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px'
  },
  
  insightsTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: Inter sans-serif
  },
  
  insightItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    marginBottom: '20px',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(139, 92, 246, 0.1)'
  },
  
  insightIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '18px',
    flexShrink: 0
  },
  
  insightContent: {
    flex: 1
  },
  
  insightTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '6px',
    fontFamily: Inter sans-serif
  },
  
  insightDescription: {
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.6',
    fontFamily: Inter sans-serif
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px',
    fontFamily: Inter sans-serif
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

  if (loading) {
    return <div style={styles.loading}>Loading analytics...</div>
  }

  if (!metrics) {
    return <div style={styles.loading}>No analytics data available</div>
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>Analytics Dashboard</h1>
        <div style={styles.timeframeSelector}>
          {(['7d', '30d', '90d'] as const).map(period => (
            <button
              key={period}
              onClick={() => setTimeframe(period)}
              style={{
                ...styles.timeframeButton,
                ...(timeframe === period ? styles.timeframeButtonActive : {})
              }}
            >
              {period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Total Revenue</div>
          <div style={styles.metricValue}>
            {CurrencyService.formatPriceInPreferredCurrency(metrics.totalRevenue)}
          </div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.revenueChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            <span>{metrics.revenueChange >= 0 ? '' : ''}</span>
            <span>{Math.abs(metrics.revenueChange)}%</span>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Total Orders</div>
          <div style={styles.metricValue}>{metrics.totalOrders}</div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.ordersChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            <span>{metrics.ordersChange >= 0 ? '' : ''}</span>
            <span>{Math.abs(metrics.ordersChange)}%</span>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Average Order Value</div>
          <div style={styles.metricValue}>
            {CurrencyService.formatPriceInPreferredCurrency(metrics.averageOrderValue)}
          </div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.aovChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            <span>{metrics.aovChange >= 0 ? '' : ''}</span>
            <span>{Math.abs(metrics.aovChange)}%</span>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Conversion Rate</div>
          <div style={styles.metricValue}>{metrics.conversionRate}%</div>
          <div style={{
            ...styles.metricChange,
            ...(metrics.conversionChange >= 0 ? styles.positiveChange : styles.negativeChange)
          }}>
            <span>{metrics.conversionChange >= 0 ? '' : ''}</span>
            <span>{Math.abs(metrics.conversionChange)}%</span>
          </div>
        </div>
      </div>

      <div style={styles.chartsSection}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Revenue Trend</h3>
          <div style={styles.chartPlaceholder}>
             Revenue chart visualization
          </div>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Top Products</h3>
          <div style={styles.chartPlaceholder}>
             Top products chart
          </div>
        </div>
      </div>

      <div style={styles.insightsSection}>
        <h2 style={styles.insightsTitle}>Key Insights</h2>
        
        <div style={styles.insightItem}>
          <div style={styles.insightIcon}></div>
          <div style={styles.insightContent}>
            <div style={styles.insightTitle}>Revenue Growth</div>
            <div style={styles.insightDescription}>
              Your revenue has increased by {metrics.revenueChange}% compared to the previous period. 
              Focus on maintaining this growth trajectory.
            </div>
          </div>
        </div>

        <div style={styles.insightItem}>
          <div style={styles.insightIcon}></div>
          <div style={styles.insightContent}>
            <div style={styles.insightTitle}>Conversion Optimization</div>
            <div style={styles.insightDescription}>
              Consider A/B testing your checkout process to improve the {metrics.conversionRate}% conversion rate.
            </div>
          </div>
        </div>

        <div style={styles.insightItem}>
          <div style={styles.insightIcon}></div>
          <div style={styles.insightContent}>
            <div style={styles.insightTitle}>Inventory Insights</div>
            <div style={styles.insightDescription}>
              Monitor your best-selling products and ensure adequate stock levels to maximize sales opportunities.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
