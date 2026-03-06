import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

export interface AnalyticsMetrics {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  topSellingItems: Array<{
    id: number
    name: string
    quantity: number
    revenue: number
  }>
  lowStockAlerts: number
  outOfStockItems: number
  currencyDistribution: Record<string, number>
  salesTrend: Array<{
    date: string
    revenue: number
    orders: number
  }>
  customerSatisfaction: {
    positive: number
    neutral: number
    negative: number
    total: number
  }
}

export class AnalyticsService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  async getAnalyticsMetrics(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<AnalyticsMetrics> {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get inventory metrics
      const { data: inventory, error: inventoryError } = await this.supabase
        .from('inventory')
        .select('*')

      if (inventoryError) throw inventoryError

      // Get conversation metrics for sentiment analysis
      const { data: conversations, error: convoError } = await this.supabase
        .from('conversations')
        .select('*')
        .gte('created_at', startDate.toISOString())

      if (convoError) throw convoError

      // Calculate metrics
      const totalRevenue = inventory?.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0) || 0
      const totalOrders = conversations?.length || 0
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Top selling items (simulated based on quantity)
      const topSellingItems = (inventory || [])
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          revenue: item.price_usd * item.quantity
        }))

      // Stock alerts
      const lowStockAlerts = inventory?.filter(item => item.quantity > 0 && item.quantity <= 5).length || 0
      const outOfStockItems = inventory?.filter(item => item.quantity === 0).length || 0

      // Currency distribution
      const currencyDistribution = (inventory || []).reduce((acc, item) => {
        acc[item.currency] = (acc[item.currency] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Sales trend (simulated daily data)
      const salesTrend = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        salesTrend.push({
          date: date.toISOString().split('T')[0],
          revenue: Math.floor(Math.random() * 1000) + 200, // Simulated data
          orders: Math.floor(Math.random() * 10) + 1
        })
      }

      // Customer sentiment analysis (simulated)
      const sentiment = this.analyzeSentiment(conversations || [])

      const metrics: AnalyticsMetrics = {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        topSellingItems,
        lowStockAlerts,
        outOfStockItems,
        currencyDistribution,
        salesTrend,
        customerSatisfaction: sentiment
      }

      logger.info('Analytics metrics generated successfully', { timeframe, metrics })
      return metrics

    } catch (error) {
      logger.error('Failed to generate analytics metrics', error as Error)
      throw error
    }
  }

  private analyzeSentiment(conversations: any[]) {
    // Simple sentiment analysis based on message content
    let positive = 0, neutral = 0, negative = 0

    conversations.forEach(convo => {
      const messages = convo.messages || []
      messages.forEach((msg: any) => {
        const text = msg.message?.toLowerCase() || ''
        if (text.includes('good') || text.includes('great') || text.includes('excellent') || text.includes('thank')) {
          positive++
        } else if (text.includes('bad') || text.includes('terrible') || text.includes('awful') || text.includes('problem')) {
          negative++
        } else {
          neutral++
        }
      })
    })

    return { positive, neutral, negative, total: conversations.length }
  }

  async getInventoryInsights() {
    try {
      const { data: inventory, error } = await this.supabase
        .from('inventory')
        .select('*')

      if (error) throw error

      const insights = {
        totalValue: inventory?.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0) || 0,
        totalItems: inventory?.length || 0,
        averagePrice: inventory?.reduce((sum, item) => sum + item.price_usd, 0) / (inventory?.length || 1) || 0,
        currencyBreakdown: inventory?.reduce((acc, item) => {
          acc[item.currency] = (acc[item.currency] || 0) + (item.price_usd * item.quantity)
          return acc
        }, {} as Record<string, number>),
        stockHealth: {
          healthy: inventory?.filter(item => item.quantity > 10).length || 0,
          low: inventory?.filter(item => item.quantity > 0 && item.quantity <= 10).length || 0,
          out: inventory?.filter(item => item.quantity === 0).length || 0
        }
      }

      return insights
    } catch (error) {
      logger.error('Failed to get inventory insights', error as Error)
      throw error
    }
  }
}

export const analyticsService = new AnalyticsService()
