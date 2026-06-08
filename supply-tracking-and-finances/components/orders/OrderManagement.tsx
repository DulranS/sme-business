import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { 
  Search, 
  Filter, 
  Plus, 
  Download, 
  RefreshCw,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  MapPin,
  Phone,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Loader,
  Package,
  TrendingUp
} from 'lucide-react';
import { Order } from '@/types';
import { orderService } from '@/lib/services/orders';
import { getStatusColor, getUrgencyColor, getDaysSince, isInventoryCritical, inferRecurringSupplyLikelihood, extractNumericValue, calculateOrderProfit } from '@/lib/utils/helpers';

export const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await orderService.getAllOrders();
      setOrders(data);
      setFilteredOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.customer_name.toLowerCase().includes(query) ||
          order.phone.includes(query) ||
          order.location.toLowerCase().includes(query) ||
          order.description.toLowerCase().includes(query) ||
          (order.category && order.category.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    if (urgencyFilter !== 'all') {
      filtered = filtered.filter((order) => order.urgency === urgencyFilter);
    }

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, urgencyFilter, orders]);

  const handleStatusChange = async (orderId: number, newStatus: Order['status']) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      await loadOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update order status');
    }
  };

  const handleDelete = async (orderId: number) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      await orderService.deleteOrder(orderId);
      await loadOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order');
    }
  };

  const exportToCSV = () => {
    const headers = ['Order ID', 'Customer', 'Phone', 'Location', 'MOQ', 'Status', 'Urgency', 'Created'];
    const csvContent = [
      headers.join(','),
      ...filteredOrders.map((order) => [
        order.id,
        `"${order.customer_name}"`,
        order.phone,
        `"${order.location}"`,
        `"${order.moq}"`,
        order.status,
        order.urgency,
        new Date(order.created_at).toLocaleDateString(),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const highUrgencyCount = orders.filter((o) => o.urgency === 'high').length;
  const inProgressCount = orders.filter((o) => o.status === 'in-progress').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600 mt-1">Manage and track all customer orders</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<RefreshCw className="w-4 h-4" />} onClick={loadOrders}>
            Refresh
          </Button>
          <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={exportToCSV}>
            Export CSV
          </Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />}>
            New Order
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{inProgressCount}</p>
              </div>
              <Loader className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">High Urgency</p>
                <p className="text-2xl font-bold text-red-600">{highUrgencyCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="shipped">Shipped</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Urgency</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Orders ({filteredOrders.length})
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No orders found</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const daysSince = getDaysSince(order.created_at);
                const isAging = daysSince > 14 && order.status === 'pending';
                const customerPrice = extractNumericValue(order.customer_price);
                const profit = calculateOrderProfit(order);
                const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
                const isLowMargin = margin < 20 && order.status === 'completed';
                const isInventoryLow = isInventoryCritical(order.inventory_status);
                const isRecurring = order.is_recurring && !order.recurring_template_id;
                const recurringLikelihood = inferRecurringSupplyLikelihood(order.category);

                return (
                  <div
                    key={order.id}
                    className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      isAging ? 'bg-red-50 border-red-200' :
                      isLowMargin ? 'bg-yellow-50 border-yellow-200' :
                      isInventoryLow ? 'bg-orange-50 border-orange-200' :
                      isRecurring ? 'bg-green-50 border-green-200' :
                      'bg-white border-gray-200'
                    }`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">#{order.id} - {order.customer_name}</h4>
                          {isRecurring && <TrendingUp className="w-4 h-4 text-green-600" />}
                          {recurringLikelihood === 'High' && <TrendingUp className="w-4 h-4 text-green-600" />}
                          {recurringLikelihood === 'Medium' && <TrendingUp className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{order.description}</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                          <Badge variant={getStatusColor(order.status).includes('green') ? 'success' : getStatusColor(order.status).includes('red') ? 'danger' : 'info'}>
                            {order.status}
                          </Badge>
                          <Badge variant={order.urgency === 'high' ? 'danger' : order.urgency === 'medium' ? 'warning' : 'default'}>
                            {order.urgency}
                          </Badge>
                          {order.category && (
                            <Badge variant="default">{order.category}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {order.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {order.phone}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {daysSince}d ago
                          </span>
                          {customerPrice > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium text-green-600">
                                {customerPrice.toFixed(0)}
                              </span>
                              {profit > 0 && (
                                <span className={margin < 20 ? 'text-red-600' : 'text-blue-600'}>
                                  +{profit.toFixed(0)} ({margin.toFixed(0)}%)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="w-4 h-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-4 h-4" />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(order.id);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Order #{selectedOrder.id}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Customer Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium">{selectedOrder.customer_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <span className="ml-2 font-medium">{selectedOrder.phone}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium">{selectedOrder.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Location:</span>
                      <span className="ml-2 font-medium">{selectedOrder.location}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Order Details</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Description:</span>
                      <p className="mt-1">{selectedOrder.description}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">MOQ:</span>
                      <span className="ml-2 font-medium">{selectedOrder.moq}</span>
                    </div>
                    {selectedOrder.category && (
                      <div>
                        <span className="text-gray-600">Category:</span>
                        <span className="ml-2 font-medium">{selectedOrder.category}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Status Management</h4>
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'in-progress', 'completed', 'shipped', 'cancelled'] as Order['status'][]).map((status) => (
                      <Button
                        key={status}
                        variant={selectedOrder.status === status ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleStatusChange(selectedOrder.id, status)}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedOrder.supplier_name && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Supplier Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Supplier:</span>
                        <span className="ml-2 font-medium">{selectedOrder.supplier_name}</span>
                      </div>
                      {selectedOrder.supplier_price && (
                        <div>
                          <span className="text-gray-600">Supplier Price:</span>
                          <span className="ml-2 font-medium">{selectedOrder.supplier_price}</span>
                        </div>
                      )}
                      {selectedOrder.supplier_description && (
                        <div>
                          <span className="text-gray-600">Notes:</span>
                          <p className="mt-1">{selectedOrder.supplier_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
