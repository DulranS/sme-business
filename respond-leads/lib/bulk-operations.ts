import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { ImportResult, ExportResult } from '../types'
import { CurrencyService } from './currency'

export interface BulkOperation {
  type: 'create' | 'update' | 'delete'
  items: any[]
}

export class BulkOperationsService {
  private supabase = getSupabaseClient()

  async bulkImport(file: File): Promise<ImportResult> {
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        return {
          success: false,
          total: 0,
          processed: 0,
          errors: 1,
          duration: '0s',
          errorDetails: ['File is empty']
        }
      }

      const headers = lines[0].split(',').map(h => h.trim())
      const items = []
      const errors = []
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim())
          const item: any = {}
          
          headers.forEach((header, index) => {
            const value = values[index]
            if (header === 'quantity' || header === 'price' || header === 'price_usd') {
              item[header] = parseFloat(value) || 0
            } else {
              item[header] = value
            }
          })
          
          // Validate required fields
          if (!item.name || !item.sku) {
            errors.push(`Row ${i + 1}: Missing required fields (name, sku)`)
            continue
          }
          
          // Normalize currency and set default if invalid
          item.currency = String(item.currency || '').trim().toUpperCase()
          if (!CurrencyService.isValidCurrency(item.currency)) {
            item.currency = 'USD'
          }

          // Calculate price_usd if not provided
          if (!item.price_usd && item.price) {
            item.price_usd = CurrencyService.convertToUSD(item.price, item.currency)
          }

          items.push(item)
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`)
        }
      }
      
      // Insert items in batches
      const batchSize = 50
      let successCount = 0
      const startTime = Date.now()
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize)
        const { data, error } = await this.supabase
          .from('inventory')
          .insert(batch)
          .select()
        
        if (error) {
          errors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
        } else {
          successCount += data?.length || 0
        }
      }
      
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
      
      const result: ImportResult = {
        success: errors.length === 0,
        total: lines.length - 1,
        processed: successCount,
        errors: errors.length,
        duration,
        errorDetails: errors
      }
      
      logger.database('Bulk import completed', { successCount, failedCount: errors.length })
      return result
      
    } catch (error) {
      logger.error('Bulk import failed', error as Error)
      return {
        success: false,
        total: 0,
        processed: 0,
        errors: 1,
        duration: '0s',
        errorDetails: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  async bulkExport(): Promise<ExportResult> {
    try {
      const startTime = Date.now()
      
      const { data: inventory, error } = await this.supabase
        .from('inventory')
        .select('*')
      
      if (error) throw error
      
      if (!inventory || inventory.length === 0) {
        return {
          success: false,
          total: 0,
          filename: 'inventory-export.csv',
          duration: '0s'
        }
      }

      const csvContent = this.exportToCSV(inventory)
      const filename = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
      
      // In a real implementation, you'd upload this to a storage service
      // For now, we'll just return the data
      const result: ExportResult = {
        success: true,
        total: inventory.length,
        filename,
        downloadUrl: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
        duration
      }
      
      logger.database('Bulk export completed', { total: inventory.length })
      return result
      
    } catch (error) {
      logger.error('Bulk export failed', error as Error)
      return {
        success: false,
        total: 0,
        filename: 'inventory-export.csv',
        duration: '0s'
      }
    }
  }

  async bulkUpdate(updates: Array<{ id: number; changes: any }>): Promise<ImportResult> {
    try {
      const errors = []
      let successCount = 0
      const startTime = Date.now()
      
      for (const update of updates) {
        try {
          const { error } = await this.supabase
            .from('inventory')
            .update(update.changes)
            .eq('id', update.id)
          
          if (error) {
            errors.push(`Item ${update.id}: ${error.message}`)
          } else {
            successCount++
          }
        } catch (error) {
          errors.push(`Item ${update.id}: ${error}`)
        }
      }
      
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
      
      const result: ImportResult = {
        success: errors.length === 0,
        total: updates.length,
        processed: successCount,
        errors: errors.length,
        duration,
        errorDetails: errors
      }
      
      logger.database('Bulk update completed', { successCount, failedCount: errors.length })
      return result
      
    } catch (error) {
      logger.error('Bulk update failed', error as Error)
      return {
        success: false,
        total: 0,
        processed: 0,
        errors: 1,
        duration: '0s',
        errorDetails: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  async bulkDelete(ids: number[]): Promise<ImportResult> {
    try {
      const errors = []
      let successCount = 0
      const startTime = Date.now()
      
      for (const id of ids) {
        try {
          const { error } = await this.supabase
            .from('inventory')
            .delete()
            .eq('id', id)
          
          if (error) {
            errors.push(`Item ${id}: ${error.message}`)
          } else {
            successCount++
          }
        } catch (error) {
          errors.push(`Item ${id}: ${error}`)
        }
      }
      
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`
      
      const result: ImportResult = {
        success: errors.length === 0,
        total: ids.length,
        processed: successCount,
        errors: errors.length,
        duration,
        errorDetails: errors
      }
      
      logger.database('Bulk delete completed', { successCount, failedCount: errors.length })
      return result
      
    } catch (error) {
      logger.error('Bulk delete failed', error as Error)
      return {
        success: false,
        total: 0,
        processed: 0,
        errors: 1,
        duration: '0s',
        errorDetails: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  exportToCSV(items: any[]): string {
    if (items.length === 0) return ''
    
    const headers = Object.keys(items[0])
    const csvLines = [headers.join(',')]
    
    items.forEach(item => {
      const values = headers.map(header => {
        const value = item[header]
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      })
      csvLines.push(values.join(','))
    })
    
    return csvLines.join('\n')
  }

  async getInventorySuggestions(): Promise<Array<{
    type: 'restock' | 'price_adjustment' | 'promotion'
    item: any
    reason: string
    priority: 'high' | 'medium' | 'low'
  }>> {
    try {
      const { data: inventory, error } = await this.supabase
        .from('inventory')
        .select('*')
      
      if (error) throw error
      
      const suggestions: Array<{
        type: 'restock' | 'price_adjustment' | 'promotion'
        item: any
        reason: string
        priority: 'high' | 'medium' | 'low'
      }> = []
      
      inventory?.forEach(item => {
        // Low stock suggestions
        if (item.quantity <= 5 && item.quantity > 0) {
          suggestions.push({
            type: 'restock' as const,
            item,
            reason: `Low stock: Only ${item.quantity} units remaining`,
            priority: item.quantity <= 2 ? 'high' : 'medium'
          })
        }
        
        // Out of stock suggestions
        if (item.quantity === 0) {
          suggestions.push({
            type: 'restock' as const,
            item,
            reason: 'Out of stock - immediate restocking required',
            priority: 'high'
          })
        }
        
        // Price adjustment suggestions (based on value)
        if (item.price_usd > 1000 && item.quantity > 50) {
          suggestions.push({
            type: 'price_adjustment' as const,
            item,
            reason: 'High-value item with large inventory - consider price optimization',
            priority: 'medium'
          })
        }
        
        // Promotion suggestions
        if (item.quantity > 100 && item.price_usd < 50) {
          suggestions.push({
            type: 'promotion' as const,
            item,
            reason: 'High inventory of low-value item - consider promotion',
            priority: 'low'
          })
        }
      })
      
      return suggestions.sort((a, b) => {
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      })
      
    } catch (error) {
      logger.error('Failed to generate inventory suggestions', error as Error)
      throw error
    }
  }
}

export const bulkOperationsService = new BulkOperationsService()
