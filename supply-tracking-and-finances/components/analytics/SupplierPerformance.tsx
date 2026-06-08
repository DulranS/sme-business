import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TrendingUp, Award, Clock, DollarSign, Star, Download } from 'lucide-react';
import { Order, SupplierPerformance as SupplierPerformanceType } from '@/types';
import { analyticsService } from '@/lib/services/analytics';
import { orderService } from '@/lib/services/orders';
import { formatCurrency } from '@/lib/utils/helpers';

export const SupplierPerformanceDashboard: React.FC = () => {
  const [suppliers, setSuppliers] = useState<SupplierPerformanceType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const orders = await orderService.getAllOrders();
      const performance = await analyticsService.getSupplierPerformance(orders);
      setSuppliers(performance);
    } catch (error) {
      console.error('Error loading supplier performance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getPerformanceColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Supplier Performance</h2>
          <p className="text-gray-600 mt-1">Track and analyze supplier performance metrics</p>
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
                <p className="text-sm text-gray-600">Total Suppliers</p>
                <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
              </div>
              <Award className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Performance Score</p>
                <p className="text-2xl font-bold text-gray-900">
                  {suppliers.length > 0 
                    ? (suppliers.reduce((sum, s) => sum + s.qualityScore, 0) / suppliers.length).toFixed(1)
                    : 0}
                </p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(suppliers.reduce((sum, s) => sum + s.totalValue, 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier List */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900">Supplier Rankings</h3>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No supplier data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suppliers.map((supplier, index) => (
                <div
                  key={supplier.supplierName}
                  className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{supplier.supplierName}</h4>
                        <p className="text-sm text-gray-600">{supplier.totalOrders} orders</p>
                      </div>
                    </div>
                    <Badge className={getPerformanceColor(supplier.qualityScore)}>
                      {supplier.qualityScore.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">On-Time Delivery</p>
                      <p className="font-medium">{supplier.onTimeDeliveryRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avg Lead Time</p>
                      <p className="font-medium">{supplier.avgLeadTime.toFixed(1)} days</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avg Margin</p>
                      <p className="font-medium">{supplier.avgMargin.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Total Value</p>
                      <p className="font-medium">{formatCurrency(supplier.totalValue)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
