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
    // Simulate sales data generation
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const salesData = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      salesData.push({
        date: date.toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 1000) + 200,
        orders: Math.floor(Math.random() * 10) + 1,
        customers: Math.floor(Math.random() * 8) + 1
      })
    }
    
    return salesData
  }

  private async getProductPerformance(limit: number) {
    const { data, error } = await this.supabase
      .from('inventory')
      .select('*')
      .order('quantity', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    // Simulate performance metrics
    return (data || []).map(item => ({
      ...item,
      revenue: item.price_usd * item.quantity * (Math.random() * 2 + 0.5),
      orders: Math.floor(item.quantity * (Math.random() * 0.3 + 0.1)),
      growth: (Math.random() - 0.5) * 40
    }))
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
      // In a real implementation, this would fetch from a database
      // For now, return mock data
      return [
        {
          id: 'report_123',
          name: 'Inventory Summary - March 2026',
          templateId: 'inventory-summary',
          format: 'pdf',
          size: '~1.2MB',
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          status: 'completed',
          downloadUrl: '#'
        },
        {
          id: 'report_124',
          name: 'Sales Analysis - March 2026',
          templateId: 'sales-analysis',
          format: 'excel',
          size: '~850KB',
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          status: 'completed',
          downloadUrl: '#'
        }
      ]
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
