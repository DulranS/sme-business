// ==============================
// CENTRALIZED TYPE DEFINITIONS
// ==============================

export * from './pricing';
export * from './logistics';
export * from './reconditioning';

export interface OrderImage {
  name: string;
  url: string;
}

export interface SupplierBid {
  supplier_name: string;
  price: string;
  notes?: string;
  submitted_at: string;
  lead_time_days?: number;
}

export interface Order {
  id: number;
  customer_name: string;
  email?: string;
  phone: string;
  location: string;
  description: string;
  moq: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'ship' | 'shipped' | 'dispatched';
  images: string;
  created_at: string;
  supplier_name?: string;
  supplier_price?: string;
  supplier_description?: string;
  supplier_delivery_fee?: string;
  customer_price?: string;
  category?: string;
  last_contacted?: string;
  inventory_status?: 'in-stock' | 'low-stock' | 'out-of-stock' | 'reorder-needed';
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  refund_status?: 'none' | 'requested' | 'approved' | 'processed';
  logistics_cost?: string;
  supplier_lead_time_days?: number;
  current_stock_level?: number;
  route_optimized?: boolean;
  bids?: string;
  is_recurring?: boolean;
  recurring_interval?: 'weekly' | 'monthly' | 'quarterly';
  next_occurrence?: string;
  recurring_template_id?: number;
  shipped_quantity?: number;
  shipped_at?: string;
}

export interface OrderFormData {
  customer_name: string;
  email: string;
  phone: string;
  location: string;
  description: string;
  moq: string;
  urgency: 'low' | 'medium' | 'high';
  images: OrderImage[];
  category: string;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  completedOrders: number;
  pendingValue: number;
  inProgressValue: number;
  shippedValue: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  reinvestmentPool: number;
  averageOrderValue: number;
  averageProfit: number;
  grossMargin: number;
  cogs: number;
  roi: number;
  projectedCashFlow30Days: number;
  lowMarginOrders: number;
  totalLogisticsCost: number;
  onTimeDeliveryRate: number;
  inventoryTurnover: number;
  avgSupplierLeadTime: number;
  refundRate: number;
  recurringClients: number;
}

export interface InventoryForecast {
  orderId: number;
  itemDescription: string;
  category: string;
  avgMonthlyUsage: number;
  currentStockLevel: number;
  reorderPoint: number;
  leadTimeDays: number;
  nextReorderDate: string;
  supplierSuggestion: string;
  status: 'ok' | 'warning' | 'critical';
}

export interface SupplierPerformance {
  supplierName: string;
  totalOrders: number;
  onTimeDeliveryRate: number;
  avgLeadTime: number;
  totalValue: number;
  avgMargin: number;
  qualityScore: number;
  lastOrderDate: string;
}

export interface CustomerInsight {
  customerName: string;
  totalOrders: number;
  totalValue: number;
  avgOrderValue: number;
  lastOrderDate: string;
  isRecurring: boolean;
  preferredCategories: string[];
  urgencyPreference: 'low' | 'medium' | 'high';
}

export interface AnalyticsMetrics {
  period: string;
  orders: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
    shipped: number;
    cancelled: number;
  };
  revenue: {
    total: number;
    pending: number;
    completed: number;
    projected: number;
  };
  performance: {
    avg_order_value: number;
    avg_profit_margin: number;
    avg_lead_time: number;
    on_time_delivery_rate: number;
    customer_satisfaction: number;
  };
  inventory: {
    total_items: number;
    low_stock: number;
    out_of_stock: number;
    turnover_rate: number;
  };
  suppliers: {
    active: number;
    avg_performance: number;
    top_performer: string;
  };
}

export interface ReportConfig {
  type: 'financial' | 'inventory' | 'supplier' | 'customer' | 'performance';
  period: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
  format: 'pdf' | 'csv' | 'excel';
  includeCharts: boolean;
}

export interface NotificationSettings {
  email: boolean;
  discord: boolean;
  sms: boolean;
  order_updates: boolean;
  inventory_alerts: boolean;
  financial_reports: boolean;
  supplier_updates: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'alert';
  title: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  config: Record<string, any>;
}
