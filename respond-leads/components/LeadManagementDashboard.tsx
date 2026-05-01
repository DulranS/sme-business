'use client'

import React, { useState, useEffect } from 'react'
import { leadManagementService } from '../lib/lead-management'
import { Lead, LeadScoringRule } from '../types'
import {
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Filter,
  Download,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Star
} from 'lucide-react'

interface LeadManagementDashboardProps {
  className?: string
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
    marginBottom: '40px',
    flexWrap: 'wrap',
    gap: '20px'
  },

  title: {
    fontSize: '32px',
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
    letterSpacing: '-0.5px'
  },

  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '24px',
    marginBottom: '40px'
  },

  metricCard: {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '20px',
    padding: '28px',
    position: 'relative',
    overflow: 'hidden'
  },

  metricIcon: {
    fontSize: '32px',
    marginBottom: '16px',
    opacity: 0.8
  },

  metricValue: {
    fontSize: '36px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px',
    fontFamily: "'Inter', sans-serif",
    lineHeight: '1.1'
  },

  metricLabel: {
    fontSize: '14px',
    color: '#a78bfa',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },

  filtersBar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },

  filterSelect: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    color: '#e5e5e5',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: "'Inter', sans-serif",
    cursor: 'pointer'
  },

  exportButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  leadsTable: {
    background: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    overflow: 'hidden'
  },

  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },

  th: {
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
    padding: '16px 20px',
    textAlign: 'left' as const,
    fontSize: '12px',
    color: '#a78bfa',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottom: '1px solid rgba(139, 92, 246, 0.3)'
  },

  td: {
    padding: '16px 20px',
    fontSize: 14,
    borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
    color: '#e5e5e5'
  },

  leadScore: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },

  scoreBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },

  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },

  actionButton: {
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: '#818cf8',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    marginRight: '8px'
  },

  priorityIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    marginRight: '8px'
  }
}

const LeadManagementDashboard: React.FC<LeadManagementDashboardProps> = ({ className }) => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [analytics, setAnalytics] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: '',
    minScore: '',
    priority: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [leadsData, analyticsData] = await Promise.all([
        leadManagementService.getLeads(),
        leadManagementService.getLeadAnalytics()
      ])
      setLeads(leadsData)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Failed to load lead data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (leadId: number, newStatus: string) => {
    try {
      // Find the conversation ID for this lead
      const lead = leads.find(l => l.id === leadId)
      if (!lead?.conversation_id) return

      await leadManagementService.updateLeadStatus(lead.conversation_id, { status: newStatus as any })
      await loadData() // Refresh data
    } catch (error) {
      console.error('Failed to update lead status:', error)
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const data = await leadManagementService.exportLeads({ format })
      const blob = new Blob([data], { type: format === 'csv' ? 'text/csv' : 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-export.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export leads:', error)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return '#10b981'
    if (score >= 40) return '#f59e0b'
    return '#ef4444'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted': return '#10b981'
      case 'qualified': return '#3b82f6'
      case 'contacted': return '#f59e0b'
      case 'lost': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444'
      case 'high': return '#f59e0b'
      case 'medium': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading lead data...</div>
      </div>
    )
  }

  return (
    <div style={styles.container} className={className}>
      <div style={styles.header}>
        <h1 style={styles.title}>Lead Management</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={styles.exportButton}
            onClick={() => handleExport('csv')}
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            style={styles.exportButton}
            onClick={() => handleExport('json')}
          >
            <Download size={16} />
            Export JSON
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <Users style={{ ...styles.metricIcon, color: '#3b82f6' }} />
          <div style={styles.metricValue}>{analytics.totalLeads || 0}</div>
          <div style={styles.metricLabel}>Total Leads</div>
        </div>

        <div style={styles.metricCard}>
          <Target style={{ ...styles.metricIcon, color: '#10b981' }} />
          <div style={styles.metricValue}>{analytics.qualifiedLeads || 0}</div>
          <div style={styles.metricLabel}>Qualified Leads</div>
        </div>

        <div style={styles.metricCard}>
          <TrendingUp style={{ ...styles.metricIcon, color: '#f59e0b' }} />
          <div style={styles.metricValue}>{analytics.conversionRate || 0}%</div>
          <div style={styles.metricLabel}>Conversion Rate</div>
        </div>

        <div style={styles.metricCard}>
          <DollarSign style={{ ...styles.metricIcon, color: '#8b5cf6' }} />
          <div style={styles.metricValue}>${analytics.totalConversionValue || 0}</div>
          <div style={styles.metricLabel}>Total Value</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersBar}>
        <Filter size={16} style={{ color: '#a78bfa' }} />
        <select
          style={styles.filterSelect}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="lost">Lost</option>
        </select>

        <select
          style={styles.filterSelect}
          value={filters.minScore}
          onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
        >
          <option value="">Min Score</option>
          <option value="70">70+</option>
          <option value="50">50+</option>
          <option value="30">30+</option>
        </select>
      </div>

      {/* Leads Table */}
      <div style={styles.leadsTable}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Lead Score</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Last Message</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td style={styles.td}>
                  <div>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{lead.customer_name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{lead.phone_number}</div>
                  </div>
                </td>
                <td style={styles.td}>
                  <div style={styles.leadScore}>
                    <Star size={16} style={{ color: getScoreColor(lead.lead_score) }} />
                    <span style={{
                      color: getScoreColor(lead.lead_score),
                      fontWeight: '600'
                    }}>
                      {lead.lead_score}
                    </span>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: `${getStatusColor(lead.status)}20`,
                    color: getStatusColor(lead.status),
                    border: `1px solid ${getStatusColor(lead.status)}40`
                  }}>
                    {lead.status}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.priorityIndicator,
                    backgroundColor: getPriorityColor((lead as any).priority)
                  }} />
                  {(lead as any).priority || 'medium'}
                </td>
                <td style={styles.td}>
                  <div style={{
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '13px'
                  }}>
                    {lead.last_message || 'No messages yet'}
                  </div>
                </td>
                <td style={styles.td}>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleStatusUpdate(lead.id!, 'qualified')}
                  >
                    Qualify
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleStatusUpdate(lead.id!, 'converted')}
                  >
                    Convert
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LeadManagementDashboard