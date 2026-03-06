// lib/enterprise-error-handler.ts - Enterprise-grade error handling and logging
import { supabaseAdmin } from './supabaseClient';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  API = 'api',
  DATABASE = 'database',
  GMAIL = 'gmail',
  AI = 'ai',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SYSTEM = 'system'
}

interface EnterpriseError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  userId?: string;
  leadId?: string;
  messageId?: string;
  context?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export class EnterpriseErrorHandler {
  private static instance: EnterpriseErrorHandler;
  private errorQueue: EnterpriseError[] = [];
  private maxQueueSize = 1000;
  private flushInterval = 30000; // 30 seconds

  static getInstance(): EnterpriseErrorHandler {
    if (!EnterpriseErrorHandler.instance) {
      EnterpriseErrorHandler.instance = new EnterpriseErrorHandler();
    }
    return EnterpriseErrorHandler.instance;
  }

  constructor() {
    // Start periodic flush to database
    setInterval(() => this.flushErrors(), this.flushInterval);
  }

  async logError(
    error: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.SYSTEM,
    context?: Record<string, any>
  ): Promise<string> {
    const errorId = this.generateErrorId();
    const enterpriseError: EnterpriseError = {
      id: errorId,
      timestamp: new Date().toISOString(),
      severity,
      category,
      message: error.message,
      stack: error.stack,
      userId: context?.userId,
      leadId: context?.leadId,
      messageId: context?.messageId,
      context,
      resolved: false
    };

    // Add to queue
    this.errorQueue.push(enterpriseError);
    
    // Trim queue if too large
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize);
    }

    // Critical errors get immediate attention
    if (severity === ErrorSeverity.CRITICAL) {
      await this.handleCriticalError(enterpriseError);
    }

    // Log to console for development
    console.error(`[${severity.toUpperCase()}] ${category}: ${error.message}`, {
      errorId,
      context
    });

    return errorId;
  }

  async resolveError(
    errorId: string,
    resolutionNotes: string
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: resolutionNotes
        })
        .eq('id', errorId);

      if (error) {
        console.error('Failed to resolve error in database:', error);
        return false;
      }

      // Remove from queue
      this.errorQueue = this.errorQueue.filter(e => e.id !== errorId);
      
      return true;
    } catch (err) {
      console.error('Error resolving error:', err);
      return false;
    }
  }

  private async flushErrors(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errorsToFlush = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const { error } = await supabaseAdmin
        .from('error_logs')
        .upsert(errorsToFlush, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Failed to flush errors to database:', error);
        // Re-add to queue if database flush failed
        this.errorQueue.unshift(...errorsToFlush);
      }
    } catch (err) {
      console.error('Error flushing to database:', err);
      // Re-add to queue
      this.errorQueue.unshift(...errorsToFlush);
    }
  }

  private async handleCriticalError(error: EnterpriseError): Promise<void> {
    // Send alert (implement your alerting system)
    console.error('🚨 CRITICAL ERROR:', error);
    
    // Could integrate with:
    // - Slack notifications
    // - Email alerts
    // - PagerDuty
    // - Sentry
    
    // For now, log immediately
    try {
      await supabaseAdmin
        .from('error_logs')
        .insert([error]);
    } catch (err) {
      console.error('Failed to log critical error:', err);
    }
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getErrorStats(timeframe: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const now = new Date();
      let startTime: Date;

      switch (timeframe) {
        case 'hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const { data, error } = await supabaseAdmin
        .from('error_logs')
        .select('severity, category, resolved')
        .gte('timestamp', startTime.toISOString());

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        bySeverity: {},
        byCategory: {},
        resolved: data?.filter(e => e.resolved).length || 0,
        unresolved: data?.filter(e => !e.resolved).length || 0
      };

      // Count by severity
      data?.forEach(err => {
        stats.bySeverity[err.severity] = (stats.bySeverity[err.severity] || 0) + 1;
        stats.byCategory[err.category] = (stats.byCategory[err.category] || 0) + 1;
      });

      return stats;
    } catch (err) {
      console.error('Error getting error stats:', err);
      return {
        total: 0,
        bySeverity: {},
        byCategory: {},
        resolved: 0,
        unresolved: 0
      };
    }
  }
}

// Global error handler instance
export const errorHandler = EnterpriseErrorHandler.getInstance();
