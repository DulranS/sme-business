import { 
  Campaign, 
  AudienceSegment, 
  CustomerProfile, 
  CampaignContent,
  CampaignSchedule,
  CampaignPerformance,
  CampaignSettings
} from '@/types/marketing-automation'
import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { handleDatabaseError } from './errors'

export class CampaignManager {
  private supabase = getSupabaseClient()

  // Campaign CRUD Operations
  async createCampaign(campaign: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
    try {
      const { data, error } = await this.supabase
        .from('campaigns')
        .insert({
          name: campaign.name,
          description: campaign.description,
          type: campaign.type,
          status: campaign.status,
          automation_level: campaign.automationLevel,
          target_audience_id: campaign.targetAudience.id,
          content: campaign.content,
          schedule: campaign.schedule,
          performance: campaign.performance,
          settings: campaign.settings,
          created_by: campaign.createdBy
        })
        .select()
        .single()

      if (error) throw handleDatabaseError(error)
      
      logger.info('Campaign created successfully', { campaignId: data.id, name: data.name })
      return this.mapDbCampaignToCampaign(data)
    } catch (error) {
      logger.error('Failed to create campaign', { campaign }, error as Error)
      throw error
    }
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign> {
    try {
      const updateData: any = {}
      
      if (updates.name) updateData.name = updates.name
      if (updates.description) updateData.description = updates.description
      if (updates.status) updateData.status = updates.status
      if (updates.targetAudience) updateData.target_audience_id = updates.targetAudience.id
      if (updates.content) updateData.content = updates.content
      if (updates.schedule) updateData.schedule = updates.schedule
      if (updates.performance) updateData.performance = updates.performance
      if (updates.settings) updateData.settings = updates.settings

      const { data, error } = await this.supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw handleDatabaseError(error)
      if (!data) throw new Error('Campaign not found')

      logger.info('Campaign updated successfully', { campaignId: id })
      return this.mapDbCampaignToCampaign(data)
    } catch (error) {
      logger.error('Failed to update campaign', { id, updates }, error as Error)
      throw error
    }
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    try {
      const { data, error } = await this.supabase
        .from('campaigns')
        .select(`
          *,
          target_audience:audience_segments(*)
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw handleDatabaseError(error)
      }

      return this.mapDbCampaignToCampaign(data)
    } catch (error) {
      logger.error('Failed to get campaign', { id }, error as Error)
      throw error
    }
  }

  async getCampaigns(filters?: {
    status?: string
    type?: string
    automationLevel?: string
    limit?: number
    offset?: number
  }): Promise<Campaign[]> {
    try {
      let query = this.supabase
        .from('campaigns')
        .select(`
          *,
          target_audience:audience_segments(*)
        `)
        .order('created_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.automationLevel) {
        query = query.eq('automation_level', filters.automationLevel)
      }
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) throw handleDatabaseError(error)
      
      return (data || []).map(campaign => this.mapDbCampaignToCampaign(campaign))
    } catch (error) {
      logger.error('Failed to get campaigns', { filters }, error as Error)
      throw error
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('campaigns')
        .delete()
        .eq('id', id)

      if (error) throw handleDatabaseError(error)

      logger.info('Campaign deleted successfully', { campaignId: id })
    } catch (error) {
      logger.error('Failed to delete campaign', { id }, error as Error)
      throw error
    }
  }

  // Audience Management
  async createAudienceSegment(segment: Omit<AudienceSegment, 'id' | 'createdAt'>): Promise<AudienceSegment> {
    try {
      const { data, error } = await this.supabase
        .from('audience_segments')
        .insert({
          name: segment.name,
          description: segment.description,
          criteria: segment.criteria,
          size: segment.size,
          estimated_reach: segment.estimatedReach,
          is_active: segment.isActive
        })
        .select()
        .single()

      if (error) throw handleDatabaseError(error)

      logger.info('Audience segment created', { segmentId: data.id, name: data.name })
      return this.mapDbSegmentToSegment(data)
    } catch (error) {
      logger.error('Failed to create audience segment', { segment }, error as Error)
      throw error
    }
  }

  async getAudienceSegments(): Promise<AudienceSegment[]> {
    try {
      const { data, error } = await this.supabase
        .from('audience_segments')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw handleDatabaseError(error)
      
      return (data || []).map(segment => this.mapDbSegmentToSegment(segment))
    } catch (error) {
      logger.error('Failed to get audience segments', {}, error as Error)
      throw error
    }
  }

  async updateAudienceSegmentSize(segmentId: string): Promise<void> {
    try {
      // Get segment criteria
      const { data: segment, error: segmentError } = await this.supabase
        .from('audience_segments')
        .select('criteria')
        .eq('id', segmentId)
        .single()

      if (segmentError) throw segmentError
      if (!segment) throw new Error('Segment not found')

      // Calculate actual size based on criteria
      const size = await this.calculateSegmentSize(segment.criteria)

      // Update segment
      const { error: updateError } = await this.supabase
        .from('audience_segments')
        .update({ 
          size,
          estimated_reach: size,
          updated_at: new Date().toISOString()
        })
        .eq('id', segmentId)

      if (updateError) throw updateError

      logger.info('Audience segment size updated', { segmentId, size })
    } catch (error) {
      logger.error('Failed to update audience segment size', { segmentId }, error as Error)
      throw error
    }
  }

  private async calculateSegmentSize(criteria: any): Promise<number> {
    try {
      let query = this.supabase
        .from('customer_profiles')
        .select('id', { count: 'exact', head: true })

      // Apply criteria filters
      if (criteria.customerType) {
        query = query.contains('tags', [criteria.customerType])
      }

      if (criteria.demographics?.ageRange) {
        const [minAge, maxAge] = criteria.demographics.ageRange
        query = query
          .gte('demographics->>age', minAge)
          .lte('demographics->>age', maxAge)
      }

      if (criteria.demographics?.location) {
        query = query.contains('demographics->>location', criteria.demographics.location)
      }

      if (criteria.behavior?.engagementLevel) {
        query = query.eq('behavior->>engagementLevel', criteria.behavior.engagementLevel)
      }

      if (criteria.behavior?.preferredChannel) {
        query = query.eq('preferences->>preferredChannel', criteria.behavior.preferredChannel)
      }

      const { count, error } = await query

      if (error) throw error
      return count || 0
    } catch (error) {
      logger.error('Failed to calculate segment size', { criteria }, error as Error)
      return 0
    }
  }

  // Customer Profile Management
  async createCustomerProfile(profile: Omit<CustomerProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomerProfile> {
    try {
      const { data, error } = await this.supabase
        .from('customer_profiles')
        .insert({
          contact_info: profile.contactInfo,
          demographics: profile.demographics,
          behavior: profile.behavior,
          preferences: profile.preferences,
          purchase_history: profile.purchaseHistory,
          communication_history: profile.communicationHistory,
          segments: profile.segments,
          tags: profile.tags,
          score: profile.score,
          last_activity: profile.lastActivity
        })
        .select()
        .single()

      if (error) throw handleDatabaseError(error)

      logger.info('Customer profile created', { customerId: data.id })
      return this.mapDbProfileToProfile(data)
    } catch (error) {
      logger.error('Failed to create customer profile', { profile }, error as Error)
      throw error
    }
  }

  async getCustomerProfiles(filters?: {
    segmentId?: string
    tags?: string[]
    scoreMin?: number
    scoreMax?: number
    limit?: number
    offset?: number
  }): Promise<CustomerProfile[]> {
    try {
      let query = this.supabase
        .from('customer_profiles')
        .select('*')
        .order('score', { ascending: false })

      if (filters?.segmentId) {
        query = query.contains('segments', [filters.segmentId])
      }
      if (filters?.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags)
      }
      if (filters?.scoreMin !== undefined) {
        query = query.gte('score', filters.scoreMin)
      }
      if (filters?.scoreMax !== undefined) {
        query = query.lte('score', filters.scoreMax)
      }
      if (filters?.limit) {
        query = query.limit(filters.limit)
      }
      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) throw handleDatabaseError(error)
      
      return (data || []).map(profile => this.mapDbProfileToProfile(profile))
    } catch (error) {
      logger.error('Failed to get customer profiles', { filters }, error as Error)
      throw error
    }
  }

  async updateCustomerProfile(id: string, updates: Partial<CustomerProfile>): Promise<CustomerProfile> {
    try {
      const updateData: any = {}
      
      if (updates.contactInfo) updateData.contact_info = updates.contactInfo
      if (updates.demographics) updateData.demographics = updates.demographics
      if (updates.behavior) updateData.behavior = updates.behavior
      if (updates.preferences) updateData.preferences = updates.preferences
      if (updates.purchaseHistory) updateData.purchase_history = updates.purchaseHistory
      if (updates.communicationHistory) updateData.communication_history = updates.communicationHistory
      if (updates.segments) updateData.segments = updates.segments
      if (updates.tags) updateData.tags = updates.tags
      if (updates.score !== undefined) updateData.score = updates.score
      if (updates.lastActivity) updateData.last_activity = updates.lastActivity

      const { data, error } = await this.supabase
        .from('customer_profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw handleDatabaseError(error)
      if (!data) throw new Error('Customer profile not found')

      logger.info('Customer profile updated', { customerId: id })
      return this.mapDbProfileToProfile(data)
    } catch (error) {
      logger.error('Failed to update customer profile', { id, updates }, error as Error)
      throw error
    }
  }

  // Campaign Execution
  async previewCampaign(campaignId: string, limit: number = 5): Promise<{
    customers: CustomerProfile[]
    messages: Array<{
      customerId: string
      message: string
      channel: string
    }>
  }> {
    try {
      const campaign = await this.getCampaign(campaignId)
      if (!campaign) throw new Error('Campaign not found')

      // Get target customers
      const customers = await this.getCustomerProfiles({
        segmentId: campaign.targetAudience.id,
        limit
      })

      // Generate preview messages
      const messages = await Promise.all(
        customers.map(async (customer) => {
          const message = await this.generatePersonalizedMessage(campaign.content, customer)
          return {
            customerId: customer.id,
            message,
            channel: campaign.type
          }
        })
      )

      return { customers, messages }
    } catch (error) {
      logger.error('Failed to preview campaign', { campaignId, limit }, error as Error)
      throw error
    }
  }

  async scheduleCampaign(campaignId: string, schedule: CampaignSchedule): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('campaigns')
        .update({ 
          schedule,
          status: 'scheduled'
        })
        .eq('id', campaignId)

      if (error) throw handleDatabaseError(error)

      logger.info('Campaign scheduled', { campaignId, schedule })
    } catch (error) {
      logger.error('Failed to schedule campaign', { campaignId, schedule }, error as Error)
      throw error
    }
  }

  // Analytics and Reporting
  async getCampaignMetrics(campaignId: string): Promise<CampaignPerformance> {
    try {
      const { data, error } = await this.supabase
        .from('campaign_performance')
        .select('*')
        .eq('campaign_id', campaignId)

      if (error) throw handleDatabaseError(error)

      const performance: CampaignPerformance = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        bounced: 0,
        unsubscribed: 0,
        revenue: 0,
        cost: 0,
        roi: 0,
        metrics: []
      }

      if (data) {
        data.forEach(metric => {
          switch (metric.metric) {
            case 'sent':
              performance.sent += metric.value
              break
            case 'delivered':
              performance.delivered += metric.value
              break
            case 'opened':
              performance.opened += metric.value
              break
            case 'clicked':
              performance.clicked += metric.value
              break
            case 'converted':
              performance.converted += metric.value
              break
            case 'bounced':
              performance.bounced += metric.value
              break
            case 'unsubscribed':
              performance.unsubscribed += metric.value
              break
            case 'revenue':
              performance.revenue += metric.value
              break
            case 'cost':
              performance.cost += metric.value
              break
          }
        })

        // Calculate ROI
        if (performance.cost > 0) {
          performance.roi = (performance.revenue - performance.cost) / performance.cost * 100
        }
      }

      return performance
    } catch (error) {
      logger.error('Failed to get campaign metrics', { campaignId }, error as Error)
      throw error
    }
  }

  async getCampaignAnalytics(period: 'day' | 'week' | 'month' = 'week'): Promise<{
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    performance: {
      sent: number
      delivered: number
      opened: number
      clicked: number
      converted: number
      revenue: number
      cost: number
    }
    trends: Array<{
      date: string
      sent: number
      delivered: number
      opened: number
      clicked: number
      converted: number
    }>
  }> {
    try {
      // Get campaign summary
      const { data: campaigns, error: campaignsError } = await this.supabase
        .from('campaign_summary')
        .select('*')

      if (campaignsError) throw campaignsError

      const total = campaigns?.length || 0
      const byStatus: Record<string, number> = {}
      const byType: Record<string, number> = {}

      campaigns?.forEach(campaign => {
        byStatus[campaign.status] = (byStatus[campaign.status] || 0) + 1
        byType[campaign.type] = (byType[campaign.type] || 0) + 1
      })

      // Aggregate performance
      const performance = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        converted: 0,
        revenue: 0,
        cost: 0
      }

      campaigns?.forEach(campaign => {
        performance.sent += campaign.sent
        performance.delivered += campaign.delivered
        performance.opened += campaign.opened
        performance.clicked += campaign.clicked
        performance.converted += campaign.converted
        performance.revenue += campaign.revenue
        performance.cost += campaign.cost
      })

      // Get trends (simplified - in production would use proper date grouping)
      const trends = campaigns?.slice(0, 7).map(campaign => ({
        date: campaign.created_at,
        sent: campaign.sent,
        delivered: campaign.delivered,
        opened: campaign.opened,
        clicked: campaign.clicked,
        converted: campaign.converted
      })) || []

      return {
        total,
        byStatus,
        byType,
        performance,
        trends
      }
    } catch (error) {
      logger.error('Failed to get campaign analytics', { period }, error as Error)
      throw error
    }
  }

  // Helper Methods
  private async generatePersonalizedMessage(content: CampaignContent, customer: CustomerProfile): Promise<string> {
    // This would integrate with the AI service for personalization
    // For now, return a basic template
    const template = content.template.body
    
    // Simple variable replacement
    return template
      .replace(/\{\{customer_name\}\}/g, 
        customer.contactInfo.email || customer.contactInfo.phone || 'Customer')
      .replace(/\{\{customer_location\}\}/g, 
        customer.demographics.location || 'your area')
      .replace(/\{\{customer_score\}\}/g, 
        customer.score.toString())
  }

  private mapDbCampaignToCampaign(dbCampaign: any): Campaign {
    return {
      id: dbCampaign.id,
      name: dbCampaign.name,
      description: dbCampaign.description,
      type: dbCampaign.type,
      status: dbCampaign.status,
      automationLevel: dbCampaign.automation_level,
      targetAudience: dbCampaign.target_audience || {
        id: '',
        name: 'Default',
        description: '',
        criteria: {},
        size: 0,
        estimatedReach: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      },
      content: dbCampaign.content,
      schedule: dbCampaign.schedule,
      performance: dbCampaign.performance,
      settings: dbCampaign.settings,
      createdAt: dbCampaign.created_at,
      updatedAt: dbCampaign.updated_at,
      createdBy: dbCampaign.created_by
    }
  }

  private mapDbSegmentToSegment(dbSegment: any): AudienceSegment {
    return {
      id: dbSegment.id,
      name: dbSegment.name,
      description: dbSegment.description,
      criteria: dbSegment.criteria,
      size: dbSegment.size,
      estimatedReach: dbSegment.estimated_reach,
      isActive: dbSegment.is_active,
      createdAt: dbSegment.created_at
    }
  }

  private mapDbProfileToProfile(dbProfile: any): CustomerProfile {
    return {
      id: dbProfile.id,
      contactInfo: dbProfile.contact_info,
      demographics: dbProfile.demographics,
      behavior: dbProfile.behavior,
      preferences: dbProfile.preferences,
      purchaseHistory: dbProfile.purchase_history,
      communicationHistory: dbProfile.communication_history,
      segments: dbProfile.segments || [],
      tags: dbProfile.tags || [],
      score: dbProfile.score || 0,
      lastActivity: dbProfile.last_activity,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at
    }
  }
}

// Singleton instance
export const campaignManager = new CampaignManager()
