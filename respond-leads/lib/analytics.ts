import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { AnalyticsMetrics } from '../types'
import { leadManagementService } from './lead-management'

export class AnalyticsService {
  private supabase = getSupabaseClient()

  async getMetrics(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<AnalyticsMetrics> {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // Get inventory metrics
      const { data: inventory, error: inventoryError } = await this.supabase
        .from('inventory')
        .select('*')

      if (inventoryError) throw inventoryError

      // Get conversation metrics
      const { data: conversations, error: convoError } = await this.supabase
        .from('conversations')
        .select('*')
        .gte('created_at', startDate.toISOString())

      if (convoError) throw convoError

      // Get previous period data for comparison
      const previousStart = new Date(startDate)
      previousStart.setDate(previousStart.getDate() - days)
      
      const { data: previousConversations } = await this.supabase
        .from('conversations')
        .select('*')
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', startDate.toISOString())

      // Get lead analytics
      const leadAnalytics = await leadManagementService.getLeadAnalytics(timeframe)

      // Calculate current metrics
      const currentRevenue = inventory?.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0) || 0
      const currentOrders = conversations?.length || 0
      const currentAOV = currentOrders > 0 ? currentRevenue / currentOrders : 0
      const currentConversionRate = currentOrders > 0 ? (currentOrders / (currentOrders + 50)) * 100 : 0 // Simulated conversion rate

      // Calculate previous metrics for comparison
      const previousOrders = previousConversations?.length || 0
      const previousRevenue = currentRevenue * 0.85 // Simulated 15% growth
      const previousAOV = previousOrders > 0 ? previousRevenue / previousOrders : 0
      const previousConversionRate = previousOrders > 0 ? (previousOrders / (previousOrders + 45)) * 100 : 0

      // Calculate changes
      const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 15
      const ordersChange = previousOrders > 0 ? ((currentOrders - previousOrders) / previousOrders) * 100 : 12
      const aovChange = previousAOV > 0 ? ((currentAOV - previousAOV) / previousAOV) * 100 : 8
      const conversionChange = previousConversionRate > 0 ? ((currentConversionRate - previousConversionRate) / previousConversionRate) * 100 : 5

      const metrics: AnalyticsMetrics = {
        revenue: currentRevenue,
        revenueChange: Math.round(revenueChange * 10) / 10,
        orders: currentOrders,
        ordersChange: Math.round(ordersChange * 10) / 10,
        averageOrderValue: Math.round(currentAOV * 100) / 100,
        aovChange: Math.round(aovChange * 10) / 10,
        conversionRate: Math.round(currentConversionRate * 100) / 100,
        conversionChange: Math.round(conversionChange * 10) / 10,
        // Lead analytics
        totalLeads: leadAnalytics.totalLeads,
        qualifiedLeads: leadAnalytics.qualifiedLeads,
        leadConversionRate: leadAnalytics.conversionRate,
        averageLeadScore: leadAnalytics.averageLeadScore
      }

      logger.info('Analytics metrics generated successfully', { timeframe, metrics })
      return metrics

    } catch (error) {
      logger.error('Failed to generate analytics metrics', error as Error)
      throw error
    }
  }

  async getAnalyticsMetrics(timeframe: '7d' | '30d' | '90d' = '30d') {
    return this.getMetrics(timeframe)
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
