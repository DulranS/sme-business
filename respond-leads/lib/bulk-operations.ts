import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

export interface BulkOperation {
  type: 'create' | 'update' | 'delete'
  items: any[]
}

export interface ImportResult {
  success: number
  failed: number
  errors: string[]
  items: any[]
}

export class BulkOperationsService {
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  async bulkImport(csvData: string): Promise<ImportResult> {
    try {
      const lines = csvData.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      
      const items = []
      const errors = []
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim())
          const item: any = {}
          
          headers.forEach((header, index) => {
            const value = values[index]
            if (header === 'quantity' || header === 'price') {
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
          
          // Set default currency if not provided
          if (!item.currency) {
            item.currency = 'USD'
          }
          
          items.push(item)
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error}`)
        }
      }
      
      // Insert items in batches
      const batchSize = 50
      let successCount = 0
      
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
      
      const result: ImportResult = {
        success: successCount,
        failed: errors.length,
        errors,
        items
      }
      
      logger.database('Bulk import completed', { successCount, failedCount: errors.length })
      return result
      
    } catch (error) {
      logger.error('Bulk import failed', error as Error)
      throw error
    }
  }

  async bulkUpdate(updates: Array<{ id: number; changes: any }>): Promise<ImportResult> {
    try {
      const errors = []
      let successCount = 0
      
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
      
      const result: ImportResult = {
        success: successCount,
        failed: errors.length,
        errors,
        items: updates
      }
      
      logger.database('Bulk update completed', { successCount, failedCount: errors.length })
      return result
      
    } catch (error) {
      logger.error('Bulk update failed', error as Error)
      throw error
    }
  }

  async bulkDelete(ids: number[]): Promise<ImportResult> {
    try {
      const errors = []
      let successCount = 0
      
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
      
      const result: ImportResult = {
        success: successCount,
        failed: errors.length,
        errors,
        items: ids
      }
      
      logger.database('Bulk delete completed', { successCount, failedCount: errors.length })
      return result
      
    } catch (error) {
      logger.error('Bulk delete failed', error as Error)
      throw error
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
