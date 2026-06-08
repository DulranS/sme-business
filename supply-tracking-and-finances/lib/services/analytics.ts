// ==============================
// ANALYTICS SERVICE
// ==============================

import { Order, AnalyticsMetrics, SupplierPerformance, CustomerInsight, InventoryForecast } from '@/types';
import { extractNumericValue, extractMOQNumber, calculateOrderProfit, getDaysSince } from '@/lib/utils/helpers';

class AnalyticsService {
  async getMetrics(orders: Order[]): Promise<AnalyticsMetrics> {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentOrders = orders.filter(o => new Date(o.created_at) >= monthAgo);
    
    const metrics = {
      period: 'last_30_days',
      orders: {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending').length,
        in_progress: orders.filter(o => o.status === 'in-progress').length,
        completed: orders.filter(o => o.status === 'completed').length,
        shipped: orders.filter(o => o.status === 'shipped' || o.status === 'dispatched').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      },
      revenue: {
        total: orders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0),
        pending: orders.filter(o => o.status === 'pending').reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0),
        completed: orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0),
        projected: recentOrders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0) * 1.2,
      },
      performance: {
        avg_order_value: this.calculateAverageOrderValue(orders),
        avg_profit_margin: this.calculateAverageProfitMargin(orders),
        avg_lead_time: this.calculateAverageLeadTime(orders),
        on_time_delivery_rate: this.calculateOnTimeDeliveryRate(orders),
        customer_satisfaction: this.calculateCustomerSatisfaction(orders),
      },
      inventory: {
        total_items: orders.length,
        low_stock: orders.filter(o => o.inventory_status === 'low-stock').length,
        out_of_stock: orders.filter(o => o.inventory_status === 'out-of-stock').length,
        turnover_rate: this.calculateInventoryTurnover(orders),
      },
      suppliers: {
        active: this.getActiveSupplierCount(orders),
        avg_performance: this.calculateAverageSupplierPerformance(orders),
        top_performer: this.getTopPerformer(orders),
      },
    };

    return metrics;
  }

  private calculateAverageOrderValue(orders: Order[]): number {
    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) return 0;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0);
    return totalRevenue / completedOrders.length;
  }

  private calculateAverageProfitMargin(orders: Order[]): number {
    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) return 0;
    let totalMargin = 0;
    completedOrders.forEach(order => {
      const customerPrice = extractNumericValue(order.customer_price);
      const supplierPrice = extractNumericValue(order.supplier_price);
      if (customerPrice > 0) {
        totalMargin += ((customerPrice - supplierPrice) / customerPrice) * 100;
      }
    });
    return totalMargin / completedOrders.length;
  }

  private calculateAverageLeadTime(orders: Order[]): number {
    const ordersWithLeadTime = orders.filter(o => o.supplier_lead_time_days);
    if (ordersWithLeadTime.length === 0) return 0;
    const totalLeadTime = ordersWithLeadTime.reduce((sum, o) => sum + (o.supplier_lead_time_days || 0), 0);
    return totalLeadTime / ordersWithLeadTime.length;
  }

  private calculateOnTimeDeliveryRate(orders: Order[]): number {
    const deliveredOrders = orders.filter(o => o.estimated_delivery && o.actual_delivery);
    if (deliveredOrders.length === 0) return 0;
    const onTimeCount = deliveredOrders.filter(o => 
      new Date(o.actual_delivery!) <= new Date(o.estimated_delivery!)
    ).length;
    return (onTimeCount / deliveredOrders.length) * 100;
  }

  private calculateCustomerSatisfaction(orders: Order[]): number {
    // Simplified calculation based on completion rate and refund rate
    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) return 0;
    const refundCount = completedOrders.filter(o => o.refund_status && o.refund_status !== 'none').length;
    const baseScore = 100;
    const penalty = (refundCount / completedOrders.length) * 20;
    return Math.max(0, baseScore - penalty);
  }

  private calculateInventoryTurnover(orders: Order[]): number {
    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length === 0) return 0;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0);
    const totalCost = completedOrders.reduce((sum, o) => sum + extractNumericValue(o.supplier_price), 0);
    return totalCost > 0 ? totalRevenue / totalCost : 0;
  }

  private getActiveSupplierCount(orders: Order[]): number {
    const suppliers = new Set(orders.filter(o => o.supplier_name).map(o => o.supplier_name));
    return suppliers.size;
  }

  private calculateAverageSupplierPerformance(orders: Order[]): number {
    const supplierStats = new Map<string, { orders: number; onTime: number; total: number }>();
    
    orders.forEach(order => {
      if (!order.supplier_name) return;
      const stats = supplierStats.get(order.supplier_name) || { orders: 0, onTime: 0, total: 0 };
      stats.orders++;
      stats.total += extractNumericValue(order.customer_price);
      if (order.estimated_delivery && order.actual_delivery) {
        if (new Date(order.actual_delivery) <= new Date(order.estimated_delivery)) {
          stats.onTime++;
        }
      }
      supplierStats.set(order.supplier_name, stats);
    });

    if (supplierStats.size === 0) return 0;
    
    let totalPerformance = 0;
    supplierStats.forEach(stats => {
      const onTimeRate = stats.orders > 0 ? (stats.onTime / stats.orders) * 100 : 0;
      totalPerformance += onTimeRate;
    });
    
    return totalPerformance / supplierStats.size;
  }

  private getTopPerformer(orders: Order[]): string {
    const supplierStats = new Map<string, { score: number; orders: number }>();
    
    orders.forEach(order => {
      if (!order.supplier_name) return;
      const stats = supplierStats.get(order.supplier_name) || { score: 0, orders: 0 };
      stats.orders++;
      if (order.estimated_delivery && order.actual_delivery) {
        if (new Date(order.actual_delivery) <= new Date(order.estimated_delivery)) {
          stats.score += 10;
        }
      }
      if (order.status === 'completed') {
        stats.score += 5;
      }
      supplierStats.set(order.supplier_name, stats);
    });

    let topSupplier = 'N/A';
    let highestScore = 0;
    
    supplierStats.forEach((stats, supplier) => {
      if (stats.score > highestScore && stats.orders >= 3) {
        highestScore = stats.score;
        topSupplier = supplier;
      }
    });
    
    return topSupplier;
  }

  async getSupplierPerformance(orders: Order[]): Promise<SupplierPerformance[]> {
    const supplierMap = new Map<string, SupplierPerformance>();
    
    orders.forEach(order => {
      if (!order.supplier_name) return;
      
      const existing = supplierMap.get(order.supplier_name);
      const totalValue = extractNumericValue(order.customer_price);
      const profit = calculateOrderProfit(order);
      const margin = totalValue > 0 ? (profit / totalValue) * 100 : 0;
      
      const isOnTime = order.estimated_delivery && order.actual_delivery 
        ? new Date(order.actual_delivery) <= new Date(order.estimated_delivery)
        : false;
      
      if (existing) {
        existing.totalOrders++;
        existing.totalValue += totalValue;
        existing.avgMargin = (existing.avgMargin * (existing.totalOrders - 1) + margin) / existing.totalOrders;
        if (isOnTime) {
          existing.onTimeDeliveryRate = (existing.onTimeDeliveryRate * (existing.totalOrders - 1) + 100) / existing.totalOrders;
        }
        if (order.supplier_lead_time_days) {
          existing.avgLeadTime = (existing.avgLeadTime * (existing.totalOrders - 1) + order.supplier_lead_time_days) / existing.totalOrders;
        }
        if (new Date(order.created_at) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = order.created_at;
        }
        existing.qualityScore = existing.onTimeDeliveryRate * 0.6 + existing.avgMargin * 0.4;
      } else {
        supplierMap.set(order.supplier_name, {
          supplierName: order.supplier_name,
          totalOrders: 1,
          onTimeDeliveryRate: isOnTime ? 100 : 0,
          avgLeadTime: order.supplier_lead_time_days || 0,
          totalValue,
          avgMargin: margin,
          qualityScore: (isOnTime ? 100 : 0) * 0.6 + margin * 0.4,
          lastOrderDate: order.created_at,
        });
      }
    });
    
    return Array.from(supplierMap.values()).sort((a, b) => b.qualityScore - a.qualityScore);
  }

  async getCustomerInsights(orders: Order[]): Promise<CustomerInsight[]> {
    const customerMap = new Map<string, CustomerInsight>();
    
    orders.forEach(order => {
      const existing = customerMap.get(order.customer_name);
      const totalValue = extractNumericValue(order.customer_price);
      const categories = order.category ? [order.category] : [];
      
      if (existing) {
        existing.totalOrders++;
        existing.totalValue += totalValue;
        existing.avgOrderValue = existing.totalValue / existing.totalOrders;
        if (new Date(order.created_at) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = order.created_at;
        }
        if (order.category && !existing.preferredCategories.includes(order.category)) {
          existing.preferredCategories.push(order.category);
        }
      } else {
        customerMap.set(order.customer_name, {
          customerName: order.customer_name,
          totalOrders: 1,
          totalValue,
          avgOrderValue: totalValue,
          lastOrderDate: order.created_at,
          isRecurring: order.is_recurring || false,
          preferredCategories: categories,
          urgencyPreference: order.urgency,
        });
      }
    });
    
    return Array.from(customerMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }

  async getInventoryForecasts(orders: Order[]): Promise<InventoryForecast[]> {
    const forecasts: InventoryForecast[] = [];
    
    orders.forEach(order => {
      if (!order.moq || !order.description) return;
      
      let avgMonthlyUsage = 0;
      if (order.is_recurring && !order.recurring_template_id) {
        const qty = extractMOQNumber(order.moq) || 1;
        if (order.recurring_interval === 'weekly') avgMonthlyUsage = qty * 4;
        else if (order.recurring_interval === 'monthly') avgMonthlyUsage = qty;
        else if (order.recurring_interval === 'quarterly') avgMonthlyUsage = qty / 3;
      } else {
        avgMonthlyUsage = extractMOQNumber(order.moq) / 6 || 0;
      }
      
      const leadTimeDays = order.supplier_lead_time_days || 7;
      const safety_stock_factor = 1.5;
      const currentStockLevel = order.current_stock_level || 0;
      const reorderPoint = avgMonthlyUsage * (leadTimeDays / 30) * safety_stock_factor;
      
      const today = new Date();
      const nextReorderDate = new Date();
      nextReorderDate.setDate(today.getDate() + leadTimeDays);
      
      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (currentStockLevel <= 0) status = 'critical';
      else if (currentStockLevel < reorderPoint) status = 'warning';
      
      forecasts.push({
        orderId: order.id,
        itemDescription: order.description,
        category: order.category || 'Uncategorized',
        avgMonthlyUsage,
        currentStockLevel,
        reorderPoint,
        leadTimeDays,
        nextReorderDate: nextReorderDate.toISOString().split('T')[0],
        supplierSuggestion: order.supplier_name || 'TBD',
        status,
      });
    });
    
    return forecasts.filter(f => f.status !== 'ok');
  }

  async getRevenueTrend(orders: Order[], months: number = 6): Promise<Array<{ month: string; revenue: number }>> {
    const trend: Array<{ month: string; revenue: number }> = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });
      
      const revenue = monthOrders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0);
      
      trend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue,
      });
    }
    
    return trend;
  }
}

export const analyticsService = new AnalyticsService();
export default AnalyticsService;
