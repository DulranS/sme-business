'use client'

import React, { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { 
  Activity, 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Users,
  MessageSquare,
  Cpu,
  Database,
  Wifi,
  Server,
  Globe,
  BarChart3,
  RefreshCw
} from 'lucide-react'

interface SystemMetrics {
  uptime: number
  responseTime: number
  errorRate: number
  throughput: number
  activeUsers: number
  queuedMessages: number
  processedMessages: number
  failedMessages: number
  databaseConnections: number
  memoryUsage: number
  cpuUsage: number
  networkLatency: number
}

interface ServiceStatus {
  whatsapp: 'operational' | 'degraded' | 'down'
  database: 'operational' | 'degraded' | 'down'
  ai: 'operational' | 'degraded' | 'down'
  webhook: 'operational' | 'degraded' | 'down'
}

interface AlertItem {
  id: string
  type: 'info' | 'warning' | 'error' | 'success'
  message: string
  timestamp: string
  resolved: boolean
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '32px',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.03), rgba(139, 92, 246, 0.03))',
    borderRadius: '24px',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(139, 92, 246, 0.15)',
    minHeight: 'calc(100vh - 200px)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '20px'
  },

  title: {
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },

  statusBadge: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },

  operationalBadge: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.3)'
  },

  degradedBadge: {
    background: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    border: '1px solid rgba(245, 158, 11, 0.3)'
  },

  downBadge: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  },

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },

  metricCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '20px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease'
  },

  metricHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px'
  },

  metricIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff'
  },

  metricTitle: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  metricValue: {
    fontSize: 'clamp(20px, 3vw, 28px)',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px'
  },

  metricChange: {
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },

  positive: {
    color: '#22c55e'
  } as React.CSSProperties,

  negative: {
    color: '#ef4444'
  } as React.CSSProperties,

  neutral: {
    color: '#6b7280'
  } as React.CSSProperties,

  sectionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
    marginBottom: '32px'
  },

  sectionCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)'
  },

  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },

  serviceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px'
  },

  serviceCard: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    transition: 'all 0.3s ease'
  },

  serviceIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    margin: '0 auto 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff'
  },

  serviceName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: '8px'
  },

  serviceStatus: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  alertsList: {
    display: 'grid',
    gap: '12px',
    maxHeight: '400px',
    overflowY: 'auto'
  },

  alertCard: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    transition: 'all 0.3s ease'
  },

  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },

  alertMessage: {
    fontSize: '14px',
    color: '#e5e5e5',
    lineHeight: '1.5',
    marginBottom: '8px'
  },

  alertMeta: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  infoAlert: {
    borderLeft: '4px solid #3b82f6'
  },

  warningAlert: {
    borderLeft: '4px solid #f59e0b'
  },

  errorAlert: {
    borderLeft: '4px solid #ef4444'
  },

  successAlert: {
    borderLeft: '4px solid #22c55e'
  },

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px'
  },

  refreshButton: {
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  }
}

export default function RealTimeMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    whatsapp: 'operational',
    database: 'operational',
    ai: 'operational',
    webhook: 'operational'
  })
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const supabase = getSupabaseClient()

  useEffect(() => {
    loadMonitoringData()
    const interval = setInterval(loadMonitoringData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const loadMonitoringData = async () => {
    try {
      setLoading(true)

      // Simulate real-time metrics (in production, this would come from monitoring APIs)
      const mockMetrics: SystemMetrics = {
        uptime: 99.9,
        responseTime: 145 + Math.random() * 50,
        errorRate: Math.random() * 2,
        throughput: 1250 + Math.random() * 500,
        activeUsers: 45 + Math.floor(Math.random() * 20),
        queuedMessages: Math.floor(Math.random() * 10),
        processedMessages: 12500 + Math.floor(Math.random() * 1000),
        failedMessages: Math.floor(Math.random() * 5),
        databaseConnections: 12 + Math.floor(Math.random() * 8),
        memoryUsage: 65 + Math.random() * 20,
        cpuUsage: 45 + Math.random() * 30,
        networkLatency: 12 + Math.random() * 8
      }

      // Simulate service status checks
      const mockServiceStatus: ServiceStatus = {
        whatsapp: Math.random() > 0.95 ? 'degraded' : 'operational',
        database: Math.random() > 0.98 ? 'degraded' : 'operational',
        ai: Math.random() > 0.92 ? 'degraded' : 'operational',
        webhook: Math.random() > 0.96 ? 'degraded' : 'operational'
      }

      // Generate mock alerts
      const mockAlerts: AlertItem[] = [
        {
          id: '1',
          type: 'success',
          message: 'WhatsApp webhook processed successfully with 0ms latency',
          timestamp: new Date(Date.now() - 60000).toISOString(),
          resolved: true
        },
        {
          id: '2',
          type: 'info',
          message: 'AI response generation completed in 1.2s',
          timestamp: new Date(Date.now() - 120000).toISOString(),
          resolved: true
        },
        {
          id: '3',
          type: 'warning',
          message: 'Database connection pool reaching 80% capacity',
          timestamp: new Date(Date.now() - 180000).toISOString(),
          resolved: false
        }
      ]

      setMetrics(mockMetrics)
      setServiceStatus(mockServiceStatus)
      setAlerts(mockAlerts)
      setLastRefreshed(new Date())

    } catch (error) {
      console.error('Error loading monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeStyle = (status: ServiceStatus[keyof ServiceStatus]) => {
    switch (status) {
      case 'operational': return styles.operationalBadge
      case 'degraded': return styles.degradedBadge
      case 'down': return styles.downBadge
      default: return styles.neutral
    }
  }

  const getAlertStyle = (type: AlertItem['type']) => {
    switch (type) {
      case 'info': return styles.infoAlert
      case 'warning': return styles.warningAlert
      case 'error': return styles.errorAlert
      case 'success': return styles.successAlert
      default: return styles.neutral
    }
  }

  const getAlertIcon = (type: AlertItem['type']) => {
    switch (type) {
      case 'info': return <Activity size={16} />
      case 'warning': return <AlertTriangle size={16} />
      case 'error': return <AlertTriangle size={16} />
      case 'success': return <CheckCircle size={16} />
      default: return <Activity size={16} />
    }
  }

  const getServiceIcon = (service: keyof ServiceStatus) => {
    switch (service) {
      case 'whatsapp': return <MessageSquare size={20} />
      case 'database': return <Database size={20} />
      case 'ai': return <Cpu size={20} />
      case 'webhook': return <Wifi size={20} />
      default: return <Server size={20} />
    }
  }

  const getServiceColor = (service: keyof ServiceStatus) => {
    const colors = {
      whatsapp: 'linear-gradient(135deg, #25d366, #128c7e)',
      database: 'linear-gradient(135deg, #3b82f6, #2563eb)',
      ai: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      webhook: 'linear-gradient(135deg, #f59e0b, #d97706)'
    }
    return colors[service]
  }

  const formatNumber = (num: number, decimals: number = 0) => {
    return num.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    })
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${formatNumber(ms)}ms`
    return `${formatNumber(ms / 1000, 1)}s`
  }

  if (loading && !metrics) {
    return <div style={styles.loading}>Loading real-time monitoring...</div>
  }

  return (
    <div style={styles.container}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Activity size={32} />
            Real-Time Monitoring
          </h1>
          <div style={{ 
            fontSize: '14px', 
            color: '#9ca3af', 
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: '#22c55e',
              animation: 'pulse 2s infinite'
            }} />
            Live monitoring • Last updated: {lastRefreshed.toLocaleTimeString()}
          </div>
        </div>
        <button 
          style={styles.refreshButton}
          onClick={loadMonitoringData}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* System Status Badge */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '16px', color: '#9ca3af', fontWeight: '600' }}>System Status:</div>
        <div style={{ ...styles.statusBadge, ...getStatusBadgeStyle('operational') }}>
          <CheckCircle size={14} />
          Operational
        </div>
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          Uptime: {metrics?.uptime.toFixed(1)}%
        </div>
      </div>

      {/* Real-Time Metrics */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
              <Clock size={16} />
            </div>
            <div style={styles.metricTitle}>Response Time</div>
          </div>
          <div style={styles.metricValue}>{formatDuration(metrics?.responseTime || 0)}</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <TrendingUp size={12} />
            -12ms from avg
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <Users size={16} />
            </div>
            <div style={styles.metricTitle}>Active Users</div>
          </div>
          <div style={styles.metricValue}>{metrics?.activeUsers || 0}</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <TrendingUp size={12} />
            +5 from yesterday
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <MessageSquare size={16} />
            </div>
            <div style={styles.metricTitle}>Messages Processed</div>
          </div>
          <div style={styles.metricValue}>{formatNumber(metrics?.processedMessages || 0)}</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <TrendingUp size={12} />
            +234 today
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <Zap size={16} />
            </div>
            <div style={styles.metricTitle}>Error Rate</div>
          </div>
          <div style={styles.metricValue}>{(metrics?.errorRate || 0).toFixed(2)}%</div>
          <div style={{ ...styles.metricChange, ...(styles.positive) }}>
            <TrendingUp size={12} />
            Below threshold
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <Cpu size={16} />
            </div>
            <div style={styles.metricTitle}>CPU Usage</div>
          </div>
          <div style={styles.metricValue}>{(metrics?.cpuUsage || 0).toFixed(1)}%</div>
          <div style={{ ...styles.metricChange, ...(styles.neutral) }}>
            <Activity size={12} />
            Normal range
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricHeader}>
            <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}>
              <Database size={16} />
            </div>
            <div style={styles.metricTitle}>Memory Usage</div>
          </div>
          <div style={styles.metricValue}>{(metrics?.memoryUsage || 0).toFixed(1)}%</div>
          <div style={{ ...styles.metricChange, ...(styles.neutral) }}>
            <Activity size={12} />
            Optimal
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div style={styles.sectionGrid}>
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <Server size={20} />
            Service Status
          </h2>
          <div style={styles.serviceGrid}>
            {(Object.keys(serviceStatus) as Array<keyof ServiceStatus>).map((service) => (
              <div key={service} style={styles.serviceCard}>
                <div style={{ ...styles.serviceIcon, background: getServiceColor(service) }}>
                  {getServiceIcon(service)}
                </div>
                <div style={styles.serviceName}>
                  {service.charAt(0).toUpperCase() + service.slice(1)}
                </div>
                <div style={{ 
                  ...styles.serviceStatus, 
                  ...getStatusBadgeStyle(serviceStatus[service])
                }}>
                  {serviceStatus[service]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div style={styles.sectionCard}>
          <h2 style={styles.sectionTitle}>
            <AlertTriangle size={20} />
            Recent Alerts
          </h2>
          <div style={styles.alertsList}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ ...styles.alertCard, ...getAlertStyle(alert.type) }}>
                <div style={styles.alertHeader}>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: alert.type === 'error' ? '#ef4444' : 
                              alert.type === 'warning' ? '#f59e0b' : 
                              alert.type === 'success' ? '#22c55e' : '#3b82f6',
                      marginBottom: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {getAlertIcon(alert.type)}
                      {alert.type}
                    </div>
                    <div style={styles.alertMessage}>{alert.message}</div>
                  </div>
                  {alert.resolved && (
                    <div style={{ 
                      padding: '4px 8px', 
                      background: 'rgba(34, 197, 94, 0.2)', 
                      color: '#22c55e', 
                      borderRadius: '6px', 
                      fontSize: '10px', 
                      fontWeight: '600' 
                    }}>
                      RESOLVED
                    </div>
                  )}
                </div>
                <div style={styles.alertMeta}>
                  <Clock size={12} />
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div style={styles.sectionCard}>
        <h2 style={styles.sectionTitle}>
          <BarChart3 size={20} />
          Performance Overview
        </h2>
        <div style={styles.metricsGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <Globe size={16} />
              </div>
              <div style={styles.metricTitle}>Network Latency</div>
            </div>
            <div style={styles.metricValue}>{formatDuration(metrics?.networkLatency || 0)}</div>
            <div style={{ ...styles.metricChange, ...(styles.positive) }}>
              <TrendingUp size={12} />
              Excellent
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
                <Database size={16} />
              </div>
              <div style={styles.metricTitle}>DB Connections</div>
            </div>
            <div style={styles.metricValue}>{metrics?.databaseConnections || 0}</div>
            <div style={{ ...styles.metricChange, ...(styles.neutral) }}>
              <Activity size={12} />
              {metrics?.databaseConnections && metrics.databaseConnections > 15 ? 'High' : 'Normal'}
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <MessageSquare size={16} />
              </div>
              <div style={styles.metricTitle}>Queued Messages</div>
            </div>
            <div style={styles.metricValue}>{metrics?.queuedMessages || 0}</div>
            <div style={{ ...styles.metricChange, ...(styles.positive) }}>
              <CheckCircle size={12} />
              Processing normally
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <AlertTriangle size={16} />
              </div>
              <div style={styles.metricTitle}>Failed Messages</div>
            </div>
            <div style={styles.metricValue}>{metrics?.failedMessages || 0}</div>
            <div style={{ ...styles.metricChange, ...(styles.positive) }}>
              <CheckCircle size={12} />
              Within limits
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
