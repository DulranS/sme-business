'use client'

import React, { useState, useEffect } from 'react'
import { forecastingService } from '../lib/forecasting'
import { ForecastData, CustomerSegment, InventoryOptimization } from '../types'
import { CurrencyService } from '../lib/currency'

interface ForecastingDashboardProps {
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
    fontFamily: "\"Inter\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
  },
  
  timeRangeSelector: {
    display: 'flex',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    padding: '6px',
    borderRadius: '16px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)'
  },
  
  timeRangeButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'transparent',
    color: '#9ca3af',
    fontFamily: "'Inter', sans-serif"
  },
  
  timeRangeButtonActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
  },
  
  forecastGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '32px',
    marginBottom: '40px'
  },
  
  forecastCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px',
    position: 'relative',
    overflow: 'hidden'
  },
  
  forecastHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  
  forecastTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif"
  },
  
  forecastValue: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif",
    lineHeight: '1.1'
  },
  
  forecastChange: {
    fontSize: '14px',
    fontWeight: '600',
    marginTop: '8px',
    fontFamily: "'Inter', sans-serif"
  },
  
  positiveChange: {
    color: '#10b981'
  },
  
  negativeChange: {
    color: '#ef4444'
  },
  
  forecastChart: {
    height: '200px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif"
  },
  
  optimizationSection: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px',
    marginBottom: '40px'
  },
  
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px',
    fontFamily: "'Inter', sans-serif"
  },
  
  optimizationGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px'
  },
  
  optimizationItem: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '16px',
    padding: '24px',
    transition: 'all 0.3s ease'
  },
  
  optimizationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  
  optimizationName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif"
  },
  
  optimizationBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'Inter', sans-serif"
  },
  
  orderNowBadge: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  },
  
  monitorBadge: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24',
    border: '1px solid rgba(251, 191, 36, 0.3)'
  },
  
  overstockedBadge: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },
  
  optimizationMetrics: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  
  metric: {
    textAlign: 'center',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '12px'
  },
  
  metricValue: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    fontFamily: "'Inter', sans-serif"
  },
  
  metricLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'Inter', sans-serif"
  },
  
  segmentsSection: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '32px'
  },
  
  segmentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  
  segmentCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '16px',
    padding: '24px'
  },
  
  segmentName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '16px',
    fontFamily: "'Inter', sans-serif"
  },
  
  segmentStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
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

export default function ForecastingDashboard({ className = '' }: ForecastingDashboardProps) {
  const [forecastData, setForecastData] = useState<ForecastData[]>([])
  const [optimization, setOptimization] = useState<InventoryOptimization[]>([])
  const [segments, setSegments] = useState<CustomerSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForecast, setSelectedForecast] = useState<ForecastData | null>(null)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    loadForecastingData()
  }, [timeRange])

  const loadForecastingData = async () => {
    try {
      setLoading(true)
      const [forecast, opt, seg] = await Promise.all([
        forecastingService.generateInventoryForecast(timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90),
        forecastingService.getInventoryOptimization(),
        forecastingService.getCustomerSegments()
      ])
      
      setForecastData(forecast)
      setOptimization(opt)
      setSegments(seg)
    } catch (error) {
      console.error('Failed to load forecasting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRecommendationBadgeStyle = (recommendation: string) => {
    switch (recommendation) {
      case 'order_now': return styles.orderNowBadge
      case 'monitor': return styles.monitorBadge
      case 'overstocked': return styles.overstockedBadge
      default: return styles.monitorBadge
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading forecasting data...</div>
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>Forecasting Dashboard</h1>
        <div style={styles.timeRangeSelector}>
          {(['7d', '30d', '90d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                ...styles.timeRangeButton,
                ...(timeRange === range ? styles.timeRangeButtonActive : {})
              }}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.forecastGrid}>
        {forecastData.slice(0, 4).map((forecast, index) => (
          <div key={index} style={styles.forecastCard}>
            <div style={styles.forecastHeader}>
              <h3 style={styles.forecastTitle}>{forecast.productName}</h3>
            </div>
            <div style={styles.forecastValue}>
              {CurrencyService.formatPrice(forecast.predictedRevenue, 'USD')}
            </div>
            <div style={{
              ...styles.forecastChange,
              ...(forecast.confidence >= 80 ? styles.positiveChange : styles.negativeChange)
            }}>
              Confidence: {forecast.confidence}%
            </div>
            <div style={styles.forecastChart}>
              📈 Demand forecast chart
            </div>
          </div>
        ))}
      </div>

      {optimization && (
        <div style={styles.optimizationSection}>
          <h2 style={styles.sectionTitle}>Inventory Optimization</h2>
          <div style={styles.optimizationGrid}>
            {optimization.slice(0, 4).map((item: InventoryOptimization, index: number) => (
              <div key={index} style={styles.optimizationItem}>
                <div style={styles.optimizationHeader}>
                  <h3 style={styles.optimizationName}>{item.productName}</h3>
                  <span style={{
                    ...styles.optimizationBadge,
                    ...(item.status === 'order-now' ? styles.orderNowBadge :
                       item.status === 'monitor' ? styles.monitorBadge :
                       styles.overstockedBadge)
                  }}>
                    {item.status}
                  </span>
                </div>
                <div style={styles.optimizationMetrics}>
                  <div style={styles.metric}>
                    <div style={styles.metricValue}>{item.currentStock}</div>
                    <div style={styles.metricLabel}>Current</div>
                  </div>
                  <div style={styles.metric}>
                    <div style={styles.metricValue}>{item.recommendedOrder}</div>
                    <div style={styles.metricLabel}>Order Qty</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.segmentsSection}>
        <h2 style={styles.sectionTitle}>Customer Segments</h2>
        <div style={styles.segmentsGrid}>
          {segments.map((segment: CustomerSegment, index: number) => (
            <div key={index} style={styles.optimizationItem}>
              <div style={styles.optimizationHeader}>
                <h3 style={styles.optimizationName}>{segment.name}</h3>
              </div>
              <div style={styles.optimizationMetrics}>
                <div style={styles.metric}>
                  <div style={styles.metricValue}>{segment.size}</div>
                  <div style={styles.metricLabel}>Customers</div>
                </div>
                <div style={styles.metric}>
                  <div style={styles.metricValue}>{segment.growthRate}%</div>
                  <div style={styles.metricLabel}>Growth</div>
                </div>
                <div style={styles.metric}>
                  <div style={styles.metricValue}>{segment.retentionRate}%</div>
                  <div style={styles.metricLabel}>Retention</div>
                </div>
                <div style={styles.metric}>
                  <div style={styles.metricValue}>
                    {CurrencyService.formatPrice(segment.averageOrderValue, 'USD')}
                  </div>
                  <div style={styles.metricLabel}>AOV</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
