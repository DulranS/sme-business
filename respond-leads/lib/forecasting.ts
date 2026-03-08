import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { ForecastData, CustomerSegment, InventoryOptimization } from '../types'

export class ForecastingService {
  private supabase = getSupabaseClient()

  async generateInventoryForecast(days: number = 30): Promise<ForecastData[]> {
    try {
      const { data: inventory, error: inventoryError } = await this.supabase
        .from('inventory')
        .select('*')
      
      if (inventoryError) throw inventoryError

      const forecasts: ForecastData[] = []

      for (const item of inventory || []) {
        const forecast = await this.calculateItemForecast(item, days)
        forecasts.push(forecast)
      }

      logger.info('Inventory forecast generated', { itemCount: forecasts.length, days })
      return forecasts

    } catch (error) {
      logger.error('Failed to generate inventory forecast', error as Error)
      throw error
    }
  }

  private async calculateItemForecast(item: any, days: number): Promise<ForecastData> {
    // Simulate historical demand calculation
    const avgDailyDemand = this.calculateAverageDemand(item)
    const seasonalFactor = this.getSeasonalFactor(item.name)
    const trendFactor = this.getTrendFactor(item.name)
    
    // Generate predicted demand for next days
    const totalPredictedDemand = avgDailyDemand * seasonalFactor * trendFactor * days
    const predictedRevenue = totalPredictedDemand * item.price_usd
    const confidence = 0.85 + (Math.random() * 0.1) // 85-95% confidence

    return {
      id: item.id.toString(),
      productName: item.name,
      predictedDemand: Math.round(totalPredictedDemand),
      predictedRevenue: Math.round(predictedRevenue * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      timeRange: `${days} days`
    }
  }

  private calculateAverageDemand(item: any): number {
    // Simulate demand calculation based on item characteristics
    const baseDemand = item.price_usd < 50 ? 5 : item.price_usd < 200 ? 2 : 0.5
    const seasonalMultiplier = this.getSeasonalFactor(item.name)
    return Math.max(0.1, baseDemand * seasonalMultiplier)
  }

  private getSeasonalFactor(itemName: string): number {
    // Simulate seasonal patterns
    const seasonalKeywords = {
      'winter': 1.5,
      'summer': 1.3,
      'holiday': 2.0,
      'christmas': 2.5,
      'gift': 1.8
    }

    const name = itemName.toLowerCase()
    for (const [keyword, factor] of Object.entries(seasonalKeywords)) {
      if (name.includes(keyword)) return factor
    }
    return 1.0
  }

  private getTrendFactor(itemName: string): number {
    // Simulate trend analysis
    const trendingKeywords = {
      'new': 1.2,
      'popular': 1.5,
      'premium': 0.8,
      'basic': 1.1
    }

    const name = itemName.toLowerCase()
    for (const [keyword, factor] of Object.entries(trendingKeywords)) {
      if (name.includes(keyword)) return factor
    }
    return 1.0
  }

  async getInventoryOptimization(): Promise<InventoryOptimization[]> {
    try {
      const { data: inventory, error } = await this.supabase
        .from('inventory')
        .select('*')
      
      if (error) throw error

      const optimizations: InventoryOptimization[] = []

      inventory?.forEach(item => {
        const avgDemand = this.calculateAverageDemand(item)
        const optimalLevel = Math.ceil(avgDemand * 30) // 30 days supply
        
        let status: 'order-now' | 'monitor' | 'overstocked'
        let priority: 'high' | 'medium' | 'low'
        let recommendedOrder = 0
        const recommendations: string[] = []

        if (item.quantity === 0) {
          status = 'order-now'
          priority = 'high'
          recommendedOrder = optimalLevel
          recommendations.push('Item out of stock - immediate reorder required')
        } else if (item.quantity <= optimalLevel * 0.3) {
          status = 'order-now'
          priority = 'high'
          recommendedOrder = optimalLevel - item.quantity
          recommendations.push('Low stock - reorder recommended')
        } else if (item.quantity > optimalLevel * 2) {
          status = 'overstocked'
          priority = 'medium'
          recommendations.push('Overstocked - consider promotion or discount')
        } else {
          status = 'monitor'
          priority = 'low'
          recommendations.push('Stock level adequate - continue monitoring')
        }

        optimizations.push({
          id: item.id.toString(),
          productName: item.name,
          currentStock: item.quantity,
          recommendedOrder,
          priority,
          status,
          recommendations
        })
      })

      logger.info('Inventory optimization analysis completed', { itemCount: optimizations.length })
      return optimizations

    } catch (error) {
      logger.error('Failed to analyze inventory optimization', error as Error)
      throw error
    }
  }

  async getCustomerSegments(): Promise<CustomerSegment[]> {
    try {
      // Simulate customer segmentation based on conversations
      const segments: CustomerSegment[] = [
        {
          id: 'high-value',
          name: 'High Value Customers',
          size: 45,
          growthRate: 15.2,
          retentionRate: 87.5,
          averageOrderValue: 250
        },
        {
          id: 'regular',
          name: 'Regular Customers',
          size: 120,
          growthRate: 8.7,
          retentionRate: 72.3,
          averageOrderValue: 85
        },
        {
          id: 'new',
          name: 'New Customers',
          size: 67,
          growthRate: 23.4,
          retentionRate: 45.8,
          averageOrderValue: 45
        }
      ]

      logger.info('Customer segmentation analysis completed', { segmentCount: segments.length })
      return segments

    } catch (error) {
      logger.error('Failed to analyze customer segments', error as Error)
      throw error
    }
  }
}

export const forecastingService = new ForecastingService()
