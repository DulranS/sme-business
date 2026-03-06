// lib/enterprise-monitoring.ts - Enterprise-grade monitoring and health checks
import { supabaseAdmin } from './supabaseClient';
import { errorHandler, ErrorSeverity, ErrorCategory } from './enterprise-error-handler';

interface HealthCheck {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  errorRate?: number;
  details?: Record<string, any>;
}

interface Metric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, any>;
}

export class EnterpriseMonitoring {
  private static instance: EnterpriseMonitoring;
  private metricsQueue: Metric[] = [];
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private monitoringInterval: NodeJS.Timeout;

  static getInstance(): EnterpriseMonitoring {
    if (!EnterpriseMonitoring.instance) {
      EnterpriseMonitoring.instance = new EnterpriseMonitoring();
    }
    return EnterpriseMonitoring.instance;
  }

  constructor() {
    // Start monitoring every 5 minutes
    this.monitoringInterval = setInterval(() => this.runHealthChecks(), 5 * 60 * 1000);
    
    // Flush metrics every minute
    setInterval(() => this.flushMetrics(), 60 * 1000);
  }

  registerHealthCheck(serviceName: string, checkFn: () => Promise<HealthCheck>): void {
    this.healthChecks.set(serviceName, checkFn);
  }

  recordMetric(metric: Metric): void {
    this.metricsQueue.push({
      ...metric,
      timestamp: Date.now()
    });

    // Keep queue size manageable
    if (this.metricsQueue.length > 1000) {
      this.metricsQueue = this.metricsQueue.slice(-500);
    }
  }

  async runHealthChecks(): Promise<void> {
    const results: HealthCheck[] = [];

    for (const [serviceName, checkFn] of this.healthChecks) {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const responseTime = Date.now() - startTime;

        results.push({
          ...result,
          serviceName,
          responseTime
        });

        // Store in database
        await this.storeHealthCheck({
          serviceName,
          status: result.status,
          responseTime,
          details: result.details
        });

      } catch (error) {
        await errorHandler.logError(error, ErrorSeverity.HIGH, ErrorCategory.SYSTEM, {
          service: serviceName,
          action: 'health_check'
        });

        results.push({
          serviceName,
          status: 'unhealthy',
          responseTime: 0,
          details: { error: error.message }
        });
      }
    }

    // Log overall system health
    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const totalCount = results.length;

    if (healthyCount < totalCount) {
      console.warn(`System health degraded: ${healthyCount}/${totalCount} services healthy`);
    }
  }

  private async storeHealthCheck(check: Partial<HealthCheck>): Promise<void> {
    try {
      await supabaseAdmin
        .from('system_health')
        .insert({
          service_name: check.serviceName,
          status: check.status,
          response_time_ms: check.responseTime,
          details: check.details || {},
          last_check: new Date().toISOString()
        });
    } catch (error) {
      console.error('Failed to store health check:', error);
    }
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsQueue.length === 0) return;

    const metrics = [...this.metricsQueue];
    this.metricsQueue = [];

    try {
      await supabaseAdmin
        .from('performance_metrics')
        .insert(
          metrics.map(m => ({
            metric_name: m.name,
            metric_value: m.value,
            unit: m.unit,
            tags: m.tags || {},
            timestamp: new Date(m.timestamp || Date.now()).toISOString()
          }))
        );
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Re-add metrics to queue on failure
      this.metricsQueue.unshift(...metrics);
    }
  }

  // Predefined health checks
  setupDefaultHealthChecks(): void {
    // Gmail API health check
    this.registerHealthCheck('gmail-api', async () => {
      try {
        const startTime = Date.now();
        // Simple API call to test connectivity
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
          headers: {
            'Authorization': `Bearer ${process.env.GMAIL_ACCESS_TOKEN}`
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          return {
            serviceName: 'gmail-api',
            status: 'healthy',
            responseTime,
            details: { statusCode: response.status }
          };
        } else {
          return {
            serviceName: 'gmail-api',
            status: 'degraded',
            responseTime,
            details: { statusCode: response.status, error: 'API call failed' }
          };
        }
      } catch (error) {
        return {
          serviceName: 'gmail-api',
          status: 'unhealthy',
          details: { error: error.message }
        };
      }
    });

    // OpenAI API health check
    this.registerHealthCheck('openai-api', async () => {
      try {
        const startTime = Date.now();
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          return {
            serviceName: 'openai-api',
            status: 'healthy',
            responseTime,
            details: { statusCode: response.status }
          };
        } else {
          return {
            serviceName: 'openai-api',
            status: 'degraded',
            responseTime,
            details: { statusCode: response.status, error: 'API call failed' }
          };
        }
      } catch (error) {
        return {
          serviceName: 'openai-api',
          status: 'unhealthy',
          details: { error: error.message }
        };
      }
    });

    // Supabase health check
    this.registerHealthCheck('supabase-db', async () => {
      try {
        const startTime = Date.now();
        const { data, error } = await supabaseAdmin
          .from('leads')
          .select('id')
          .limit(1);
        
        const responseTime = Date.now() - startTime;
        
        if (!error) {
          return {
            serviceName: 'supabase-db',
            status: 'healthy',
            responseTime,
            details: { connected: true }
          };
        } else {
          return {
            serviceName: 'supabase-db',
            status: 'degraded',
            responseTime,
            details: { error: error.message }
          };
        }
      } catch (error) {
        return {
          serviceName: 'supabase-db',
          status: 'unhealthy',
          details: { error: error.message }
        };
      }
    });

    // Cron job health check
    this.registerHealthCheck('cron-jobs', async () => {
      try {
        const { data, error } = await supabaseAdmin
          .from('error_logs')
          .select('timestamp')
          .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString())
          .eq('category', 'system');
        
        const recentErrors = data?.length || 0;
        
        if (recentErrors > 5) {
          return {
            serviceName: 'cron-jobs',
            status: 'degraded',
            details: { recentErrors, error: 'High error rate' }
          };
        } else {
          return {
            serviceName: 'cron-jobs',
            status: 'healthy',
            details: { recentErrors }
          };
        }
      } catch (error) {
        return {
          serviceName: 'cron-jobs',
          status: 'unhealthy',
          details: { error: error.message }
        };
      }
    });
  }

  async getSystemHealth(): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .from('system_health')
        .select('*')
        .gte('last_check', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('last_check', { ascending: false });

      if (error) throw error;

      const health = {
        overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        services: data || [],
        timestamp: new Date().toISOString()
      };

      // Determine overall health
      const unhealthyCount = health.services.filter(s => s.status === 'unhealthy').length;
      const degradedCount = health.services.filter(s => s.status === 'degraded').length;

      if (unhealthyCount > 0) {
        health.overall = 'unhealthy';
      } else if (degradedCount > 0) {
        health.overall = 'degraded';
      }

      return health;
    } catch (error) {
      await errorHandler.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.SYSTEM);
      return {
        overall: 'unhealthy',
        services: [],
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  async getMetrics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<any> {
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
      }

      const { data, error } = await supabaseAdmin
        .from('performance_metrics')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return {
        metrics: data || [],
        timeframe,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      await errorHandler.logError(error, ErrorSeverity.MEDIUM, ErrorCategory.SYSTEM);
      return {
        metrics: [],
        timeframe,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
  }
}

// Global monitoring instance
export const monitoring = EnterpriseMonitoring.getInstance();

// Setup default health checks automatically
monitoring.setupDefaultHealthChecks();
