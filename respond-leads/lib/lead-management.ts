import { getSupabaseClient } from './supabase'
import { Lead, LeadScoringRule, Conversation } from '../types'
import { logger } from './logger'

export class LeadManagementService {
  private supabase = getSupabaseClient()

  /**
   * Get all leads with optional filtering
   */
  async getLeads(filters?: {
    status?: string
    minScore?: number
    maxScore?: number
    priority?: string
    limit?: number
  }): Promise<Lead[]> {
    try {
      let query = this.supabase
        .from('leads')
        .select('*')
        .order('lead_score', { ascending: false })
        .order('updated_at', { ascending: false })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.minScore !== undefined) {
        query = query.gte('lead_score', filters.minScore)
      }

      if (filters?.maxScore !== undefined) {
        query = query.lte('lead_score', filters.maxScore)
      }

      if (filters?.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query
      if (error) throw error

      return data || []
    } catch (error) {
      logger.error('Failed to fetch leads', error as Error)
      throw error
    }
  }

  /**
   * Update lead status and conversion details
   */
  async updateLeadStatus(
    conversationId: number,
    updates: {
      status?: 'new' | 'qualified' | 'contacted' | 'converted' | 'lost'
      conversion_value?: number
      conversion_date?: string
      next_follow_up?: string
      tags?: string[]
    }
  ): Promise<void> {
    try {
      const updateData: any = { ...updates, updated_at: new Date().toISOString() }

      if (updates.status === 'converted' && updates.conversion_value && updates.conversion_date) {
        updateData.converted_at = updates.conversion_date
      }

      // Update conversations table
      const { error: convoError } = await this.supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId)

      if (convoError) throw convoError

      // Update leads table
      const { error: leadError } = await this.supabase
        .from('leads')
        .update(updateData)
        .eq('conversation_id', conversationId)

      if (leadError) throw leadError

      logger.info('Lead status updated successfully', { conversationId, updates })
    } catch (error) {
      logger.error('Failed to update lead status', error as Error)
      throw error
    }
  }

  /**
   * Get lead scoring rules
   */
  async getScoringRules(): Promise<LeadScoringRule[]> {
    try {
      const { data, error } = await this.supabase
        .from('lead_scoring_rules')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Failed to fetch scoring rules', error as Error)
      throw error
    }
  }

  /**
   * Update lead scoring rules
   */
  async updateScoringRule(ruleId: number, updates: Partial<LeadScoringRule>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('lead_scoring_rules')
        .update(updates)
        .eq('id', ruleId)

      if (error) throw error

      // Recalculate all lead scores after rule update
      await this.recalculateAllLeadScores()

      logger.info('Scoring rule updated', { ruleId, updates })
    } catch (error) {
      logger.error('Failed to update scoring rule', error as Error)
      throw error
    }
  }

  /**
   * Recalculate lead scores for all conversations
   */
  async recalculateAllLeadScores(): Promise<void> {
    try {
      // This will trigger the database function to recalculate scores
      const { error } = await this.supabase.rpc('recalculate_lead_scores')

      if (error) {
        // Fallback: update each conversation individually
        logger.warn('RPC function not available, using fallback recalculation')
        await this.fallbackRecalculateScores()
      }

      logger.info('Lead scores recalculated successfully')
    } catch (error) {
      logger.error('Failed to recalculate lead scores', error as Error)
      throw error
    }
  }

  /**
   * Fallback method to recalculate scores
   */
  private async fallbackRecalculateScores(): Promise<void> {
    try {
      const { data: conversations, error } = await this.supabase
        .from('conversations')
        .select('id, history')

      if (error) throw error

      for (const convo of conversations || []) {
        // Trigger the update trigger by updating the history field
        await this.supabase
          .from('conversations')
          .update({ history: convo.history })
          .eq('id', convo.id)
      }
    } catch (error) {
      logger.error('Fallback score recalculation failed', error as Error)
    }
  }

  /**
   * Get lead analytics and insights
   */
  async getLeadAnalytics(timeframe: '7d' | '30d' | '90d' = '30d'): Promise<{
    totalLeads: number
    qualifiedLeads: number
    conversionRate: number
    averageLeadScore: number
    totalConversionValue: number
    leadsByStatus: Record<string, number>
    leadsByPriority: Record<string, number>
    topScoringLeads: Lead[]
  }> {
    try {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: leads, error } = await this.supabase
        .from('leads')
        .select('*')
        .gte('created_at', startDate.toISOString())

      if (error) throw error

      const leadsData = leads || []
      const totalLeads = leadsData.length
      const qualifiedLeads = leadsData.filter(l => l.status === 'qualified').length
      const convertedLeads = leadsData.filter(l => l.status === 'converted').length
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const averageLeadScore = totalLeads > 0
        ? leadsData.reduce((sum, l) => sum + l.lead_score, 0) / totalLeads
        : 0

      const totalConversionValue = leadsData
        .filter(l => l.status === 'converted')
        .reduce((sum, l) => sum + (l.estimated_value || 0), 0)

      const leadsByStatus = leadsData.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Get priority from conversations
      const { data: conversations } = await this.supabase
        .from('conversations')
        .select('priority')
        .gte('created_at', startDate.toISOString())

      const leadsByPriority = (conversations || []).reduce((acc, convo) => {
        const priority = convo.priority || 'medium'
        acc[priority] = (acc[priority] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topScoringLeads = leadsData
        .sort((a, b) => b.lead_score - a.lead_score)
        .slice(0, 10)

      return {
        totalLeads,
        qualifiedLeads,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageLeadScore: Math.round(averageLeadScore * 100) / 100,
        totalConversionValue,
        leadsByStatus,
        leadsByPriority,
        topScoringLeads
      }
    } catch (error) {
      logger.error('Failed to get lead analytics', error as Error)
      throw error
    }
  }

  /**
   * Export leads for CRM integration
   */
  async exportLeads(filters?: {
    status?: string
    minScore?: number
    format?: 'json' | 'csv'
  }): Promise<string> {
    try {
      const leads = await this.getLeads(filters)

      if (filters?.format === 'csv') {
        // Convert to CSV
        const headers = ['ID', 'Phone Number', 'Customer Name', 'Lead Score', 'Status', 'Estimated Value', 'Last Message', 'Created At']
        const rows = leads.map(lead => [
          lead.id,
          lead.phone_number,
          lead.customer_name,
          lead.lead_score,
          lead.status,
          lead.estimated_value || 0,
          `"${(lead.last_message || '').replace(/"/g, '""')}"`,
          lead.created_at
        ])

        return [headers, ...rows].map(row => row.join(',')).join('\n')
      }

      // Default JSON export
      return JSON.stringify(leads, null, 2)
    } catch (error) {
      logger.error('Failed to export leads', error as Error)
      throw error
    }
  }
}

export const leadManagementService = new LeadManagementService()