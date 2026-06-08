import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Users, 
  AlertTriangle,
  BarChart3,
  Calendar,
  Download,
  RefreshCw,
  Truck,
  Warehouse,
  Clock,
  CheckCircle,
  XCircle,
  Loader
} from 'lucide-react';
import { Order, AnalyticsMetrics } from '@/types';
import { analyticsService } from '@/lib/services/analytics';
import { orderService } from '@/lib/services/orders';
import { formatCurrency, extractNumericValue } from '@/lib/utils/helpers';

export const AnalyticsDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const allOrders = await orderService.getAllOrders();
      setOrders(allOrders);
      const analyticsMetrics = await analyticsService.getMetrics(allOrders);
      setMetrics(analyticsMetrics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Unable to load analytics data</p>
      </div>
    );
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const highUrgencyCount = orders.filter(o => o.urgency === 'high').length;
  const lowStockCount = orders.filter(o => o.inventory_status === 'low-stock' || o.inventory_status === 'out-of-stock').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time business intelligence and performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
            onClick={loadData}
            disabled={refreshing}
          >
            Refresh
          </Button>
          <Button variant="primary" icon={<Download className="w-4 h-4" />}>
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics.revenue.total)}
          icon={DollarSign}
          trend={{ value: 12, isPositive: true }}
        />
        <MetricCard
          title="Total Orders"
          value={metrics.orders.total}
          icon={Package}
          trend={{ value: 8, isPositive: true }}
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(metrics.performance.avg_order_value)}
          icon={TrendingUp}
          trend={{ value: 5, isPositive: true }}
        />
        <MetricCard
          title="Profit Margin"
          value={`${metrics.performance.avg_profit_margin.toFixed(1)}%`}
          icon={BarChart3}
          trend={{ value: 3, isPositive: true }}
        />
      </div>

      {/* Alerts and Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority Orders</p>
                <p className="text-2xl font-bold text-red-600">{highUrgencyCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
                <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
              </div>
              <Warehouse className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order Status Breakdown */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Order Status Breakdown</h3>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Package className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">{metrics.orders.total}</p>
              <p className="text-sm text-gray-600">Total</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-yellow-700">{metrics.orders.pending}</p>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Loader className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-700">{metrics.orders.in_progress}</p>
              <p className="text-sm text-blue-600">In Progress</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">{metrics.orders.completed}</p>
              <p className="text-sm text-green-600">Completed</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Truck className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-700">{metrics.orders.shipped}</p>
              <p className="text-sm text-purple-600">Shipped</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700">{metrics.orders.cancelled}</p>
              <p className="text-sm text-red-600">Cancelled</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">On-Time Delivery Rate</span>
                <Badge variant={metrics.performance.on_time_delivery_rate >= 90 ? 'success' : 'warning'}>
                  {metrics.performance.on_time_delivery_rate.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Lead Time</span>
                <span className="font-medium">{metrics.performance.avg_lead_time.toFixed(1)} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Customer Satisfaction</span>
                <Badge variant={metrics.performance.customer_satisfaction >= 80 ? 'success' : 'warning'}>
                  {metrics.performance.customer_satisfaction.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Inventory Turnover</span>
                <span className="font-medium">{metrics.inventory.turnover_rate.toFixed(2)}x</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Supplier Performance</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Suppliers</span>
                <span className="font-medium">{metrics.suppliers.active}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Performance</span>
                <Badge variant={metrics.suppliers.avg_performance >= 80 ? 'success' : 'warning'}>
                  {metrics.suppliers.avg_performance.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Top Performer</span>
                <span className="font-medium text-blue-600">{metrics.suppliers.top_performer}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Low Stock Items</span>
                <Badge variant={metrics.inventory.low_stock > 0 ? 'warning' : 'success'}>
                  {metrics.inventory.low_stock}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Overview</h3>
            <Badge variant="info">{metrics.period}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(metrics.revenue.total)}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Pending Revenue</p>
              <p className="text-xl font-bold text-yellow-700">{formatCurrency(metrics.revenue.pending)}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Completed Revenue</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrency(metrics.revenue.completed)}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Projected Revenue</p>
              <p className="text-xl font-bold text-purple-700">{formatCurrency(metrics.revenue.projected)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
