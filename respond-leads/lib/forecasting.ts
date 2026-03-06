import { getSupabaseClient } from './supabase'
import { logger } from './logger'

export interface ForecastData {
  itemId: number
  itemName: string
  currentStock: number
  avgDailyDemand: number
  predictedDemand: number[]
  reorderPoint: number
  optimalOrderQuantity: number
  safetyStock: number
  leadTime: number
  stockoutRisk: number
  recommendation: 'order_now' | 'monitor' | 'overstocked'
}

export interface CustomerSegment {
  id: string
  name: string
  customerCount: number
  avgOrderValue: number
  totalRevenue: number
  preferredProducts: number[]
  characteristics: string[]
}

export interface InventoryOptimization {
  totalValue: number
  turnoverRate: number
  deadStockItems: number[]
  fastMovingItems: number[]
  slowMovingItems: number[]
  optimalStockLevels: Record<number, number>
  potentialSavings: number
}

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
    const predictedDemand = []
    for (let i = 1; i <= days; i++) {
      const demand = avgDailyDemand * seasonalFactor * trendFactor * (1 + (Math.random() - 0.5) * 0.2)
      predictedDemand.push(Math.max(0, Math.round(demand)))
    }

    // Calculate safety stock (standard deviation * service level)
    const demandVariability = this.calculateDemandVariability(avgDailyDemand)
    const safetyStock = Math.ceil(demandVariability * 1.65) // 95% service level

    // Calculate reorder point (daily demand * lead time + safety stock)
    const leadTime = 7 // Default 7 days lead time
    const reorderPoint = Math.ceil(avgDailyDemand * leadTime + safetyStock)

    // Calculate optimal order quantity (EOQ formula)
    const holdingCost = 0.25 // 25% annual holding cost
    const orderingCost = 50 // Fixed ordering cost
    const optimalOrderQuantity = Math.ceil(Math.sqrt((2 * orderingCost * avgDailyDemand * 365) / (item.price_usd * holdingCost)))

    // Calculate stockout risk
    const totalPredictedDemand = predictedDemand.reduce((sum, demand) => sum + demand, 0)
    const stockoutRisk = item.quantity < reorderPoint ? 1 : Math.max(0, (reorderPoint - item.quantity) / reorderPoint)

    // Generate recommendation
    let recommendation: 'order_now' | 'monitor' | 'overstocked'
    if (item.quantity <= reorderPoint) {
      recommendation = 'order_now'
    } else if (item.quantity > reorderPoint * 2) {
      recommendation = 'overstocked'
    } else {
      recommendation = 'monitor'
    }

    return {
      itemId: item.id,
      itemName: item.name,
      currentStock: item.quantity,
      avgDailyDemand,
      predictedDemand,
      reorderPoint,
      optimalOrderQuantity,
      safetyStock,
      leadTime,
      stockoutRisk,
      recommendation
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

  private calculateDemandVariability(avgDemand: number): number {
    // Simulate demand variability (coefficient of variation)
    return avgDemand * 0.3 // 30% variability
  }

  async getInventoryOptimization(): Promise<InventoryOptimization> {
    try {
      const { data: inventory, error } = await this.supabase
        .from('inventory')
        .select('*')
      
      if (error) throw error

      const totalValue = inventory?.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0) || 0
      const totalCost = inventory?.reduce((sum, item) => sum + (item.price_usd * item.quantity * 0.5), 0) || 0
      const turnoverRate = totalCost > 0 ? totalValue / totalCost : 0

      // Categorize items by movement
      const deadStockItems = inventory?.filter(item => item.quantity === 0).map(item => item.id) || []
      const fastMovingItems = inventory?.filter(item => item.quantity > 50).map(item => item.id) || []
      const slowMovingItems = inventory?.filter(item => item.quantity > 0 && item.quantity <= 10).map(item => item.id) || []

      // Calculate optimal stock levels
      const optimalStockLevels: Record<number, number> = {}
      let potentialSavings = 0

      inventory?.forEach(item => {
        const avgDemand = this.calculateAverageDemand(item)
        const optimalLevel = Math.ceil(avgDemand * 30) // 30 days supply
        optimalStockLevels[item.id] = optimalLevel
        
        if (item.quantity > optimalLevel) {
          const excessValue = (item.quantity - optimalLevel) * item.price_usd
          potentialSavings += excessValue * 0.2 // 20% holding cost reduction
        }
      })

      const optimization: InventoryOptimization = {
        totalValue,
        turnoverRate,
        deadStockItems,
        fastMovingItems,
        slowMovingItems,
        optimalStockLevels,
        potentialSavings
      }

      logger.info('Inventory optimization analysis completed', optimization)
      return optimization

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
          customerCount: 45,
          avgOrderValue: 250,
          totalRevenue: 11250,
          preferredProducts: [1, 2, 3],
          characteristics: ['Frequent buyers', 'High average order value', 'Premium product preference']
        },
        {
          id: 'regular',
          name: 'Regular Customers',
          customerCount: 120,
          avgOrderValue: 85,
          totalRevenue: 10200,
          preferredProducts: [4, 5, 6],
          characteristics: ['Consistent purchasing', 'Mid-range spending', 'Product variety']
        },
        {
          id: 'new',
          name: 'New Customers',
          customerCount: 67,
          avgOrderValue: 45,
          totalRevenue: 3015,
          preferredProducts: [7, 8],
          characteristics: ['First-time buyers', 'Lower average order value', 'Price sensitive']
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
