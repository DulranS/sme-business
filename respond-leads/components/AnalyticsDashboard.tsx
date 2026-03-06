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
    padding: '24px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.02), rgba(139, 92, 246, 0.02))',
    borderRadius: '20px',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.1)'
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  
  title: {
    fontSize: '24px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0
  },
  
  timeframeSelector: {
    display: 'flex',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '4px',
    borderRadius: '12px',
    backdropFilter: 'blur(10px)'
  },
  
  timeframeButton: {
    padding: '8px 16px',
    border: 'none',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: '8px',
    transition: 'all 0.3s ease'
  },
  
  timeframeButtonActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff'
  },
  
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  
  metricCard: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    padding: '24px',
    borderRadius: '16px',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },
  
  metricLabel: {
    fontSize: '12px',
    color: '#a78bfa',
    fontWeight: '600',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '1'
  },
  
  metricValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    lineHeight: 1.2
  },
  
  metricChange: {
    fontSize: '12px',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: '6px',
    display: 'inline-block'
  },
  
  metricChangePositive: {
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#10b981'
  },
  
  metricChangeNegative: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444'
  },
  
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },
  
  chartCard: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    padding: '24px',
    borderRadius: '16px'
  },
  
  chartTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '20px'
  },
  
  suggestionsCard: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(139, 92, 246, 0.05))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    padding: '24px',
    borderRadius: '16px'
  },
  
  suggestionsTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '20px'
  },
  
  suggestionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
    marginBottom: '8px',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    transition: 'all 0.3s ease'
  },
  
  suggestionItemHover: {
    background: 'rgba(139, 92, 246, 0.1)',
    transform: 'translateX(4px)'
  },
  
  suggestionName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff'
  },
  
  suggestionSuggestion: {
    fontSize: '12px',
    color: '#a78bfa',
    fontWeight: '500'
  },
  
  loadingContainer: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  
  loadingSkeleton: {
    height: '20px',
    background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.3), rgba(139, 92, 246, 0.1))',
    borderRadius: '8px',
    animation: 'shimmer 2s infinite',
    backgroundSize: '200% 100%'
  },
  
  loadingCard: {
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(139, 92, 246, 0.1)'
  }
}

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [suggestions, setSuggestions] = useState<any[]>([])

  useEffect(() => {
    loadAnalytics()
    loadSuggestions()
  }, [timeframe])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const data = await analyticsService.getAnalyticsMetrics(timeframe)
      setMetrics(data)
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSuggestions = async () => {
    try {
      const data = await bulkOperationsService.getInventorySuggestions()
      setSuggestions(data)
    } catch (error) {
      console.error('Failed to load suggestions:', error)
    }
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSkeleton} style={{ width: '200px', height: '32px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={styles.loadingCard}>
              <div style={styles.loadingSkeleton} style={{ width: '60%', marginBottom: '16px' }} />
              <div style={styles.loadingSkeleton} style={{ width: '40%', height: '24px' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '18px', color: '#6b7280', marginBottom: '16px' }}>
            Unable to load analytics data
          </div>
          <button 
            onClick={loadAnalytics}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.container, ...{ className } }}>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
        `}
      </style>
      
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Analytics Dashboard</h1>
        <div style={styles.timeframeSelector}>
          {(['7d', '30d', '90d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                ...styles.timeframeButton,
                ...(timeframe === tf ? styles.timeframeButtonActive : {})
              }}
            >
              {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Total Revenue</div>
          <div style={styles.metricValue}>
            {CurrencyService.formatPrice(metrics.totalRevenue, 'USD')}
          </div>
          <div style={{ ...styles.metricChange, ...styles.metricChangePositive }}>
            +12.5% from last period
          </div>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Total Orders</div>
          <div style={styles.metricValue}>{metrics.totalOrders}</div>
          <div style={{ ...styles.metricChange, ...styles.metricChangePositive }}>
            +8.2% from last period
          </div>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Customer Satisfaction</div>
          <div style={styles.metricValue}>{metrics.customerSatisfaction}%</div>
          <div style={{ ...styles.metricChange, ...styles.metricChangeNegative }}>
            -2.1% from last period
          </div>
        </div>
        
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Low Stock Items</div>
          <div style={styles.metricValue}>{metrics.lowStockItems}</div>
          <div style={{ ...styles.metricChange, ...styles.metricChangePositive }}>
            Improved by 15%
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={styles.chartsGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Sales Trend</h3>
          <div style={{ 
            height: '200px', 
            background: 'rgba(139, 92, 246, 0.1)', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280'
          }}>
            Chart visualization would go here
          </div>
        </div>
        
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>Top Selling Items</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {metrics.topSellingItems.slice(0, 5).map((item, index) => (
              <div key={index} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                <span style={{ color: '#e5e5e5', fontWeight: '500' }}>{item.name}</span>
                <span style={{ color: '#a78bfa', fontWeight: '600' }}>
                  {item.sales} units
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Inventory Suggestions */}
      {suggestions.length > 0 && (
        <div style={styles.suggestionsCard}>
          <h3 style={styles.suggestionsTitle}>Inventory Recommendations</h3>
          <div>
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <div 
                key={index} 
                style={styles.suggestionItem}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)'
                  e.currentTarget.style.transform = 'translateX(4px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                  e.currentTarget.style.transform = 'translateX(0)'
                }}
              >
                <div>
                  <div style={styles.suggestionName}>{suggestion.name}</div>
                  <div style={styles.suggestionSuggestion}>{suggestion.suggestion}</div>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: suggestion.type === 'warning' ? '#f59e0b' : '#10b981',
                  fontWeight: '600'
                }}>
                  {suggestion.type === 'warning' ? '⚠️' : '✓'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Revenue</span>
            <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
              <span className="text-green-400 text-sm">💰</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {CurrencyService.formatPrice(metrics.totalRevenue, 'USD')}
          </div>
          <div className="text-xs text-gray-500 mt-1">All time</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Orders</span>
            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span className="text-blue-400 text-sm">📦</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalOrders}</div>
          <div className="text-xs text-gray-500 mt-1">Last {timeframe === '7d' ? '7' : timeframe === '30d' ? '30' : '90'} days</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Avg Order Value</span>
            <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <span className="text-purple-400 text-sm">📊</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {CurrencyService.formatPrice(metrics.averageOrderValue, 'USD')}
          </div>
          <div className="text-xs text-gray-500 mt-1">Per order</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Stock Alerts</span>
            <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
              <span className="text-red-400 text-sm">⚠️</span>
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {metrics.lowStockAlerts + metrics.outOfStockItems}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {metrics.outOfStockItems} out of stock, {metrics.lowStockAlerts} low stock
          </div>
        </div>
      </div>

      {/* Charts and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Trend */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sales Trend</h3>
          <div className="space-y-2">
            {metrics.salesTrend.slice(-7).map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{day.date}</span>
                <div className="flex items-center gap-4">
                  <div className="w-24 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${Math.min((day.revenue / 1000) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-white font-medium">
                    {CurrencyService.formatPrice(day.revenue, 'USD')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Satisfaction */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Customer Satisfaction</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-400">Positive</span>
                <span className="text-white">{metrics.customerSatisfaction.positive}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-400 h-2 rounded-full"
                  style={{ width: `${(metrics.customerSatisfaction.positive / metrics.customerSatisfaction.total) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-yellow-400">Neutral</span>
                <span className="text-white">{metrics.customerSatisfaction.neutral}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{ width: `${(metrics.customerSatisfaction.neutral / metrics.customerSatisfaction.total) * 100}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400">Negative</span>
                <span className="text-white">{metrics.customerSatisfaction.negative}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-400 h-2 rounded-full"
                  style={{ width: `${(metrics.customerSatisfaction.negative / metrics.customerSatisfaction.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Selling Items */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Top Selling Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Product</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Quantity</th>
                <th className="text-left text-sm font-medium text-gray-400 pb-3">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topSellingItems.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-700/50">
                  <td className="py-3 text-sm text-white">{item.name}</td>
                  <td className="py-3 text-sm text-gray-300">{item.quantity}</td>
                  <td className="py-3 text-sm text-white font-medium">
                    {CurrencyService.formatPrice(item.revenue, 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Inventory Suggestions</h3>
          <div className="space-y-3">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  suggestion.priority === 'high'
                    ? 'bg-red-500/10 border-red-500/30'
                    : suggestion.priority === 'medium'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        suggestion.priority === 'high'
                          ? 'bg-red-500 text-white'
                          : suggestion.priority === 'medium'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {suggestion.priority.toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-white capitalize">
                        {suggestion.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300">{suggestion.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">Product: {suggestion.item.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
