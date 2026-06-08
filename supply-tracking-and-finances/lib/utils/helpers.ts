// ==============================
// UTILITY FUNCTIONS
// ==============================

import { Order, OrderImage, FinancialSummary } from '@/types';

export const parseImages = (imagesJson: string): OrderImage[] => {
  try {
    return JSON.parse(imagesJson || '[]');
  } catch {
    console.warn('Failed to parse images JSON:', imagesJson);
    return [];
  }
};

export const extractNumericValue = (priceString: any): number => {
  if (priceString == null) return 0;
  if (typeof priceString === 'number') {
    return isNaN(priceString) ? 0 : priceString;
  }
  if (typeof priceString === 'string') {
    const cleaned = priceString.trim();
    if (!cleaned) return 0;
    const match = cleaned.match(/[\d,]+\.?\d*/);
    return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
  }
  return 0;
};

export const extractMOQNumber = (moq: string): number => {
  const cleaned = moq.replace(/,/g, '');
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const calculateOrderProfit = (order: Order): number => {
  const cust = extractNumericValue(order.customer_price);
  const supp = extractNumericValue(order.supplier_price);
  const delivery = extractNumericValue(order.supplier_delivery_fee);
  const logistics = extractNumericValue(order.logistics_cost);
  return cust - supp - delivery - logistics;
};

export const parseCategories = (categoryString?: string): string[] => {
  if (!categoryString) return [];
  return categoryString
    .split(',')
    .map((cat) => cat.trim())
    .filter(Boolean);
};

export const getDaysSince = (dateString: string): number => {
  const created = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - created.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const calculateFinancials = (orders: Order[]): FinancialSummary => {
  let totalRevenue = 0;
  let totalCost = 0;
  let completedOrders = 0;
  let pendingValue = 0;
  let inProgressValue = 0;
  let shippedValue = 0;
  let cashInflow = 0;
  let cashOutflow = 0;
  let lowMarginOrders = 0;
  let totalLogisticsCost = 0;
  let onTimeDeliveries = 0;
  let totalDeliveries = 0;
  let totalLeadTime = 0;
  let supplierCount = 0;
  let refunds = 0;
  let recurringClients = 0;

  orders.forEach((order) => {
    const customerPrice = extractNumericValue(order.customer_price);
    const supplierPrice = extractNumericValue(order.supplier_price);
    const logisticsCost = extractNumericValue(order.logistics_cost);
    const margin = customerPrice > 0 ? (customerPrice - supplierPrice) / customerPrice : 0;

    if (order.is_recurring && !order.recurring_template_id) {
      recurringClients++;
    }

    if (order.status === 'completed') {
      totalRevenue += customerPrice;
      totalCost += supplierPrice;
      completedOrders++;
      cashInflow += customerPrice;
      cashOutflow += supplierPrice + logisticsCost;
      totalLogisticsCost += logisticsCost;
      if (margin < 0.2) lowMarginOrders++;
      if (order.estimated_delivery && order.actual_delivery) {
        totalDeliveries++;
        if (new Date(order.actual_delivery) <= new Date(order.estimated_delivery)) {
          onTimeDeliveries++;
        }
      }
      if (order.supplier_lead_time_days) {
        totalLeadTime += order.supplier_lead_time_days;
        supplierCount++;
      }
      if (order.refund_status && order.refund_status !== 'none') {
        refunds++;
      }
    } else if (order.status === 'ship' || order.status === 'shipped') {
      totalCost += supplierPrice + logisticsCost;
      cashOutflow += supplierPrice + logisticsCost;
      totalLogisticsCost += logisticsCost;
      shippedValue += customerPrice;
    } else if (order.status === 'pending') {
      pendingValue += customerPrice;
    } else if (order.status === 'in-progress') {
      inProgressValue += customerPrice;
    }
  });

  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const cogs = totalCost;
  const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const netCashFlow = cashInflow - cashOutflow;
  const reinvestmentPool = totalProfit > 0 ? totalProfit * 0.3 : 0;
  const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
  const averageProfit = completedOrders > 0 ? totalProfit / completedOrders : 0;
  const projectedCashFlow30Days = cashInflow + inProgressValue * 0.5 - shippedValue * 0.3;
  const onTimeDeliveryRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;
  const avgSupplierLeadTime = supplierCount > 0 ? totalLeadTime / supplierCount : 0;
  const refundRate = completedOrders > 0 ? (refunds / completedOrders) * 100 : 0;
  const inventoryTurnover = completedOrders > 0 ? totalRevenue / (totalCost || 1) : 0;

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    completedOrders,
    pendingValue,
    inProgressValue,
    shippedValue,
    cashInflow,
    cashOutflow,
    netCashFlow,
    reinvestmentPool,
    averageOrderValue,
    averageProfit,
    grossMargin,
    cogs,
    roi,
    projectedCashFlow30Days,
    lowMarginOrders,
    totalLogisticsCost,
    onTimeDeliveryRate,
    inventoryTurnover,
    avgSupplierLeadTime,
    refundRate,
    recurringClients,
  };
};

export const getStatusColor = (status: Order['status']): string => {
  const colors: Record<Order['status'], string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-red-100 text-red-800 border-red-300',
    ship: 'bg-blue-100 text-blue-800 border-blue-300',
    shipped: 'bg-purple-100 text-purple-800 border-purple-300',
    dispatched: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
};

export const getUrgencyColor = (urgency: Order['urgency']): string => {
  const colors: Record<Order['urgency'], string> = {
    low: 'text-green-600 bg-green-50',
    medium: 'text-yellow-600 bg-yellow-50',
    high: 'text-red-600 bg-red-50',
  };
  return colors[urgency] || 'text-gray-600 bg-gray-50';
};

export const getInventoryColor = (inv: Order['inventory_status']): string => {
  const map: Record<string, string> = {
    'in-stock': 'bg-green-100 text-green-800',
    'low-stock': 'bg-yellow-100 text-yellow-800',
    'out-of-stock': 'bg-red-100 text-red-800',
    'reorder-needed': 'bg-orange-100 text-orange-800',
  };
  return map[inv || ''] || 'bg-gray-100 text-gray-800';
};

export const isInventoryCritical = (inv: Order['inventory_status']): boolean => {
  return inv === 'low-stock' || inv === 'out-of-stock' || inv === 'reorder-needed';
};

export const inferRecurringSupplyLikelihood = (categoryString?: string): 'High' | 'Medium' | 'Low' => {
  if (!categoryString) return 'Low';
  
  const HIGH_RECURRING_CATEGORIES = new Set([
    'marketing', 'advertising', 'digital agency', 'software', 'it services',
    'consulting', 'real estate agency', 'architecture', 'engineering',
    'cloud services', 'saas', 'web development', 'design agency', 'technology'
  ]);
  
  const MEDIUM_RECURRING_CATEGORIES = new Set([
    'legal', 'law firm', 'accounting', 'finance', 'insurance',
    'hr services', 'recruitment', 'logistics', 'education', 'business services'
  ]);
  
  const categories = parseCategories(categoryString).map(cat => cat.toLowerCase());
  
  for (const cat of categories) {
    if (HIGH_RECURRING_CATEGORIES.has(cat)) return 'High';
    if ([...HIGH_RECURRING_CATEGORIES].some(kw => cat.includes(kw))) return 'High';
  }
  
  for (const cat of categories) {
    if (MEDIUM_RECURRING_CATEGORIES.has(cat)) return 'Medium';
    if ([...MEDIUM_RECURRING_CATEGORIES].some(kw => cat.includes(kw))) return 'Medium';
  }
  
  return 'Low';
};
