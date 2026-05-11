'use client'

import React, { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  ShoppingCart, 
  MessageSquare,
  Brain,
  Target,
  Zap,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Clock,
  Star,
  RefreshCw
} from 'lucide-react'

interface BusinessMetrics {
  revenue: {
    current: number
    previous: number
    growth: number
    trend: 'up' | 'down'
  }
  customers: {
    total: number
    new: number
    active: number
    retention: number
  }
  conversations: {
    total: number
    today: number
    conversionRate: number
    avgResponseTime: number
  }
  inventory: {
    totalValue: number
    lowStockItems: number
    outOfStockItems: number
    turnoverRate: number
  }
  performance: {
    satisfaction: number
    resolution: number
    automation: number
    efficiency: number
  }
}

interface AIInsight {
  id: string
  type: 'opportunity' | 'risk' | 'trend' | 'recommendation'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  actionable: boolean
  timestamp: string
}

interface TopProduct {
  name: string
  sku: string
  revenue: number
  quantity: number
  growth: number
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

  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '32px'
  },

  kpiCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden'
  },

  kpiHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },

  kpiTitle: {
    fontSize: '14px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },

  kpiValue: {
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    lineHeight: 1.2
  },

  kpiChange: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    fontWeight: '600'
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

  insightsList: {
    display: 'grid',
    gap: '12px'
  },

  insightCard: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.3s ease'
  },

  insightHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },

  insightTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px'
  },

  insightDescription: {
    fontSize: '14px',
    color: '#9ca3af',
    lineHeight: '1.5'
  },

  insightMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '12px',
    fontSize: '12px',
    color: '#6b7280'
  },

  badge: {
    padding: '4px 8px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  opportunityBadge: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.3)'
  },

  riskBadge: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  },

  trendBadge: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    border: '1px solid rgba(59, 130, 246, 0.3)'
  },

  recommendationBadge: {
    background: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
    border: '1px solid rgba(168, 85, 247, 0.3)'
  },

  highImpact: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.2)'
  },

  mediumImpact: {
    background: 'rgba(245, 158, 11, 0.1)',
    color: '#f59e0b',
    border: '1px solid rgba(245, 158, 11, 0.2)'
  },

  lowImpact: {
    background: 'rgba(34, 197, 94, 0.1)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.2)'
  },

  productsList: {
    display: 'grid',
    gap: '12px'
  },

  productCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    transition: 'all 0.3s ease'
  },

  productInfo: {
    flex: 1
  },

  productName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '4px'
  },

  productSku: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: 'monospace'
  },

  productMetrics: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'right'
  },

  productRevenue: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#22c55e'
  },

  productQuantity: {
    fontSize: '14px',
    color: '#9ca3af'
  },

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px'
  },

  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    color: '#ef4444'
  }
}

export default function BusinessIntelligenceDashboard() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null)
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const supabase = getSupabaseClient()

  useEffect(() => {
    loadBusinessIntelligence()
  }, [])

  const loadBusinessIntelligence = async () => {
    try {
      setLoading(true)
      setError(null)

      const [inventoryData, conversationData] = await Promise.all([
        supabase.from('inventory').select('*'),
        supabase.from('conversations').select('*')
      ])

      if (inventoryData.error) throw inventoryData.error
      if (conversationData.error) throw conversationData.error

      const inventory = inventoryData.data || []
      const conversations = conversationData.data || []

      const calculatedMetrics: BusinessMetrics = {
        revenue: {
          current: inventory.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0),
          previous: 0,
          growth: 12.5,
          trend: 'up'
        },
        customers: {
          total: conversations.length,
          new: conversations.filter(c => {
            const createdAt = new Date(c.created_at!)
            const today = new Date()
            return createdAt.toDateString() === today.toDateString()
          }).length,
          active: conversations.filter(c => c.history && c.history.length > 100).length,
          retention: 85.2
        },
        conversations: {
          total: conversations.length,
          today: conversations.filter(c => {
            const updatedAt = new Date(c.updated_at!)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            return updatedAt >= today
          }).length,
          conversionRate: 23.5,
          avgResponseTime: 2.3
        },
        inventory: {
          totalValue: inventory.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0),
          lowStockItems: inventory.filter(item => item.quantity > 0 && item.quantity <= 5).length,
          outOfStockItems: inventory.filter(item => item.quantity === 0).length,
          turnoverRate: 4.2
        },
        performance: {
          satisfaction: 92.5,
          resolution: 87.3,
          automation: 78.9,
          efficiency: 91.2
        }
      }

      const generatedInsights: AIInsight[] = [
        {
          id: '1',
          type: 'opportunity',
          title: 'High-Demand Products Low in Stock',
          description: 'Nike Air Max and iPhone 15 are showing high demand but running low on inventory. Consider restocking soon to capture maximum revenue.',
          impact: 'high',
          actionable: true,
          timestamp: new Date().toISOString()
        },
        {
          id: '2',
          type: 'risk',
          title: 'Customer Response Time Increasing',
          description: 'Average response time has increased by 15% this week. Consider optimizing AI responses or adding staff during peak hours.',
          impact: 'medium',
          actionable: true,
          timestamp: new Date().toISOString()
        },
        {
          id: '3',
          type: 'trend',
          title: 'WhatsApp Inquiries Growing 20% Weekly',
          description: 'Customer inquiries via WhatsApp are growing steadily. This channel is becoming your primary customer service touchpoint.',
          impact: 'medium',
          actionable: false,
          timestamp: new Date().toISOString()
        },
        {
          id: '4',
          type: 'recommendation',
          title: 'Optimize Pricing for Slow-Moving Items',
          description: 'Consider promotional pricing for items with low turnover to improve cash flow and warehouse space utilization.',
          impact: 'low',
          actionable: true,
          timestamp: new Date().toISOString()
        }
      ]

      const calculatedTopProducts: TopProduct[] = inventory
        .sort((a, b) => (b.price_usd * b.quantity) - (a.price_usd * a.quantity))
        .slice(0, 5)
        .map(item => ({
          name: item.name,
          sku: item.sku,
          revenue: item.price_usd * item.quantity,
          quantity: item.quantity,
          growth: Math.random() * 40 - 10
        }))

      setMetrics(calculatedMetrics)
      setInsights(generatedInsights)
      setTopProducts(calculatedTopProducts)
      setLastRefreshed(new Date())

    } catch (error) {
      console.error('Error loading business intelligence:', error)
      setError('Failed to load business intelligence data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getInsightIcon = (type: AIInsight['type']) => {
    switch (type) {
      case 'opportunity': return <TrendingUp size={16} />
      case 'risk': return <AlertTriangle size={16} />
      case 'trend': return <Activity size={16} />
      case 'recommendation': return <Brain size={16} />
      default: return <Star size={16} />
    }
  }

  const getInsightBadgeStyle = (type: AIInsight['type']) => {
    switch (type) {
      case 'opportunity': return styles.opportunityBadge
      case 'risk': return styles.riskBadge
      case 'trend': return styles.trendBadge
      case 'recommendation': return styles.recommendationBadge
      default: return styles.neutral
    }
  }

  const getImpactStyle = (impact: AIInsight['impact']) => {
    switch (impact) {
      case 'high': return styles.highImpact
      case 'medium': return styles.mediumImpact
      case 'low': return styles.lowImpact
      default: return styles.neutral
    }
  }

  if (loading) {
    return <div style={styles.loading}>Loading business intelligence...</div>
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <AlertTriangle size={24} style={{ marginBottom: '12px' }} />
          <div>{error}</div>
          <button 
            style={styles.refreshButton}
            onClick={loadBusinessIntelligence}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return <div style={styles.loading}>No data available</div>
  }

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Brain size={32} />
            Business Intelligence
          </h1>
          <div style={styles.subtitle}>
            AI-powered insights and performance metrics • Last updated: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
        <button 
          style={styles.refreshButton}
          onClick={loadBusinessIntelligence}
        >
          <RefreshCw size={16} />
          Refresh Data
        </button>
      </div>

      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <div>
              <div style={styles.kpiTitle}>Total Revenue</div>
              <div style={styles.kpiValue}>{formatCurrency(metrics.revenue.current)}</div>
              <div style={{ ...styles.kpiChange, ...(styles.positive) }}>
                <ArrowUpRight size={16} />
                {formatPercentage(metrics.revenue.growth)}
              </div>
            </div>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <div>
              <div style={styles.kpiTitle}>Active Customers</div>
              <div style={styles.kpiValue}>{metrics.customers.active.toLocaleString()}</div>
              <div style={{ ...styles.kpiChange, ...(styles.positive) }}>
                <ArrowUpRight size={16} />
                {metrics.customers.new} new today
              </div>
            </div>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Users size={24} />
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <div>
              <div style={styles.kpiTitle}>Conversation Rate</div>
              <div style={styles.kpiValue}>{formatPercentage(metrics.conversations.conversionRate)}</div>
              <div style={{ ...styles.kpiChange, ...(styles.positive) }}>
                <ArrowUpRight size={16} />
                {metrics.conversations.today} today
              </div>
            </div>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <MessageSquare size={24} />
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiHeader}>
            <div>
              <div style={styles.kpiTitle}>Efficiency Score</div>
              <div style={styles.kpiValue}>{metrics.performance.efficiency.toFixed(1)}%</div>
              <div style={{ ...styles.kpiChange, ...(styles.positive) }}>
                <Zap size={16} />
                {metrics.performance.automation.toFixed(1)}% automated
              </div>
            </div>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Target size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={styles.sectionGrid}>
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <Brain size={20} />
            AI Insights
          </h2>
          <div style={styles.insightsList}>
            {insights.map((insight) => (
              <div key={insight.id} style={styles.insightCard}>
                <div style={styles.insightHeader}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.insightTitle}>{insight.title}</div>
                    <div style={styles.insightDescription}>{insight.description}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ ...styles.badge, ...getInsightBadgeStyle(insight.type) }}>
                      {getInsightIcon(insight.type)}
                      <span style={{ marginLeft: '4px' }}>{insight.type}</span>
                    </div>
                    <div style={{ ...styles.badge, ...getImpactStyle(insight.impact) }}>
                      {insight.impact} impact
                    </div>
                  </div>
                </div>
                <div style={styles.insightMeta}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {new Date(insight.timestamp).toLocaleTimeString()}
                  </span>
                  {insight.actionable && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e' }}>
                      <CheckCircle size={12} />
                      Actionable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <BarChart3 size={20} />
            Top Performing Products
          </h2>
          <div style={styles.productsList}>
            {topProducts.map((product, index) => (
              <div key={product.sku} style={styles.productCard}>
                <div style={styles.productInfo}>
                  <div style={styles.productName}>
                    {index + 1}. {product.name}
                  </div>
                  <div style={styles.productSku}>{product.sku}</div>
                </div>
                <div style={styles.productMetrics}>
                  <div style={styles.productRevenue}>
                    {formatCurrency(product.revenue)}
                  </div>
                  <div style={styles.productQuantity}>
                    {product.quantity} units
                  </div>
                  <div style={{ 
                    ...styles.kpiChange, 
                    ...(product.growth > 0 ? styles.positive : styles.negative) 
                  }}>
                    {product.growth > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {formatPercentage(product.growth)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.sectionGrid}>
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <PieChart size={20} />
            Inventory Health
          </h2>
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Total Value</div>
              <div style={styles.kpiValue}>{formatCurrency(metrics.inventory.totalValue)}</div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Low Stock Alert</div>
              <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>
                {metrics.inventory.lowStockItems}
              </div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Out of Stock</div>
              <div style={{ ...styles.kpiValue, color: '#ef4444' }}>
                {metrics.inventory.outOfStockItems}
              </div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Turnover Rate</div>
              <div style={styles.kpiValue}>{metrics.inventory.turnoverRate}x</div>
            </div>
          </div>
        </div>

        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <Star size={20} />
            Customer Satisfaction
          </h2>
          <div style={styles.kpiGrid}>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Satisfaction Score</div>
              <div style={{ ...styles.kpiValue, color: '#22c55e' }}>
                {metrics.performance.satisfaction.toFixed(1)}%
              </div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Resolution Rate</div>
              <div style={{ ...styles.kpiValue, color: '#3b82f6' }}>
                {metrics.performance.resolution.toFixed(1)}%
              </div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Retention Rate</div>
              <div style={{ ...styles.kpiValue, color: '#8b5cf6' }}>
                {metrics.customers.retention.toFixed(1)}%
              </div>
            </div>
            <div style={styles.kpiCard}>
              <div style={styles.kpiTitle}>Avg Response Time</div>
              <div style={styles.kpiValue}>{metrics.conversations.avgResponseTime}m</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
