// Centralized type definitions for bookkeeping app

export const RecordTypes = {
  INFLOW: 'Inflow',
  OUTFLOW: 'Outflow',
  REINVESTMENT: 'Reinvestment',
  OVERHEAD: 'Overhead',
  LOAN_PAYMENT: 'Loan Payment',
  LOAN_RECEIVED: 'Loan Received',
  INVENTORY_PURCHASE: 'Inventory Purchase',
  LOGISTICS: 'Logistics',
  REFUND: 'Refund',
  CASH_FLOW_GAP: 'Cash Flow Gap',
  ON_HOLD_CASH: 'On Hold Cash',
};

export const AttributionSources = {
  DIRECT: 'direct',
  REFERRAL: 'referral',
  WEBSITE: 'website',
  SOCIAL_MEDIA: 'social_media',
  EMAIL_CAMPAIGN: 'email_campaign',
  PAID_AD: 'paid_ad',
  WORD_OF_MOUTH: 'word_of_mouth',
  PARTNER: 'partner',
  COLD_OUTREACH: 'cold_outreach',
  REPEAT_CUSTOMER: 'repeat_customer',
};

export const ConversionStages = {
  LEAD: 'lead',
  QUALIFIED: 'qualified',
  PROPOSAL: 'proposal',
  NEGOTIATION: 'negotiation',
  CLOSED_WON: 'closed_won',
  CLOSED_LOST: 'closed_lost',
};

export const PriorityLevels = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};
