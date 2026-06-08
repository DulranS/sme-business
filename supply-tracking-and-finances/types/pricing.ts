// ==============================
// PRICING & VALUATION TYPES
// ==============================

export interface MarketComps {
  source: 'kbb' | 'edmunds' | 'autotrader' | 'craigslist' | 'ebay' | 'manual';
  comparableItems: ComparableItem[];
  averagePrice: number;
  priceRange: { min: number; max: number };
  confidence: number;
  lastUpdated: string;
}

export interface ComparableItem {
  id: string;
  title: string;
  price: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  mileage?: number;
  year?: number;
  make?: string;
  model?: string;
  location: string;
  listingDate: string;
  source: string;
  url: string;
}

export interface ValuationRequest {
  itemId: string;
  category: string;
  description: string;
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  currentPrice?: number;
}

export interface ValuationResult {
  itemId: string;
  marketValue: number;
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  profitMargin: number;
  marketComps: MarketComps;
  riskAssessment: 'low' | 'medium' | 'high';
  recommendations: string[];
  confidence: number;
  valuationDate: string;
}

export interface PriceAlert {
  id: string;
  itemId: string;
  alertType: 'below_market' | 'above_market' | 'price_drop' | 'price_spike';
  threshold: number;
  currentValue: number;
  expectedValue: number;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  acknowledged: boolean;
}
