import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Users, TrendingUp, DollarSign, Calendar, Repeat, Download } from 'lucide-react';
import { Order, CustomerInsight as CustomerInsightType } from '@/types';
import { analyticsService } from '@/lib/services/analytics';
import { orderService } from '@/lib/services/orders';
import { formatCurrency } from '@/lib/utils/helpers';

export const CustomerInsightsDashboard: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerInsightType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const orders = await orderService.getAllOrders();
      const insights = await analyticsService.getCustomerInsights(orders);
      setCustomers(insights);
    } catch (error) {
      console.error('Error loading customer insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const recurringCustomers = customers.filter(c => c.isRecurring).length;
  const totalCustomerValue = customers.reduce((sum, c) => sum + c.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Insights</h2>
          <p className="text-gray-600 mt-1">Analyze customer behavior and preferences</p>
        </div>
        <Button variant="secondary" icon={<Download className="w-4 h-4" />}>
          Export Report
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recurring Customers</p>
                <p className="text-2xl font-bold text-gray-900">{recurringCustomers}</p>
              </div>
              <Repeat className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customer Value</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalCustomerValue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Customer Rankings by Value</h3>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No customer data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer, index) => (
                <div
                  key={customer.customerName}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{customer.customerName}</h4>
                        <p className="text-sm text-gray-600">{customer.totalOrders} orders</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {customer.isRecurring && (
                        <Badge variant="success">
                          Recurring
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Value</p>
                      <p className="font-medium">{formatCurrency(customer.totalValue)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avg Order Value</p>
                      <p className="font-medium">{formatCurrency(customer.avgOrderValue)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Last Order</p>
                      <p className="font-medium">{new Date(customer.lastOrderDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Urgency Preference</p>
                      <Badge 
                        variant={customer.urgencyPreference === 'high' ? 'danger' : customer.urgencyPreference === 'medium' ? 'warning' : 'default'}
                        size="sm"
                      >
                        {customer.urgencyPreference}
                      </Badge>
                    </div>
                  </div>
                  {customer.preferredCategories.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-600 mb-2">Preferred Categories:</p>
                      <div className="flex flex-wrap gap-2">
                        {customer.preferredCategories.map((cat, idx) => (
                          <Badge key={idx} variant="info" size="sm">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
