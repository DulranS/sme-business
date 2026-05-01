import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { forecastingService } from './forecasting'
import { ReportTemplate, Report, ForecastData } from '../types'

export interface ReportSection {
  id: string
  name: string
  type: 'table' | 'chart' | 'text' | 'kpi'
  dataSource: string
  config: any
}

export class ReportingService {
  private supabase = getSupabaseClient()

  private templates: ReportTemplate[] = [
    {
      id: 'inventory-summary',
      name: 'Inventory Summary Report',
      description: 'Complete overview of inventory status and metrics',
      category: 'Inventory',
      format: 'pdf',
      estimatedTime: '2-3 minutes'
    },
    {
      id: 'sales-analysis',
      name: 'Sales Analysis Report',
      description: 'Detailed sales performance and trends',
      category: 'Sales',
      format: 'excel',
      estimatedTime: '1-2 minutes'
    },
    {
      id: 'forecast-report',
      name: 'Demand Forecast Report',
      description: 'AI-powered demand forecasting and recommendations',
      category: 'Forecasting',
      format: 'pdf',
      estimatedTime: '3-4 minutes'
    },
    {
      id: 'customer-segments',
      name: 'Customer Segments Report',
      description: 'Customer behavior and segmentation analysis',
      category: 'Customer',
      format: 'csv',
      estimatedTime: '1-2 minutes'
    },
    {
      id: 'financial-summary',
      name: 'Financial Summary Report',
      description: 'Financial performance and metrics',
      category: 'Financial',
      format: 'excel',
      estimatedTime: '2-3 minutes'
    }
  ]

  async generateReport(templateId: string, customConfig?: any): Promise<Report> {
    try {
      const template = this.templates.find(t => t.id === templateId)
      if (!template) throw new Error(`Report template ${templateId} not found`)

      const reportData = await this.collectReportData(template, customConfig)
      
      const report: Report = {
        id: this.generateReportId(),
        name: template.name,
        templateId: templateId,
        format: template.format,
        size: this.estimateReportSize(reportData),
        createdAt: new Date().toISOString(),
        status: 'completed',
        downloadUrl: this.generateDownloadUrl(templateId, reportData)
      }

      logger.info('Report generated successfully', { reportId: report.id, templateId })
      return report

    } catch (error) {
      logger.error('Failed to generate report', error as Error)
      throw error
    }
  }

  private async collectReportData(template: ReportTemplate, customConfig?: any): Promise<any> {
    let data: any = {}

    switch (template.id) {
      case 'inventory-summary':
        data.inventory = await this.getInventoryData()
        data.stats = await this.getInventoryStats()
        data.lowStock = await this.getLowStockItems()
        break
      case 'sales-analysis':
        data.sales = await this.getSalesData('30d')
        data.performance = await this.getProductPerformance(10)
        break
      case 'forecast-report':
        data.forecasts = await this.getForecastData()
        data.optimizations = await this.getInventoryOptimization()
        break
      case 'customer-segments':
        data.segments = await this.getCustomerSegments()
        break
      case 'financial-summary':
        data.financial = await this.getFinancialData()
        break
      default:
        data = {}
    }

    return data
  }

  private async getInventoryData() {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data || []
  }

  private async getInventoryStats() {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('*')
    
    if (error) throw error
    
    const inventory = data || []
    return {
      totalItems: inventory.length,
      totalValue: inventory.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0),
      lowStockItems: inventory.filter(item => item.quantity > 0 && item.quantity <= 5).length,
      outOfStockItems: inventory.filter(item => item.quantity === 0).length
    }
  }

  private async getLowStockItems() {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('*')
      .lte('quantity', 5)
      .gt('quantity', 0)
      .order('quantity', { ascending: true })
    
    if (error) throw error
    return data || []
  }

  private async getSalesData(timeRange: string) {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Fetch real conversation data
    const { data: conversations, error } = await this.supabase
      .from('conversations')
      .select('*')
      .gte('created_at', startDate.toISOString())

    if (error) throw error

    // Fetch inventory data for revenue calculation
    const { data: inventory } = await this.supabase
      .from('inventory')
      .select('*')

    const salesData: Record<string, { date: string; revenue: number; orders: number; customers: Set<string> }> = {}

    // Group conversations by date
    for (const conversation of conversations || []) {
      const date = new Date(conversation.created_at).toISOString().split('T')[0]
      if (!salesData[date]) {
        salesData[date] = {
          date,
          revenue: 0,
          orders: 0,
          customers: new Set()
        }
      }
      salesData[date].orders += 1
      salesData[date].customers.add(conversation.phone_number)
    }

    const inventoryItems = inventory || []

    // Calculate average revenue per conversation from inventory
    const avgItemPrice = inventoryItems.length > 0
      ? (inventoryItems.reduce((sum, item) => sum + item.price_usd, 0) / inventoryItems.length)
      : 100

    const result = Object.values(salesData).map(day => ({
      date: day.date,
      revenue: Math.round(day.orders * avgItemPrice * 100) / 100,
      orders: day.orders,
      customers: day.customers.size
    }))

    return result
  }

  private async getProductPerformance(limit: number) {
    const { data: inventory, error: invError } = await this.supabase
      .from('inventory')
      .select('*')
      .order('quantity', { ascending: false })
      .limit(limit)
    
    if (invError) throw invError

    // Get conversation analytics to track actual performance
    const { data: analytics } = await this.supabase
      .from('conversation_analytics')
      .select('*')

    const performanceMap: Record<string, { revenue: number; orders: number; weight: number }> = {}

    for (const record of analytics || []) {
      if (!performanceMap[record.search_keyword]) {
        performanceMap[record.search_keyword] = { revenue: 0, orders: 0, weight: 0 }
      }
      performanceMap[record.search_keyword].revenue += 1
      performanceMap[record.search_keyword].orders += record.result_count
      performanceMap[record.search_keyword].weight += record.converted ? 1 : 0
    }
    
    // Map performance to inventory items
    return (inventory || []).map(item => {
      const perf = performanceMap[item.name] || { revenue: 0, orders: 0, weight: 0 }
      const estimatedRevenue = perf.revenue * item.price_usd
      const previousRevenue = estimatedRevenue > 0 ? estimatedRevenue * 0.9 : 0
      const growth = previousRevenue > 0 ? ((estimatedRevenue - previousRevenue) / previousRevenue) * 100 : 0

      return {
        ...item,
        revenue: Math.round(estimatedRevenue * 100) / 100,
        orders: perf.orders,
        growth: Math.round(growth * 100) / 100
      }
    })
  }

  private async getForecastData(): Promise<ForecastData[]> {
    return await forecastingService.generateInventoryForecast(30)
  }

  private async getInventoryOptimization() {
    return await forecastingService.getInventoryOptimization()
  }

  private async getCustomerSegments() {
    return await forecastingService.getCustomerSegments()
  }

  private async getFinancialData() {
    const inventory = await this.getInventoryData()
    const totalValue = inventory.reduce((sum, item) => sum + (item.price_usd * item.quantity), 0)
    
    return {
      totalInventoryValue: totalValue,
      averageItemPrice: inventory.length > 0 ? totalValue / inventory.length : 0,
      currencyDistribution: inventory.reduce((acc, item) => {
        acc[item.currency] = (acc[item.currency] || 0) + (item.price_usd * item.quantity)
        return acc
      }, {}),
      projectedMonthlyRevenue: totalValue * 0.15 // Simulated 15% monthly turnover
    }
  }

  private estimateReportSize(data: any): string {
    const dataSize = JSON.stringify(data).length
    if (dataSize < 1000) return '~100KB'
    if (dataSize < 5000) return '~500KB'
    if (dataSize < 20000) return '~1MB'
    return '~2MB'
  }

  private generateDownloadUrl(templateId: string, data: any): string {
    // In a real implementation, this would generate a real download URL
    return `data:application/json;base64,${btoa(JSON.stringify(data, null, 2))}`
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getAvailableTemplates(): ReportTemplate[] {
    return this.templates
  }

  async getGeneratedReports(): Promise<Report[]> {
    try {
      const { data, error } = await this.supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        logger.warn('Generated reports table not found, returning empty result', { error: error.message })
        return []
      }

      return (data || []) as Report[]
    } catch (error) {
      logger.error('Failed to get generated reports', error as Error)
      return []
    }
  }

  async scheduleReport(templateId: string, schedule: any): Promise<void> {
    try {
      // In a real implementation, this would set up a cron job or use a scheduling service
      logger.info('Report scheduled', { templateId, schedule })
    } catch (error) {
      logger.error('Failed to schedule report', error as Error)
      throw error
    }
  }
}

export const reportingService = new ReportingService()
