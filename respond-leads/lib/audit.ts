import { getSupabaseClient } from './supabase'
import { logger } from './logger'

export interface AuditLog {
  id: string
  userId?: string
  action: string
  resourceType: 'inventory' | 'conversation' | 'user' | 'system'
  resourceId?: string
  resourceName?: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  userAgent?: string
  timestamp: Date
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'create' | 'read' | 'update' | 'delete' | 'login' | 'system'
  description: string
}

export interface ActivitySummary {
  totalActions: number
  actionsByType: Record<string, number>
  actionsByUser: Record<string, number>
  actionsByResource: Record<string, number>
  recentActivity: AuditLog[]
  criticalActions: AuditLog[]
  timeRange: string
}

export class AuditService {
  private supabase = getSupabaseClient()

  async logActivity(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditLog: AuditLog = {
        ...entry,
        id: this.generateLogId(),
        timestamp: new Date()
      }

      // In a real implementation, this would save to a dedicated audit_logs table
      // For now, we'll log to the console and store in memory for demo purposes
      logger.info('Audit log entry created', auditLog)

      // Check if this is a critical action that needs immediate attention
      if (entry.severity === 'critical' || entry.severity === 'high') {
        await this.handleCriticalAction(auditLog)
      }

    } catch (error) {
      logger.error('Failed to log audit activity', error as Error)
      throw error
    }
  }

  async logInventoryAction(
    action: string,
    itemId: string,
    itemName: string,
    oldValues?: any,
    newValues?: any,
    userId?: string
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'inventory',
      resourceId: itemId,
      resourceName: itemName,
      oldValues,
      newValues,
      severity: this.determineSeverity(action, oldValues, newValues),
      category: this.determineCategory(action),
      description: this.generateDescription(action, 'inventory', itemName, oldValues, newValues)
    })
  }

  async logConversationAction(
    action: string,
    conversationId: string,
    customerName?: string,
    userId?: string
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'conversation',
      resourceId: conversationId,
      resourceName: customerName || `Conversation ${conversationId}`,
      severity: 'low',
      category: this.determineCategory(action),
      description: this.generateDescription(action, 'conversation', customerName || conversationId)
    })
  }

  async logSystemAction(
    action: string,
    description: string,
    severity: AuditLog['severity'] = 'medium',
    metadata?: any
  ): Promise<void> {
    await this.logActivity({
      action,
      resourceType: 'system',
      severity,
      category: 'system',
      description,
      newValues: metadata
    })
  }

  async getActivitySummary(timeRange: string = '24h'): Promise<ActivitySummary> {
    try {
      const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: logs, error } = await this.supabase
        .from('audit_log')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false })

      if (error) throw error

      const logData = logs || []

      const actionsByType = logData.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const actionsByUser = logData.reduce((acc, log) => {
        if (log.user_id) {
          acc[log.user_id] = (acc[log.user_id] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const actionsByResource = logData.reduce((acc, log) => {
        acc[log.entity_type] = (acc[log.entity_type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const summary: ActivitySummary = {
        totalActions: logData.length,
        actionsByType,
        actionsByUser,
        actionsByResource,
        recentActivity: logData.slice(0, 10) as AuditLog[],
        criticalActions: logData.filter(log => log.severity === 'critical' || log.severity === 'high') as AuditLog[],
        timeRange
      }

      logger.info('Activity summary generated from database', { totalActions: summary.totalActions, timeRange })
      return summary

    } catch (error) {
      logger.error('Failed to generate activity summary', error as Error)
      throw error
    }
  }

  async getAuditLogs(filters?: {
    userId?: string
    resourceType?: string
    severity?: string
    category?: string
    dateFrom?: Date
    dateTo?: Date
    limit?: number
  }): Promise<AuditLog[]> {
    try {
      let query = this.supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId)
      }
      if (filters?.resourceType) {
        query = query.eq('entity_type', filters.resourceType)
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity)
      }
      if (filters?.dateFrom) {
        query = query.gte('timestamp', filters.dateFrom.toISOString())
      }
      if (filters?.dateTo) {
        query = query.lte('timestamp', filters.dateTo.toISOString())
      }
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query
      if (error) throw error

      return (data || []) as AuditLog[]

    } catch (error) {
      logger.error('Failed to retrieve audit logs', error as Error)
      throw error
    }
  }

  private async handleCriticalAction(log: AuditLog): Promise<void> {
    // In a real implementation, this would send notifications, create alerts, etc.
    logger.warn('Critical action detected', log)
  }

  private determineSeverity(action: string, oldValues?: any, newValues?: any): AuditLog['severity'] {
    if (action.includes('Delete') || action.includes('Critical')) return 'critical'
    if (action.includes('Create') || action.includes('Update')) return 'medium'
    if (action.includes('Alert') || action.includes('Error')) return 'high'
    return 'low'
  }

  private determineCategory(action: string): AuditLog['category'] {
    if (action.includes('Create')) return 'create'
    if (action.includes('Update') || action.includes('Edit')) return 'update'
    if (action.includes('Delete') || action.includes('Remove')) return 'delete'
    if (action.includes('Login') || action.includes('Auth')) return 'login'
    if (action.includes('Export') || action.includes('Import')) return 'system'
    return 'read'
  }

  private generateDescription(
    action: string,
    resourceType: string,
    resourceName: string,
    oldValues?: any,
    newValues?: any
  ): string {
    let description = `${action}: ${resourceName}`

    if (oldValues && newValues) {
      const changes = []
      for (const key in newValues) {
        if (oldValues[key] !== newValues[key]) {
          changes.push(`${key} from ${oldValues[key]} to ${newValues[key]}`)
        }
      }
      if (changes.length > 0) {
        description += ` (${changes.join(', ')})`
      }
    }

    return description
  }

  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Middleware for automatic logging
  createAuditMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now()
      
      res.on('finish', () => {
        const duration = Date.now() - startTime
        this.logSystemAction(
          'API Request',
          `${req.method} ${req.path} - ${res.statusCode}`,
          res.statusCode >= 400 ? 'medium' : 'low',
          {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          }
        )
      })
      
      next()
    }
  }
}

export const auditService = new AuditService()
