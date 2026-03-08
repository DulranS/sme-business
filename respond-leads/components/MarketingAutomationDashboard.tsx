'use client'

import React, { useState, useEffect } from 'react'
import { campaignManager } from '../lib/campaign-manager'
import { automationEngine, manualControl } from '../lib/marketing-automation'
import { Campaign, AudienceSegment, CustomerProfile, CampaignPerformance, MarketingDashboard } from '../types/marketing-automation'
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Users, 
  MessageSquare, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Target,
  Zap,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  BarChart3,
  Activity,
  Mail,
  Smartphone,
  MessageCircle
} from 'lucide-react'

interface MarketingAutomationDashboardProps {
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
    margin: 0
  },
  
  automationStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 20px',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '12px'
  },
  
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#22c55e',
    animation: 'pulse 2s infinite'
  },
  
  statusText: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#22c55e'
  },
  
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '32px',
    borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
    paddingBottom: '16px'
  },
  
  tab: {
    padding: '12px 20px',
    background: 'transparent',
    border: 'none',
    color: '#9ca3af',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.3s ease',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  tabActive: {
    background: 'rgba(139, 92, 246, 0.1)',
    color: '#8b5cf6',
    border: '1px solid rgba(139, 92, 246, 0.3)'
  },
  
  overviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
    marginBottom: '40px'
  },
  
  metricCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  metricHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  
  metricIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  
  metricValue: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '8px'
  },
  
  metricLabel: {
    fontSize: '14px',
    color: '#9ca3af',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  
  metricChange: {
    fontSize: '12px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  campaignsList: {
    display: 'grid',
    gap: '16px'
  },
  
  campaignCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.3s ease'
  },
  
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  
  campaignTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '4px'
  },
  
  campaignDescription: {
    fontSize: '14px',
    color: '#9ca3af',
    marginBottom: '16px'
  },
  
  campaignMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '16px'
  },
  
  campaignActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  
  button: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  primaryButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#ffffff'
  },
  
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#e5e5e5',
    border: '1px solid rgba(139, 92, 246, 0.3)'
  },
  
  dangerButton: {
    background: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    border: '1px solid rgba(239, 68, 68, 0.3)'
  },
  
  successButton: {
    background: 'rgba(34, 197, 94, 0.1)',
    color: '#22c55e',
    border: '1px solid rgba(34, 197, 94, 0.3)'
  },
  
  performanceBar: {
    display: 'flex',
    gap: '4px',
    height: '8px',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '12px'
  },
  
  performanceSegment: {
    flex: 1,
    borderRadius: '4px'
  },
  
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  
  statusDraft: {
    background: 'rgba(156, 163, 175, 0.2)',
    color: '#9ca3af'
  },
  
  statusActive: {
    background: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e'
  },
  
  statusPaused: {
    background: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24'
  },
  
  statusCompleted: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6'
  },
  
  statusFailed: {
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444'
  },
  
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  
  modalContent: {
    background: 'rgba(30, 30, 30, 0.95)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    backdropFilter: 'blur(20px)'
  },
  
  modalTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '24px'
  },
  
  formGroup: {
    marginBottom: '20px'
  },
  
  formLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#e5e5e5',
    marginBottom: '8px'
  },
  
  formInput: {
    width: '100%',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  formTextarea: {
    width: '100%',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    minHeight: '100px',
    resize: 'vertical'
  },
  
  formSelect: {
    width: '100%',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '400px',
    color: '#6b7280',
    fontSize: '16px'
  },
  
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  },
  
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5
  },
  
  emptyText: {
    fontSize: '16px',
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: '24px'
  }
}

type Tab = 'overview' | 'campaigns' | 'audiences' | 'automation' | 'manual'

export default function MarketingAutomationDashboard({ className = '' }: MarketingAutomationDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [audiences, setAudiences] = useState<AudienceSegment[]>([])
  const [dashboard, setDashboard] = useState<MarketingDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [showAudienceModal, setShowAudienceModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [automationStatus, setAutomationStatus] = useState<'running' | 'paused' | 'error'>('running')

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      
      if (activeTab === 'campaigns') {
        const campaignList = await campaignManager.getCampaigns()
        setCampaigns(campaignList)
      } else if (activeTab === 'audiences') {
        const audienceList = await campaignManager.getAudienceSegments()
        setAudiences(audienceList)
      } else if (activeTab === 'overview') {
        // Load dashboard data
        const analytics = await campaignManager.getCampaignAnalytics()
        const campaignList = await campaignManager.getCampaigns()
        
        setDashboard({
          overview: {
            totalCampaigns: campaignList.length,
            activeCampaigns: campaignList.filter(c => c.status === 'active').length,
            totalAudience: 0, // Would calculate from customer profiles
            engagementRate: 0, // Would calculate from performance
            conversionRate: analytics.performance.converted > 0 ? 
              (analytics.performance.converted / analytics.performance.sent) * 100 : 0,
            revenue: analytics.performance.revenue,
            cost: analytics.performance.cost,
            roi: analytics.performance.cost > 0 ? 
              ((analytics.performance.revenue - analytics.performance.cost) / analytics.performance.cost) * 100 : 0
          },
          campaigns: {
            byStatus: analytics.byStatus,
            byType: analytics.byType,
            performance: [],
            recent: campaignList.slice(0, 5)
          },
          audiences: {
            totalSegments: audiences.length,
            totalContacts: 0,
            segmentSizes: {},
            growth: []
          },
          automation: {
            activeWorkflows: 0,
            totalExecutions: 0,
            successRate: 0,
            averageTime: 0,
            errors: 0
          },
          performance: {
            period: 'week',
            sent: analytics.performance.sent,
            delivered: analytics.performance.delivered,
            opened: analytics.performance.opened,
            clicked: analytics.performance.clicked,
            converted: analytics.performance.converted,
            revenue: analytics.performance.revenue,
            cost: analytics.performance.cost,
            trends: (analytics.trends || []).map(trend => ({
              date: trend.date,
              metric: 'sent',
              value: trend.sent,
              change: 0
            }))
          },
          alerts: []
        })
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCampaignAction = async (campaignId: string, action: 'start' | 'pause' | 'stop') => {
    try {
      switch (action) {
        case 'start':
          await automationEngine.startCampaign(campaignId)
          break
        case 'pause':
          await automationEngine.pauseCampaign(campaignId)
          break
        case 'stop':
          await automationEngine.stopCampaign(campaignId)
          break
      }
      
      // Reload campaigns
      const campaignList = await campaignManager.getCampaigns()
      setCampaigns(campaignList)
    } catch (error) {
      console.error('Failed to execute campaign action:', error)
    }
  }

  const handleManualOverride = async (campaignId: string, action: string) => {
    try {
      await manualControl.overrideAutomation(campaignId, {
        type: action as any,
        reason: 'Manual override from dashboard'
      })
      
      // Reload campaigns
      const campaignList = await campaignManager.getCampaigns()
      setCampaigns(campaignList)
    } catch (error) {
      console.error('Failed to apply manual override:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit size={16} />
      case 'active': return <Play size={16} />
      case 'paused': return <Pause size={16} />
      case 'completed': return <CheckCircle size={16} />
      case 'failed': return <XCircle size={16} />
      default: return <Clock size={16} />
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'draft': return styles.statusDraft
      case 'active': return styles.statusActive
      case 'paused': return styles.statusPaused
      case 'completed': return styles.statusCompleted
      case 'failed': return styles.statusFailed
      default: return styles.statusDraft
    }
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail size={16} />
      case 'whatsapp': return <MessageCircle size={16} />
      case 'sms': return <Smartphone size={16} />
      case 'multi': return <Users size={16} />
      default: return <MessageSquare size={16} />
    }
  }

  const renderOverview = () => {
    if (!dashboard) return null

    return (
      <div>
        <div style={styles.overviewGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' }}>
                <Target />
              </div>
            </div>
            <div style={styles.metricValue}>{dashboard.overview.totalCampaigns}</div>
            <div style={styles.metricLabel}>Total Campaigns</div>
            <div style={styles.metricChange}>
              <TrendingUp size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>+12% from last month</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                <Play />
              </div>
            </div>
            <div style={styles.metricValue}>{dashboard.overview.activeCampaigns}</div>
            <div style={styles.metricLabel}>Active Campaigns</div>
            <div style={styles.metricChange}>
              <Activity size={12} color="#3b82f6" />
              <span style={{ color: '#3b82f6' }}>Running now</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' }}>
                <Users />
              </div>
            </div>
            <div style={styles.metricValue}>{dashboard.overview.totalAudience.toLocaleString()}</div>
            <div style={styles.metricLabel}>Total Audience</div>
            <div style={styles.metricChange}>
              <TrendingUp size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>+8% growth</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                <DollarSign />
              </div>
            </div>
            <div style={styles.metricValue}>${dashboard.overview.revenue.toLocaleString()}</div>
            <div style={styles.metricLabel}>Total Revenue</div>
            <div style={styles.metricChange}>
              <TrendingUp size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>+23% ROI</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginBottom: '20px' }}>
            Recent Campaigns
          </h3>
          <div style={styles.campaignsList}>
            {dashboard.campaigns.recent.slice(0, 3).map((campaign) => (
              <div key={campaign.id} style={styles.campaignCard}>
                <div style={styles.campaignHeader}>
                  <div>
                    <div style={styles.campaignTitle}>{campaign.name}</div>
                    <div style={styles.campaignDescription}>{campaign.description}</div>
                  </div>
                  <span style={{ ...styles.statusBadge, ...getStatusStyle(campaign.status) }}>
                    {campaign.status}
                  </span>
                </div>
                <div style={styles.performanceBar}>
                  <div style={{ ...styles.performanceSegment, background: '#6366f1', width: '25%' }} />
                  <div style={{ ...styles.performanceSegment, background: '#22c55e', width: '20%' }} />
                  <div style={{ ...styles.performanceSegment, background: '#fbbf24', width: '15%' }} />
                  <div style={{ ...styles.performanceSegment, background: '#ef4444', width: '5%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderCampaigns = () => {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
            Campaign Management
          </h3>
          <button 
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() => setShowCampaignModal(true)}
          >
            <Plus size={16} />
            Create Campaign
          </button>
        </div>

        <div style={styles.campaignsList}>
          {campaigns.map((campaign) => (
            <div key={campaign.id} style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    {getChannelIcon(campaign.type)}
                    <div style={styles.campaignTitle}>{campaign.name}</div>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(campaign.status) }}>
                      {campaign.status}
                    </span>
                  </div>
                  <div style={styles.campaignDescription}>{campaign.description}</div>
                  <div style={styles.campaignMeta}>
                    <span>{campaign.targetAudience.name}</span>
                    <span>•</span>
                    <span>{campaign.automationLevel}</span>
                    <span>•</span>
                    <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div style={styles.campaignActions}>
                {campaign.status === 'draft' && (
                  <>
                    <button 
                      style={{ ...styles.button, ...styles.primaryButton }}
                      onClick={() => handleCampaignAction(campaign.id, 'start')}
                    >
                      <Play size={14} />
                      Start
                    </button>
                    <button 
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={() => setSelectedCampaign(campaign)}
                    >
                      <Edit size={14} />
                      Edit
                    </button>
                  </>
                )}
                
                {campaign.status === 'active' && (
                  <>
                    <button 
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={() => handleCampaignAction(campaign.id, 'pause')}
                    >
                      <Pause size={14} />
                      Pause
                    </button>
                    <button 
                      style={{ ...styles.button, ...styles.dangerButton }}
                      onClick={() => handleCampaignAction(campaign.id, 'stop')}
                    >
                      <Square size={14} />
                      Stop
                    </button>
                    <button 
                      style={{ ...styles.button, ...styles.secondaryButton }}
                      onClick={() => handleManualOverride(campaign.id, 'pause')}
                    >
                      <Shield size={14} />
                      Manual Override
                    </button>
                  </>
                )}
                
                {campaign.status === 'paused' && (
                  <>
                    <button 
                      style={{ ...styles.button, ...styles.successButton }}
                      onClick={() => handleCampaignAction(campaign.id, 'start')}
                    >
                      <Play size={14} />
                      Resume
                    </button>
                    <button 
                      style={{ ...styles.button, ...styles.dangerButton }}
                      onClick={() => handleCampaignAction(campaign.id, 'stop')}
                    >
                      <Square size={14} />
                      Stop
                    </button>
                  </>
                )}
                
                <button 
                  style={{ ...styles.button, ...styles.secondaryButton }}
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <BarChart3 size={14} />
                  Analytics
                </button>
              </div>
            </div>
          ))}
        </div>

        {campaigns.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📱</div>
            <div style={styles.emptyText}>No campaigns yet</div>
            <button 
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={() => setShowCampaignModal(true)}
            >
              Create Your First Campaign
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderAudiences = () => {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>
            Audience Segments
          </h3>
          <button 
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() => setShowAudienceModal(true)}
          >
            <Plus size={16} />
            Create Segment
          </button>
        </div>

        <div style={styles.campaignsList}>
          {audiences.map((audience) => (
            <div key={audience.id} style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div style={{ flex: 1 }}>
                  <div style={styles.campaignTitle}>{audience.name}</div>
                  <div style={styles.campaignDescription}>{audience.description}</div>
                  <div style={styles.campaignMeta}>
                    <span>{audience.size} contacts</span>
                    <span>•</span>
                    <span>Est. reach: {audience.estimatedReach}</span>
                    <span>•</span>
                    <span>{audience.isActive ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>

              <div style={styles.campaignActions}>
                <button style={{ ...styles.button, ...styles.secondaryButton }}>
                  <Eye size={14} />
                  View
                </button>
                <button style={{ ...styles.button, ...styles.secondaryButton }}>
                  <Edit size={14} />
                  Edit
                </button>
                <button style={{ ...styles.button, ...styles.secondaryButton }}>
                  <Users size={14} />
                  Preview
                </button>
              </div>
            </div>
          ))}
        </div>

        {audiences.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>👥</div>
            <div style={styles.emptyText}>No audience segments yet</div>
            <button 
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={() => setShowAudienceModal(true)}
            >
              Create Your First Segment
            </button>
          </div>
        )}
      </div>
    )
  }

  const renderAutomation = () => {
    return (
      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginBottom: '24px' }}>
          Automation Engine Status
        </h3>

        <div style={styles.overviewGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                <Zap />
              </div>
            </div>
            <div style={styles.metricValue}>
              {automationStatus === 'running' ? 'Active' : 'Paused'}
            </div>
            <div style={styles.metricLabel}>Engine Status</div>
            <div style={styles.metricChange}>
              {automationStatus === 'running' ? (
                <>
                  <CheckCircle size={12} color="#22c55e" />
                  <span style={{ color: '#22c55e' }}>All systems operational</span>
                </>
              ) : (
                <>
                  <Pause size={12} color="#fbbf24" />
                  <span style={{ color: '#fbbf24' }}>Engine paused</span>
                </>
              )}
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                <Activity />
              </div>
            </div>
            <div style={styles.metricValue}>0</div>
            <div style={styles.metricLabel}>Active Workflows</div>
            <div style={styles.metricChange}>
              <TrendingUp size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>Ready for automation</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24' }}>
                <Clock />
              </div>
            </div>
            <div style={styles.metricValue}>0ms</div>
            <div style={styles.metricLabel}>Avg Response Time</div>
            <div style={styles.metricChange}>
              <CheckCircle size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>Optimal performance</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                <AlertTriangle />
              </div>
            </div>
            <div style={styles.metricValue}>0</div>
            <div style={styles.metricLabel}>Errors</div>
            <div style={styles.metricChange}>
              <CheckCircle size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>No issues detected</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
            Automation Features
          </h4>
          <div style={styles.campaignsList}>
            <div style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <div style={styles.campaignTitle}>Smart Campaign Execution</div>
                  <div style={styles.campaignDescription}>
                    Automatically execute campaigns based on schedules, triggers, and customer behavior
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <div style={styles.campaignTitle}>Real-time Personalization</div>
                  <div style={styles.campaignDescription}>
                    AI-powered message personalization based on customer profiles and behavior
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <div style={styles.campaignTitle}>Multi-channel Orchestration</div>
                  <div style={styles.campaignDescription}>
                    Coordinate campaigns across WhatsApp, email, SMS, and other channels
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderManual = () => {
    return (
      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff', marginBottom: '24px' }}>
          Manual Control Center
        </h3>

        <div style={styles.overviewGrid}>
          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' }}>
                <Shield />
              </div>
            </div>
            <div style={styles.metricValue}>Active</div>
            <div style={styles.metricLabel}>Manual Override</div>
            <div style={styles.metricChange}>
              <CheckCircle size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>Ready to intervene</span>
            </div>
          </div>

          <div style={styles.metricCard}>
            <div style={styles.metricHeader}>
              <div style={{ ...styles.metricIcon, background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                <CheckCircle />
              </div>
            </div>
            <div style={styles.metricValue}>0</div>
            <div style={styles.metricLabel}>Pending Approvals</div>
            <div style={styles.metricChange}>
              <CheckCircle size={12} color="#22c55e" />
              <span style={{ color: '#22c55e' }}>All clear</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px' }}>
          <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
            Manual Control Features
          </h4>
          <div style={styles.campaignsList}>
            <div style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <div style={styles.campaignTitle}>Campaign Override</div>
                  <div style={styles.campaignDescription}>
                    Manually pause, stop, or modify any running campaign regardless of automation settings
                  </div>
                </div>
              </div>
              <div style={styles.campaignActions}>
                <button style={{ ...styles.button, ...styles.primaryButton }}>
                  <Settings size={14} />
                  Configure
                </button>
              </div>
            </div>

            <div style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <div style={styles.campaignTitle}>Message Approval</div>
                  <div style={styles.campaignDescription}>
                    Review and approve individual messages before they're sent to customers
                  </div>
                </div>
              </div>
              <div style={styles.campaignActions}>
                <button style={{ ...styles.button, ...styles.secondaryButton }}>
                  <Eye size={14} />
                  Review Queue
                </button>
              </div>
            </div>

            <div style={styles.campaignCard}>
              <div style={styles.campaignHeader}>
                <div>
                  <div style={styles.campaignTitle}>Emergency Stop</div>
                  <div style={styles.campaignDescription}>
                    Immediately halt all automation activities in case of emergency or system issues
                  </div>
                </div>
              </div>
              <div style={styles.campaignActions}>
                <button style={{ ...styles.button, ...styles.dangerButton }}>
                  <Square size={14} />
                  Emergency Stop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div style={styles.loading}>Loading marketing automation dashboard...</div>
  }

  return (
    <div style={styles.container} className={className}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <div style={styles.header}>
        <h1 style={styles.title}>🚀 Marketing Automation</h1>
        <div style={styles.automationStatus}>
          <div style={styles.statusDot} />
          <span style={styles.statusText}>Automation Engine {automationStatus}</span>
        </div>
      </div>

      <div style={styles.tabs}>
        {[
          { id: 'overview', label: '📊 Overview', icon: <BarChart3 size={16} /> },
          { id: 'campaigns', label: '📱 Campaigns', icon: <Target size={16} /> },
          { id: 'audiences', label: '👥 Audiences', icon: <Users size={16} /> },
          { id: 'automation', label: '⚡ Automation', icon: <Zap size={16} /> },
          { id: 'manual', label: '🛡️ Manual Control', icon: <Shield size={16} /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
          >
            <span style={{ marginRight: '8px' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'campaigns' && renderCampaigns()}
      {activeTab === 'audiences' && renderAudiences()}
      {activeTab === 'automation' && renderAutomation()}
      {activeTab === 'manual' && renderManual()}

      {/* Campaign Modal */}
      {showCampaignModal && (
        <div style={styles.modal} onClick={() => setShowCampaignModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Create New Campaign</h3>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Campaign Name</label>
              <input type="text" style={styles.formInput} placeholder="Enter campaign name" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Description</label>
              <textarea style={styles.formTextarea} placeholder="Describe your campaign" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Type</label>
              <select style={styles.formSelect}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="multi">Multi-channel</option>
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Automation Level</label>
              <select style={styles.formSelect}>
                <option value="manual">Manual</option>
                <option value="semi-automated">Semi-automated</option>
                <option value="fully-automated">Fully Automated</option>
              </select>
            </div>
            <div style={styles.modalActions}>
              <button 
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setShowCampaignModal(false)}
              >
                Cancel
              </button>
              <button 
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() => setShowCampaignModal(false)}
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audience Modal */}
      {showAudienceModal && (
        <div style={styles.modal} onClick={() => setShowAudienceModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Create Audience Segment</h3>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Segment Name</label>
              <input type="text" style={styles.formInput} placeholder="Enter segment name" />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Description</label>
              <textarea style={styles.formTextarea} placeholder="Describe your audience segment" />
            </div>
            <div style={styles.modalActions}>
              <button 
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setShowAudienceModal(false)}
              >
                Cancel
              </button>
              <button 
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={() => setShowAudienceModal(false)}
              >
                Create Segment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
