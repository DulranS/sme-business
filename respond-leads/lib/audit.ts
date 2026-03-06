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
      // Simulate activity summary generation
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          userId: 'user1',
          action: 'Item Created',
          resourceType: 'inventory',
          resourceId: '123',
          resourceName: 'Premium Widget',
          newValues: { name: 'Premium Widget', quantity: 100, price: 29.99 },
          timestamp: new Date(Date.now() - 3600000),
          severity: 'medium',
          category: 'create',
          description: 'Created new inventory item: Premium Widget'
        },
        {
          id: '2',
          userId: 'user1',
          action: 'Item Updated',
          resourceType: 'inventory',
          resourceId: '123',
          resourceName: 'Premium Widget',
          oldValues: { quantity: 100 },
          newValues: { quantity: 95 },
          timestamp: new Date(Date.now() - 1800000),
          severity: 'low',
          category: 'update',
          description: 'Updated quantity for Premium Widget from 100 to 95'
        },
        {
          id: '3',
          action: 'Low Stock Alert',
          resourceType: 'system',
          severity: 'high',
          category: 'system',
          description: 'Critical: Premium Widget is running low on stock (5 units remaining)',
          timestamp: new Date(Date.now() - 900000)
        }
      ]

      const actionsByType = mockLogs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const actionsByUser = mockLogs.reduce((acc, log) => {
        if (log.userId) {
          acc[log.userId] = (acc[log.userId] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      const actionsByResource = mockLogs.reduce((acc, log) => {
        acc[log.resourceType] = (acc[log.resourceType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const summary: ActivitySummary = {
        totalActions: mockLogs.length,
        actionsByType,
        actionsByUser,
        actionsByResource,
        recentActivity: mockLogs.slice(0, 10),
        criticalActions: mockLogs.filter(log => log.severity === 'critical' || log.severity === 'high'),
        timeRange
      }

      logger.info('Activity summary generated', { totalActions: summary.totalActions, timeRange })
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
      // In a real implementation, this would query the audit_logs table
      // For now, return mock data
      const mockLogs: AuditLog[] = [
        {
          id: '1',
          userId: 'user1',
          action: 'Item Created',
          resourceType: 'inventory',
          resourceId: '123',
          resourceName: 'Premium Widget',
          newValues: { name: 'Premium Widget', quantity: 100, price: 29.99 },
          timestamp: new Date(Date.now() - 3600000),
          severity: 'medium',
          category: 'create',
          description: 'Created new inventory item: Premium Widget'
        },
        {
          id: '2',
          userId: 'user2',
          action: 'Export Started',
          resourceType: 'system',
          severity: 'low',
          category: 'system',
          description: 'User initiated inventory export',
          timestamp: new Date(Date.now() - 7200000)
        }
      ]

      let filteredLogs = mockLogs

      if (filters?.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId)
      }
      if (filters?.resourceType) {
        filteredLogs = filteredLogs.filter(log => log.resourceType === filters.resourceType)
      }
      if (filters?.severity) {
        filteredLogs = filteredLogs.filter(log => log.severity === filters.severity)
      }
      if (filters?.category) {
        filteredLogs = filteredLogs.filter(log => log.category === filters.category)
      }

      if (filters?.limit) {
        filteredLogs = filteredLogs.slice(0, filters.limit)
      }

      return filteredLogs

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
