import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { forecastingService, ForecastData } from './forecasting'

export interface Report {
  id: string
  name: string
  type: 'inventory' | 'sales' | 'forecasting' | 'customer' | 'financial'
  format: 'pdf' | 'excel' | 'csv'
  generatedAt: Date
  data: any
  scheduled?: boolean
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    recipients: string[]
    nextRun: Date
  }
}

export interface ReportTemplate {
  id: string
  name: string
  description: string
  type: Report['type']
  format: Report['format']
  sections: ReportSection[]
}

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
      type: 'inventory',
      format: 'pdf',
      sections: [
        {
          id: 'kpi-overview',
          name: 'Key Performance Indicators',
          type: 'kpi',
          dataSource: 'inventory_stats',
          config: {
            metrics: ['total_items', 'total_value', 'low_stock', 'out_of_stock']
          }
        },
        {
          id: 'inventory-table',
          name: 'Inventory Details',
          type: 'table',
          dataSource: 'inventory',
          config: {
            columns: ['name', 'sku', 'quantity', 'price', 'currency', 'status']
          }
        },
        {
          id: 'stock-alerts',
          name: 'Stock Alerts',
          type: 'table',
          dataSource: 'low_stock_items',
          config: {
            columns: ['name', 'current_stock', 'reorder_point', 'urgency']
          }
        }
      ]
    },
    {
      id: 'sales-analysis',
      name: 'Sales Analysis Report',
      description: 'Detailed sales performance and trends',
      type: 'sales',
      format: 'excel',
      sections: [
        {
          id: 'sales-trend',
          name: 'Sales Trend',
          type: 'chart',
          dataSource: 'sales_data',
          config: {
            chartType: 'line',
            timeRange: '30d'
          }
        },
        {
          id: 'top-products',
          name: 'Top Selling Products',
          type: 'table',
          dataSource: 'product_performance',
          config: {
            sortBy: 'revenue',
            limit: 10
          }
        }
      ]
    },
    {
      id: 'forecast-report',
      name: 'Demand Forecast Report',
      description: 'AI-powered demand forecasting and recommendations',
      type: 'forecasting',
      format: 'pdf',
      sections: [
        {
          id: 'forecast-summary',
          name: 'Forecast Summary',
          type: 'kpi',
          dataSource: 'forecast_data',
          config: {
            metrics: ['total_predicted_demand', 'high_risk_items', 'recommended_orders']
          }
        },
        {
          id: 'forecast-table',
          name: 'Detailed Forecasts',
          type: 'table',
          dataSource: 'forecast_data',
          config: {
            columns: ['item_name', 'current_stock', 'predicted_demand', 'reorder_point', 'recommendation']
          }
        }
      ]
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
        type: template.type,
        format: template.format,
        generatedAt: new Date(),
        data: reportData
      }

      logger.info('Report generated successfully', { reportId: report.id, templateId })
      return report

    } catch (error) {
      logger.error('Failed to generate report', error as Error)
      throw error
    }
  }

  private async collectReportData(template: ReportTemplate, customConfig?: any): Promise<any> {
    const data: any = {}

    for (const section of template.sections) {
      switch (section.dataSource) {
        case 'inventory':
          data[section.id] = await this.getInventoryData()
          break
        case 'inventory_stats':
          data[section.id] = await this.getInventoryStats()
          break
        case 'low_stock_items':
          data[section.id] = await this.getLowStockItems()
          break
        case 'sales_data':
          data[section.id] = await this.getSalesData(section.config?.timeRange || '30d')
          break
        case 'product_performance':
          data[section.id] = await this.getProductPerformance(section.config?.limit || 10)
          break
        case 'forecast_data':
          data[section.id] = await this.getForecastData()
          break
        default:
          data[section.id] = []
      }
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
      .from('inventory_stats')
      .select('*')
      .single()
    
    if (error) throw error
    return data
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

  async exportReport(report: Report): Promise<Blob> {
    try {
      let blob: Blob

      switch (report.format) {
        case 'csv':
          blob = await this.generateCSV(report)
          break
        case 'excel':
          blob = await this.generateExcel(report)
          break
        case 'pdf':
          blob = await this.generatePDF(report)
          break
        default:
          throw new Error(`Unsupported format: ${report.format}`)
      }

      logger.info('Report exported successfully', { reportId: report.id, format: report.format })
      return blob

    } catch (error) {
      logger.error('Failed to export report', error as Error)
      throw error
    }
  }

  private async generateCSV(report: Report): Promise<Blob> {
    const csvData = this.convertToCSV(report.data)
    return new Blob([csvData], { type: 'text/csv' })
  }

  private async generateExcel(report: Report): Promise<Blob> {
    // Simplified Excel generation (would use a library like xlsx in production)
    const csvData = this.convertToCSV(report.data)
    return new Blob([csvData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }

  private async generatePDF(report: Report): Promise<Blob> {
    // Simplified PDF generation (would use a library like jsPDF in production)
    const htmlContent = this.convertToHTML(report)
    return new Blob([htmlContent], { type: 'application/pdf' })
  }

  private convertToCSV(data: any): string {
    if (!Array.isArray(data)) return ''
    
    const headers = Object.keys(data[0] || {})
    const csvRows = [headers.join(',')]
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      })
      csvRows.push(values.join(','))
    }
    
    return csvRows.join('\n')
  }

  private convertToHTML(report: Report): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${report.name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>${report.name}</h1>
        <p>Generated on: ${report.generatedAt.toLocaleString()}</p>
        <pre>${JSON.stringify(report.data, null, 2)}</pre>
      </body>
      </html>
    `
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getAvailableTemplates(): ReportTemplate[] {
    return this.templates
  }

  async scheduleReport(templateId: string, schedule: Report['schedule']): Promise<void> {
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
