// Database types matching Supabase schema
export interface InventoryItem {
  id?: number
  name: string
  sku: string
  quantity: number
  price: number
  currency: string
  price_usd: number
  created_at?: string
  updated_at?: string
}

export interface Conversation {
  id?: number
  phone_number: string
  customer_name: string
  history: string
  created_at?: string
  updated_at?: string
}

// Currency configuration
export interface Currency {
  code: string
  symbol: string
  name: string
}

export const CURRENCIES: Record<string, Currency> = {
  // Major Global Currencies
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  
  // Americas
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
  ARS: { code: 'ARS', symbol: '$', name: 'Argentine Peso' },
  CLP: { code: 'CLP', symbol: '$', name: 'Chilean Peso' },
  COP: { code: 'COP', symbol: '$', name: 'Colombian Peso' },
  PEN: { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  UYU: { code: 'UYU', symbol: '$', name: 'Uruguayan Peso' },
  
  // Europe
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  CZK: { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
  HUF: { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
  RON: { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
  BGN: { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev' },
  HRK: { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna' },
  RUB: { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  
  // Asia & Middle East
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  TWD: { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar' },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  PHP: { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  SAR: { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  QAR: { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
  KWD: { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  BHD: { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar' },
  OMR: { code: 'OMR', symbol: 'RO', name: 'Omani Rial' },
  ILS: { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel' },
  JOD: { code: 'JOD', symbol: 'JD', name: 'Jordanian Dinar' },
  LBP: { code: 'LBP', symbol: 'ل.ل', name: 'Lebanese Pound' },
  
  // Africa
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  UGX: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  TZS: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  MAD: { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  DZD: { code: 'DZD', symbol: 'DA', name: 'Algerian Dinar' },
  TND: { code: 'TND', symbol: 'DT', name: 'Tunisian Dinar' },
  
  // Oceania
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  FJD: { code: 'FJD', symbol: 'FJ$', name: 'Fijian Dollar' },
  PGK: { code: 'PGK', symbol: 'K', name: 'Papua New Guinea Kina' },
  SBD: { code: 'SBD', symbol: 'SI$', name: 'Solomon Islands Dollar' },
  VUV: { code: 'VUV', symbol: 'VT', name: 'Vanuatu Vatu' },
  WST: { code: 'WST', symbol: 'WS$', name: 'Samoan Tala' },
  TOP: { code: 'TOP', symbol: 'T$', name: 'Tongan Paʻanga' },
  
  // Caribbean & Central America
  JMD: { code: 'JMD', symbol: 'J$', name: 'Jamaican Dollar' },
  TTD: { code: 'TTD', symbol: 'TT$', name: 'Trinidad & Tobago Dollar' },
  BBD: { code: 'BBD', symbol: 'Bds$', name: 'Barbados Dollar' },
  BSD: { code: 'BSD', symbol: 'B$', name: 'Bahamian Dollar' },
  BZD: { code: 'BZD', symbol: 'BZ$', name: 'Belize Dollar' },
  GTQ: { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal' },
  HNL: { code: 'HNL', symbol: 'L', name: 'Honduran Lempira' },
  NIO: { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Córdoba' },
  CRC: { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón' },
  XCD: { code: 'XCD', symbol: 'EC$', name: 'Eastern Caribbean Dollar' },
  
  // Other Major Currencies
  NIS: { code: 'NIS', symbol: '₪', name: 'New Israeli Shekel' },
  LKR: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  PKR: { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  NPR: { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee' },
  AFN: { code: 'AFN', symbol: '؋', name: 'Afghan Afghani' },
  MMK: { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat' },
  LAK: { code: 'LAK', symbol: '₭', name: 'Lao Kip' },
  KHR: { code: 'KHR', symbol: '៛', name: 'Cambodian Riel' },
  MVR: { code: 'MVR', symbol: 'Rf', name: 'Maldivian Rufiyaa' },
  BTN: { code: 'BTN', symbol: 'Nu.', name: 'Bhutanese Ngultrum' },
  GEL: { code: 'GEL', symbol: '₾', name: 'Georgian Lari' },
  AMD: { code: 'AMD', symbol: '֏', name: 'Armenian Dram' },
  AZN: { code: 'AZN', symbol: '₼', name: 'Azerbaijani Manat' },
  KZT: { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
  KGS: { code: 'KGS', symbol: 'с', name: 'Kyrgyzstani Som' },
  UZS: { code: 'UZS', symbol: 'сўм', name: 'Uzbekistan Som' },
  TJS: { code: 'TJS', symbol: 'SM', name: 'Tajikistani Somoni' },
  TMT: { code: 'TMT', symbol: 'm', name: 'Turkmenistani Manat' },
  MNT: { code: 'MNT', symbol: '₮', name: 'Mongolian Tögrög' },
  KPW: { code: 'KPW', symbol: '₩', name: 'North Korean Won' },
  
  // Cryptocurrencies (for future expansion)
  BTC: { code: 'BTC', symbol: '₿', name: 'Bitcoin' },
  ETH: { code: 'ETH', symbol: 'Ξ', name: 'Ethereum' },
  USDT: { code: 'USDT', symbol: '₮', name: 'Tether' },
}

// WhatsApp API types
export interface WhatsAppMessage {
  id: string
  from: string
  text: {
    body: string
  }
  timestamp: string
  type: string
}

export interface WhatsAppContact {
  profile: {
    name: string
  }
  wa_id: string
}

export interface WhatsAppWebhookEntry {
  id: string
  changes: Array<{
    field: string
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      messages?: WhatsAppMessage[]
      contacts?: WhatsAppContact[]
    }
  }>
}

export interface WhatsAppWebhookPayload {
  object: string
  entry: WhatsAppWebhookEntry[]
}

// AI/LLM types
export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeResponse {
  content: Array<{
    type: string
    text: string
  }>
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Conversation parsing
export interface ParsedMessage {
  role: 'customer' | 'assistant'
  text: string
}

// Analytics types
export interface AnalyticsMetrics {
  revenue: number
  revenueChange: number
  orders: number
  ordersChange: number
  averageOrderValue: number
  aovChange: number
  conversionRate: number
  conversionChange: number
}

// Bulk Operations types
export interface ImportResult {
  success: boolean
  total: number
  processed: number
  errors: number
  duration?: string
  errorDetails?: string[]
}

export interface ExportResult {
  success: boolean
  total: number
  filename: string
  downloadUrl?: string
  duration?: string
}

// Forecasting types
export interface ForecastData {
  id: string
  productName: string
  predictedDemand: number
  predictedRevenue: number
  confidence: number
  timeRange: string
}

export interface InventoryOptimization {
  id: string
  productName: string
  currentStock: number
  recommendedOrder: number
  priority: 'high' | 'medium' | 'low'
  status: 'order-now' | 'monitor' | 'overstocked'
  recommendations: string[]
}

export interface CustomerSegment {
  id: string
  name: string
  size: number
  growthRate: number
  retentionRate: number
  averageOrderValue: number
}

// Reporting types
export interface ReportTemplate {
  id: string
  name: string
  description: string
  category: string
  format: 'pdf' | 'excel' | 'csv'
  estimatedTime: string
}

export interface Report {
  id: string
  name: string
  templateId: string
  format: string
  size: string
  createdAt: string
  status: 'generating' | 'completed' | 'failed'
  downloadUrl?: string
}
