import { 
  Campaign, 
  AutomationWorkflow, 
  CustomerProfile, 
  AutomationEvent,
  ManualAction,
  OutboundMessage,
  SendResult,
  AutomationEngine as IAutomationEngine,
  ManualControl as IManualControl
} from '@/types/marketing-automation'
import { getSupabaseClient } from './supabase'
import { logger } from './logger'
import { whatsappService } from './whatsapp'
import { claudeService } from './claude'

export class AutomationEngine implements IAutomationEngine {
  private supabase = getSupabaseClient()
  private isRunning = false
  private manualOverrides = new Map<string, ManualAction>()
  private queue: Array<{
    type: 'campaign' | 'workflow' | 'event'
    id: string
    data?: any
    priority: number
    timestamp: number
  }> = []
  private processing = false

  constructor() {
    this.startEngine()
  }

  private async startEngine() {
    this.isRunning = true
    logger.info('Marketing Automation Engine started')
    
    // Process queue every 5 seconds
    setInterval(() => this.processQueue(), 5000)
    
    // Check for scheduled campaigns every minute
    setInterval(() => this.checkScheduledCampaigns(), 60000)
    
    // Process webhook events in real-time
    setInterval(() => this.processWebhookEvents(), 30000)
  }

  async startCampaign(campaignId: string): Promise<void> {
    try {
      // Check for manual override
      const override = this.manualOverrides.get(`campaign-${campaignId}`)
      if (override && override.type === 'pause') {
        logger.warn(`Campaign ${campaignId} is manually paused`, { override })
        return
      }

      const { data: campaign, error } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      if (error) throw error
      if (!campaign) throw new Error('Campaign not found')

      // Update campaign status
      await this.supabase
        .from('campaigns')
        .update({ 
          status: 'active', 
          started_at: new Date().toISOString() 
        })
        .eq('id', campaignId)

      // Add to processing queue
      this.queue.push({
        type: 'campaign',
        id: campaignId,
        data: campaign,
        priority: 1,
        timestamp: Date.now()
      })

      logger.info(`Campaign ${campaignId} started`, { campaign })

    } catch (error) {
      logger.error('Failed to start campaign', { campaignId, error }, error as Error)
      throw error
    }
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    try {
      await this.supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId)

      // Remove from queue if present
      this.queue = this.queue.filter(item => 
        !(item.type === 'campaign' && item.id === campaignId)
      )

      logger.info(`Campaign ${campaignId} paused`)
    } catch (error) {
      logger.error('Failed to pause campaign', { campaignId, error }, error as Error)
      throw error
    }
  }

  async stopCampaign(campaignId: string): Promise<void> {
    try {
      await this.supabase
        .from('campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)

      // Remove from queue
      this.queue = this.queue.filter(item => 
        !(item.type === 'campaign' && item.id === campaignId)
      )

      logger.info(`Campaign ${campaignId} stopped`)
    } catch (error) {
      logger.error('Failed to stop campaign', { campaignId, error }, error as Error)
      throw error
    }
  }

  async executeWorkflow(workflowId: string, triggerData?: any): Promise<void> {
    try {
      const { data: workflow, error } = await this.supabase
        .from('automation_workflows')
        .select('*')
        .eq('id', workflowId)
        .single()

      if (error) throw error
      if (!workflow) throw new Error('Workflow not found')

      // Add to queue
      this.queue.push({
        type: 'workflow',
        id: workflowId,
        data: { workflow, triggerData },
        priority: 2,
        timestamp: Date.now()
      })

      logger.info(`Workflow ${workflowId} queued for execution`, { workflow })
    } catch (error) {
      logger.error('Failed to execute workflow', { workflowId, error }, error as Error)
      throw error
    }
  }

  async processEvent(event: AutomationEvent): Promise<void> {
    try {
      // Store event
      await this.supabase
        .from('automation_events')
        .insert({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp,
          source: event.source,
          processed: false
        })

      // Check for matching workflows
      const { data: workflows } = await this.supabase
        .from('automation_workflows')
        .select('*')
        .eq('status', 'active')

      if (workflows) {
        for (const workflow of workflows) {
          const matchingTrigger = workflow.triggers.find((trigger: any) => 
            trigger.type === 'event' && trigger.config.eventType === event.type
          )

          if (matchingTrigger) {
            await this.executeWorkflow(workflow.id, event.data)
          }
        }
      }

      logger.info(`Event processed: ${event.type}`, { event })
    } catch (error) {
      logger.error('Failed to process event', { event, error }, error as Error)
      throw error
    }
  }

  async getMetrics() {
    try {
      const { data: metrics } = await this.supabase
        .from('automation_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100)

      return {
        activeWorkflows: 0,
        totalExecutions: 0,
        successRate: 0,
        averageTime: 0,
        errors: 0
      }
    } catch (error) {
      logger.error('Failed to get metrics', { error }, error as Error)
      throw error
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    try {
      // Sort by priority and timestamp
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) return b.priority - a.priority
        return a.timestamp - b.timestamp
      })

      // Process up to 5 items at once
      const itemsToProcess = this.queue.splice(0, 5)

      for (const item of itemsToProcess) {
        try {
          if (item.type === 'campaign') {
            await this.processCampaign(item.data)
          } else if (item.type === 'workflow') {
            await this.processWorkflow(item.data)
          }
        } catch (error) {
          logger.error('Failed to process queue item', { item, error }, error as Error)
        }
      }
    } finally {
      this.processing = false
    }
  }

  private async processCampaign(campaign: Campaign) {
    try {
      // Get target audience
      const { data: audience } = await this.supabase
        .from('customer_profiles')
        .select('*')
        .in('segments', [campaign.targetAudience.id])

      if (!audience || audience.length === 0) {
        logger.warn(`No audience found for campaign ${campaign.id}`)
        return
      }

      // Process each recipient
      for (const customer of audience) {
        try {
          // Check manual override
          const override = this.manualOverrides.get(`campaign-${campaign.id}`)
          if (override && override.type === 'pause') {
            break
          }

          // Generate personalized message
          const message = await this.generatePersonalizedMessage(
            campaign.content,
            customer
          )

          // Send via appropriate channel
          await this.sendMessage(customer, message, campaign.type)

          // Update performance metrics
          await this.updateCampaignMetrics(campaign.id, 'sent')

        } catch (error) {
          logger.error('Failed to send campaign message', { 
            campaignId: campaign.id, 
            customerId: customer.id, 
            error 
          }, error as Error)
        }
      }

      // Update campaign status
      await this.supabase
        .from('campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaign.id)

    } catch (error) {
      logger.error('Failed to process campaign', { campaignId: campaign.id, error }, error as Error)
      
      // Update campaign status to failed
      await this.supabase
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id)
    }
  }

  private async processWorkflow(data: { workflow: AutomationWorkflow, triggerData?: any }) {
    const { workflow, triggerData } = data

    try {
      // Execute workflow steps
      for (const step of workflow.steps) {
        await this.executeWorkflowStep(step, triggerData)
      }

      // Update workflow performance
      await this.updateWorkflowMetrics(workflow.id, 'success')

    } catch (error) {
      logger.error('Failed to process workflow', { workflowId: workflow.id, error }, error as Error)
      await this.updateWorkflowMetrics(workflow.id, 'failure')
    }
  }

  private async executeWorkflowStep(step: any, triggerData?: any) {
    switch (step.type) {
      case 'send_message':
        await this.executeSendMessageStep(step, triggerData)
        break
      case 'wait':
        await this.executeWaitStep(step)
        break
      case 'condition':
        await this.executeConditionStep(step, triggerData)
        break
      case 'action':
        await this.executeActionStep(step, triggerData)
        break
      default:
        logger.warn('Unknown workflow step type', { step })
    }
  }

  private async executeSendMessageStep(step: any, triggerData?: any) {
    // Implementation for sending message step
    logger.info('Executing send message step', { step, triggerData })
  }

  private async executeWaitStep(step: any) {
    const delay = step.config.delayMs || 1000
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  private async executeConditionStep(step: any, triggerData?: any) {
    // Implementation for condition step
    logger.info('Executing condition step', { step, triggerData })
  }

  private async executeActionStep(step: any, triggerData?: any) {
    // Implementation for action step
    logger.info('Executing action step', { step, triggerData })
  }

  private async generatePersonalizedMessage(content: any, customer: CustomerProfile): Promise<string> {
    try {
      // Use Claude to generate personalized message
      const prompt = `Generate a personalized marketing message for a customer based on their profile:

Customer Profile:
- Name: ${customer.contactInfo.email || customer.contactInfo.phone}
- Age: ${customer.demographics.age}
- Location: ${customer.demographics.location}
- Interests: ${customer.preferences.interests.join(', ')}
- Purchase History: ${customer.purchaseHistory.totalOrders} orders, $${customer.purchaseHistory.totalSpent} spent
- Engagement Level: ${customer.behavior.engagementLevel}

Campaign Content:
${JSON.stringify(content)}

Generate a natural, personalized message that references their specific interests and purchase history. Keep it under 150 words.`

      const response = await claudeService.generateResponse(
        customer.contactInfo.email || customer.contactInfo.phone || 'Customer',
        'Generate personalized marketing message',
        [],
        ''
      )

      return response
    } catch (error) {
      logger.error('Failed to generate personalized message', { customer, error }, error as Error)
      return content.template?.body || 'Hello! We have a special offer for you.'
    }
  }

  private async sendMessage(customer: CustomerProfile, message: string, channel: string): Promise<void> {
    try {
      switch (channel) {
        case 'whatsapp':
          if (customer.contactInfo.whatsapp || customer.contactInfo.phone) {
            await whatsappService.sendMessage(
              customer.contactInfo.whatsapp || customer.contactInfo.phone!,
              message
            )
          }
          break
        case 'email':
          logger.warn('Email sending is not configured. Message will be logged rather than delivered.', { customer, message })
          break
        case 'sms':
          logger.warn('SMS sending is not configured. Message will be logged rather than delivered.', { customer, message })
          break
        default:
          throw new Error(`Unknown channel: ${channel}`)
      }
    } catch (error) {
      logger.error('Failed to send message', { customer, channel, error }, error as Error)
      throw error
    }
  }

  private async updateCampaignMetrics(campaignId: string, metric: string) {
    try {
      await this.supabase
        .from('campaign_performance')
        .insert({
          campaign_id: campaignId,
          metric,
          value: 1,
          timestamp: new Date().toISOString()
        })
    } catch (error) {
      logger.error('Failed to update campaign metrics', { campaignId, metric, error }, error as Error)
    }
  }

  private async updateWorkflowMetrics(workflowId: string, result: string) {
    try {
      await this.supabase
        .from('workflow_performance')
        .insert({
          workflow_id: workflowId,
          result,
          timestamp: new Date().toISOString()
        })
    } catch (error) {
      logger.error('Failed to update workflow metrics', { workflowId, result, error }, error as Error)
    }
  }

  private async checkScheduledCampaigns() {
    try {
      const now = new Date().toISOString()
      
      const { data: campaigns } = await this.supabase
        .from('campaigns')
        .select('*')
        .eq('status', 'scheduled')
        .lte('schedule->>startDate', now)

      if (campaigns) {
        for (const campaign of campaigns) {
          await this.startCampaign(campaign.id)
        }
      }
    } catch (error) {
      logger.error('Failed to check scheduled campaigns', { error }, error as Error)
    }
  }

  private async processWebhookEvents() {
    try {
      const { data: events } = await this.supabase
        .from('automation_events')
        .select('*')
        .eq('processed', false)
        .limit(50)

      if (events) {
        for (const event of events) {
          await this.processEvent({
            type: event.type,
            data: event.data,
            timestamp: event.timestamp,
            source: event.source
          })

          // Mark as processed
          await this.supabase
            .from('automation_events')
            .update({ processed: true })
            .eq('id', event.id)
        }
      }
    } catch (error) {
      logger.error('Failed to process webhook events', { error }, error as Error)
    }
  }
}

export class ManualControl implements IManualControl {
  private automationEngine: AutomationEngine
  private supabase = getSupabaseClient()

  constructor(automationEngine: AutomationEngine) {
    this.automationEngine = automationEngine
  }

  async overrideAutomation(campaignId: string, action: ManualAction): Promise<void> {
    try {
      // Store manual override
      this.automationEngine['manualOverrides'].set(`campaign-${campaignId}`, action)

      // Execute action
      switch (action.type) {
        case 'pause':
          await this.automationEngine.pauseCampaign(campaignId)
          break
        case 'stop':
          await this.automationEngine.stopCampaign(campaignId)
          break
        case 'send':
          // Force send campaign
          await this.automationEngine.startCampaign(campaignId)
          break
        default:
          logger.warn('Unknown manual action', { action })
      }

      logger.info(`Manual override applied to campaign ${campaignId}`, { action })
    } catch (error) {
      logger.error('Failed to override automation', { campaignId, action, error }, error as Error)
      throw error
    }
  }

  async approveMessage(messageId: string): Promise<void> {
    try {
      await this.supabase
        .from('campaign_messages')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', messageId)

      logger.info(`Message ${messageId} approved`)
    } catch (error) {
      logger.error('Failed to approve message', { messageId, error }, error as Error)
      throw error
    }
  }

  async rejectMessage(messageId: string, reason: string): Promise<void> {
    try {
      await this.supabase
        .from('campaign_messages')
        .update({ 
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', messageId)

      logger.info(`Message ${messageId} rejected`, { reason })
    } catch (error) {
      logger.error('Failed to reject message', { messageId, reason, error }, error as Error)
      throw error
    }
  }

  async pauseWorkflow(workflowId: string): Promise<void> {
    try {
      await this.supabase
        .from('automation_workflows')
        .update({ status: 'inactive' })
        .eq('id', workflowId)

      logger.info(`Workflow ${workflowId} paused`)
    } catch (error) {
      logger.error('Failed to pause workflow', { workflowId, error }, error as Error)
      throw error
    }
  }

  async resumeWorkflow(workflowId: string): Promise<void> {
    try {
      await this.supabase
        .from('automation_workflows')
        .update({ status: 'active' })
        .eq('id', workflowId)

      logger.info(`Workflow ${workflowId} resumed`)
    } catch (error) {
      logger.error('Failed to resume workflow', { workflowId, error }, error as Error)
      throw error
    }
  }
}

// Singleton instances
export const automationEngine = new AutomationEngine()
export const manualControl = new ManualControl(automationEngine)
