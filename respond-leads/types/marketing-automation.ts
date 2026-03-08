// MARKETING AUTOMATION SYSTEM - CORE TYPES
export interface Campaign {
  id: string
  name: string
  description: string
  type: 'whatsapp' | 'email' | 'sms' | 'multi'
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed'
  automationLevel: 'manual' | 'semi-automated' | 'fully-automated'
  targetAudience: AudienceSegment
  content: CampaignContent
  schedule: CampaignSchedule
  performance: CampaignPerformance
  settings: CampaignSettings
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface AudienceSegment {
  id: string
  name: string
  description: string
  criteria: SegmentCriteria
  size: number
  estimatedReach: number
  isActive: boolean
  createdAt: string
}

export interface SegmentCriteria {
  customerType?: 'new' | 'returning' | 'vip' | 'inactive'
  purchaseHistory?: {
    minSpent?: number
    maxSpent?: number
    lastPurchaseAfter?: string
    lastPurchaseBefore?: string
    productCategories?: string[]
  }
  demographics?: {
    ageRange?: [number, number]
    location?: string[]
    language?: string[]
  }
  behavior?: {
    lastSeenAfter?: string
    lastSeenBefore?: string
    engagementLevel?: 'high' | 'medium' | 'low'
    preferredChannel?: 'whatsapp' | 'email' | 'sms'
  }
  customAttributes?: Record<string, any>
}

export interface CampaignContent {
  template: MessageTemplate
  personalization: PersonalizationRules
  assets: MediaAsset[]
  variables: TemplateVariable[]
}

export interface MessageTemplate {
  id: string
  name: string
  subject?: string
  body: string
  language: string
  contentType: 'text' | 'html' | 'rich'
  variables: string[]
}

export interface PersonalizationRules {
  enabled: boolean
  rules: PersonalizationRule[]
  fallback: string
}

export interface PersonalizationRule {
  type: 'condition' | 'lookup' | 'calculation'
  condition?: string
  lookupField?: string
  calculation?: string
  trueValue: string
  falseValue: string
}

export interface MediaAsset {
  id: string
  type: 'image' | 'video' | 'document' | 'audio'
  url: string
  name: string
  size: number
  mimeType: string
}

export interface TemplateVariable {
  name: string
  type: 'text' | 'number' | 'date' | 'boolean' | 'currency'
  defaultValue: any
  required: boolean
  description: string
}

export interface CampaignSchedule {
  type: 'immediate' | 'scheduled' | 'recurring' | 'triggered'
  startDate?: string
  endDate?: string
  timezone: string
  triggers?: ScheduleTrigger[]
  recurrence?: RecurrenceRule
  sendTimes: SendTime[]
}

export interface ScheduleTrigger {
  type: 'event' | 'time' | 'condition'
  event?: string
  condition?: string
  delayMinutes?: number
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  daysOfWeek?: number[]
  dayOfMonth?: number
  endDate?: string
}

export interface SendTime {
  time: string // HH:MM format
  days: number[] // 0-6 (Sunday-Saturday)
  timezone: string
}

export interface CampaignPerformance {
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  bounced: number
  unsubscribed: number
  revenue: number
  cost: number
  roi: number
  metrics: PerformanceMetric[]
}

export interface PerformanceMetric {
  name: string
  value: number
  change: number
  trend: 'up' | 'down' | 'stable'
  timestamp: string
}

export interface CampaignSettings {
  automationEnabled: boolean
  manualApprovalRequired: boolean
  fallbackToManual: boolean
  rateLimiting: RateLimitSettings
  tracking: TrackingSettings
  compliance: ComplianceSettings
  notifications: NotificationSettings
}

export interface RateLimitSettings {
  enabled: boolean
  maxPerHour: number
  maxPerDay: number
  cooldownMinutes: number
}

export interface TrackingSettings {
  opens: boolean
  clicks: boolean
  conversions: boolean
  revenue: boolean
  customEvents: string[]
}

export interface ComplianceSettings {
  gdprCompliant: boolean
  consentRequired: boolean
  unsubscribeLink: boolean
  ageRestriction: boolean
  dataRetentionDays: number
}

export interface NotificationSettings {
  email: string[]
  slack?: string
  webhook?: string
  events: NotificationEvent[]
}

export interface NotificationEvent {
  type: 'campaign_started' | 'campaign_completed' | 'error' | 'threshold_reached'
  enabled: boolean
  recipients: string[]
}

export interface AutomationWorkflow {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'error'
  triggers: WorkflowTrigger[]
  steps: WorkflowStep[]
  conditions: WorkflowCondition[]
  settings: WorkflowSettings
  performance: WorkflowPerformance
}

export interface WorkflowTrigger {
  id: string
  type: 'webhook' | 'schedule' | 'event' | 'manual'
  config: Record<string, any>
  enabled: boolean
}

export interface WorkflowStep {
  id: string
  type: 'send_message' | 'wait' | 'condition' | 'branch' | 'action' | 'integration'
  name: string
  config: Record<string, any>
  nextSteps?: string[]
  errorHandling?: ErrorHandling
}

export interface WorkflowCondition {
  id: string
  type: 'if' | 'switch' | 'filter'
  conditions: ConditionRule[]
  defaultPath?: string
}

export interface ConditionRule {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in'
  value: any
  nextStep: string
}

export interface WorkflowSettings {
  timeoutMinutes: number
  retryAttempts: number
  errorAction: 'stop' | 'continue' | 'retry'
  logging: boolean
}

export interface WorkflowPerformance {
  executions: number
  successes: number
  failures: number
  averageTime: number
  lastExecution: string
}

export interface ErrorHandling {
  strategy: 'retry' | 'skip' | 'stop' | 'fallback'
  maxRetries: number
  fallbackAction?: string
}

export interface CustomerProfile {
  id: string
  contactInfo: ContactInfo
  demographics: Demographics
  behavior: CustomerBehavior
  preferences: CustomerPreferences
  purchaseHistory: PurchaseHistory
  communicationHistory: CommunicationHistory
  segments: string[]
  tags: string[]
  score: number
  lastActivity: string
  createdAt: string
  updatedAt: string
}

export interface ContactInfo {
  email?: string
  phone?: string
  whatsapp?: string
  address?: Address
}

export interface Address {
  street: string
  city: string
  state: string
  country: string
  postalCode: string
}

export interface Demographics {
  age?: number
  gender?: string
  location?: string
  language?: string
  timezone?: string
  occupation?: string
}

export interface CustomerBehavior {
  firstSeen: string
  lastSeen: string
  totalSessions: number
  totalPageViews: number
  avgSessionDuration: number
  preferredChannels: string[]
  engagementLevel: 'high' | 'medium' | 'low'
  lastInteraction: string
}

export interface CustomerPreferences {
  preferredChannel: 'email' | 'whatsapp' | 'sms'
  communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'never'
  interests: string[]
  productCategories: string[]
  timePreferences: TimePreference[]
}

export interface TimePreference {
  day: number // 0-6
  startTime: string // HH:MM
  endTime: string // HH:MM
  timezone: string
}

export interface PurchaseHistory {
  totalOrders: number
  totalSpent: number
  avgOrderValue: number
  lastPurchase: string
  favoriteCategories: string[]
  purchaseFrequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'occasional'
  lifetimeValue: number
}

export interface CommunicationHistory {
  totalMessages: number
  totalEmails: number
  totalWhatsApp: number
  totalSMS: number
  lastMessage: string
  openRate: number
  clickRate: number
  responseRate: number
  unsubscribeHistory: UnsubscribeEvent[]
}

export interface UnsubscribeEvent {
  channel: string
  reason?: string
  timestamp: string
  campaignId?: string
}

export interface MarketingDashboard {
  overview: OverviewMetrics
  campaigns: CampaignMetrics
  audiences: AudienceMetrics
  automation: AutomationMetrics
  performance: PerformanceMetrics
  alerts: Alert[]
}

export interface OverviewMetrics {
  totalCampaigns: number
  activeCampaigns: number
  totalAudience: number
  engagementRate: number
  conversionRate: number
  revenue: number
  cost: number
  roi: number
}

export interface CampaignMetrics {
  byStatus: Record<string, number>
  byType: Record<string, number>
  performance: CampaignPerformance[]
  recent: Campaign[]
}

export interface AudienceMetrics {
  totalSegments: number
  totalContacts: number
  segmentSizes: Record<string, number>
  growth: GrowthMetric[]
}

export interface AutomationMetrics {
  activeWorkflows: number
  totalExecutions: number
  successRate: number
  averageTime: number
  errors: number
}

export interface PerformanceMetrics {
  period: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  converted: number
  revenue: number
  cost: number
  trends: TrendData[]
}

export interface TrendData {
  date: string
  metric: string
  value: number
  change: number
}

export interface Alert {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
}

export interface GrowthMetric {
  period: string
  value: number
  change: number
  percentage: number
}

// MARKETING AUTOMATION ENGINE INTERFACES
export interface AutomationEngine {
  startCampaign(campaignId: string): Promise<void>
  pauseCampaign(campaignId: string): Promise<void>
  stopCampaign(campaignId: string): Promise<void>
  executeWorkflow(workflowId: string, triggerData?: any): Promise<void>
  processEvent(event: AutomationEvent): Promise<void>
  getMetrics(): Promise<AutomationMetrics>
}

export interface AutomationEvent {
  type: string
  data: Record<string, any>
  timestamp: string
  source: string
}

export interface ManualControl {
  overrideAutomation(campaignId: string, action: ManualAction): Promise<void>
  approveMessage(messageId: string): Promise<void>
  rejectMessage(messageId: string, reason: string): Promise<void>
  pauseWorkflow(workflowId: string): Promise<void>
  resumeWorkflow(workflowId: string): Promise<void>
}

export interface ManualAction {
  type: 'send' | 'pause' | 'stop' | 'modify' | 'approve' | 'reject'
  data?: Record<string, any>
  reason?: string
}

// INTEGRATION INTERFACES
export interface ChannelIntegration {
  type: 'whatsapp' | 'email' | 'sms' | 'webhook'
  send(message: OutboundMessage): Promise<SendResult>
  getStatus(messageId: string): Promise<MessageStatus>
  getWebhooks(): WebhookConfig[]
}

export interface OutboundMessage {
  id: string
  to: string
  from?: string
  subject?: string
  body: string
  attachments?: MediaAsset[]
  metadata: Record<string, any>
  scheduledAt?: string
}

export interface SendResult {
  success: boolean
  messageId: string
  status: MessageStatus
  error?: string
  cost?: number
}

export interface MessageStatus {
  id: string
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  timestamp: string
  metadata?: Record<string, any>
}

export interface WebhookConfig {
  url: string
  events: string[]
  secret?: string
  active: boolean
}
