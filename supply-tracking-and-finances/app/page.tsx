"use client";
import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Phone,
  MapPin,
  Mail,
  User,
  Package,
  FileText,
  Download,
  Eye,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader,
  Settings,
  RefreshCw,
  Tag,
  Plus,
  X,
  Shield,
  MessageSquare,
  Clock as ClockIcon,
} from 'lucide-react';

// Interfaces remain unchanged
interface OrderImage {
  name: string;
  url: string;
}

interface Order {
  id: number;
  customer_name: string;
  email?: string;
  phone: string;
  location: string;
  description: string;
  moq: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  images: string;
  created_at: string;
  supplier_name: string;
  supplier_price?: string;
  supplier_description?: string;
  customer_price?: string;
  category: string;
}

interface OrderFormData {
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

// Predefined categories kept for potential future use or hints
const CATEGORIES = [
  'Electronics',
  'Furniture',
  'Apparel',
  'Food & Beverage',
  'Industrial Equipment',
  'Medical Supplies',
  'Office Supplies',
  'Other'
];

const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

class SupabaseClient {
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.url}/rest/v1/${endpoint}`;
    const response = await fetch(url, {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  from(table: string) {
    return {
      select: (columns: string = '*') => ({
        execute: async (): Promise<Order[]> => {
          return this.request<Order[]>(`${table}?select=${columns}`);
        },
      }),
      insert: (data: Partial<Order> | Partial<Order>[]) => ({
        execute: async (): Promise<Order[]> => {
          return this.request<Order[]>(table, {
            method: 'POST',
            body: JSON.stringify(data),
          });
        },
      }),
      update: (data: Partial<Order>) => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<Order[]> => {
            return this.request<Order[]>(`${table}?${column}=eq.${value}`, {
              method: 'PATCH',
              body: JSON.stringify(data),
            });
          },
        }),
      }),
      delete: () => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> => {
            await this.request<void>(`${table}?${column}=eq.${value}`, {
              method: 'DELETE',
            });
          },
        }),
      }),
    };
  }
}

const supabase: SupabaseClient = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OrderManagementApp: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [formData, setFormData] = useState<OrderFormData>({
    customer_name: '',
    email: '',
    phone: '',
    location: '',
    description: '',
    moq: '',
    urgency: 'medium',
    images: [],
    category: '',
  });

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const highUrgencyCount = orders.filter(o => o.urgency === 'high').length;

  const loadOrders = async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await supabase.from('orders').select('*').execute();
      const sortedOrders = data.sort(
        (a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setOrders(sortedOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      const demoOrders: Order[] = [
        {
          id: 1,
          customer_name: 'John Smith',
          email: 'john@example.com',
          phone: '+947xxxxxxxx',
          location: '123 Main St, New York, NY 10001',
          description: 'Custom furniture order - Oak dining table for 6 people with matching chairs.',
          moq: '50 units',
          images: '[]',
          status: 'pending',
          supplier_name: '',
          created_at: '2024-01-15T10:00:00Z',
          urgency: 'medium',
          category: 'Furniture',
        },
      ];
      setOrders(demoOrders);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        if (event.target?.result) {
          setFormData((prev) => ({
            ...prev,
            images: [...prev.images, { name: file.name, url: event.target!.result as string }],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number): void => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const clearForm = () => {
    setFormData({
      customer_name: '',
      email: '',
      phone: '',
      location: '',
      description: '',
      moq: '',
      urgency: 'medium',
      images: [],
      category: '',
    });
  };

  const submitOrder = async (): Promise<void> => {
    if (
      !formData.customer_name ||
      !formData.phone ||
      !formData.location ||
      !formData.description ||
      !formData.moq ||
      !formData.category
    ) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const orderData: Partial<Order> = {
        customer_name: formData.customer_name,
        email: formData.email || undefined,
        phone: formData.phone,
        location: formData.location,
        description: formData.description,
        moq: formData.moq,
        urgency: formData.urgency,
        images: JSON.stringify(formData.images),
        status: 'pending',
        created_at: new Date().toISOString(),
        supplier_price: '',
        supplier_description: '',
        supplier_name: '',
        customer_price: '',
        category: formData.category,
      };

      await supabase.from('orders').insert(orderData).execute();

      clearForm();

      alert('✅ Order submitted successfully! We will get back to you soon.');
      await loadOrders();
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('❌ Error submitting order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: number, newStatus: Order['status']): Promise<void> => {
    setLoading(true);
    try {
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId).execute();
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order))
      );
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Error updating order status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateSupplierInfo = async (
    orderId: number,
    supplierPrice: string,
    supplierDescription: string
  ): Promise<void> => {
    setLoading(true);
    try {
      await supabase
        .from('orders')
        .update({ supplier_price: supplierPrice, supplier_description: supplierDescription })
        .eq('id', orderId)
        .execute();

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, supplier_price: supplierPrice, supplier_description: supplierDescription }
            : order
        )
      );

      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? { ...prev, supplier_price: supplierPrice, supplier_description: supplierDescription }
            : null
        );
      }

      alert('Supplier information updated successfully');
    } catch (error) {
      console.error('Error updating supplier info:', error);
      alert('Error updating supplier information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (orderId: number): Promise<void> => {
    if (!confirm('Are you sure you want to delete this order?')) return;

    setLoading(true);
    try {
      await supabase.from('orders').delete().eq('id', orderId).execute();
      setOrders((prev) => prev.filter((order) => order.id !== orderId));
      setSelectedOrder(null);
      alert('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Error deleting order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (): void => {
    const headers: string[] = [
      'Order ID',
      'Customer Name',
      'Email',
      'Phone',
      'Location',
      'Description',
      'MOQ',
      'Status',
      'Urgency',
      'Category',
      'Supplier Price',
      'Supplier Description',
      'Created Date',
    ];
    const csvContent = [
      headers.join(','),
      ...orders.map((order) => [
        order.id,
        `"${order.customer_name}"`,
        order.email || 'N/A',
        order.phone,
        `"${order.location}"`,
        `"${order.description.replace(/"/g, '""')}"`,
        `"${order.moq}"`,
        order.status,
        order.urgency,
        `"${order.category}"`,
        order.supplier_price || 'N/A',
        `"${(order.supplier_description || '').replace(/"/g, '""')}"`,
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

  const getStatusColor = (status: Order['status']): string => {
    const colors: Record<Order['status'], string> = {
      pending: 'bg-amber-100 text-amber-800 border-amber-300',
      'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status: Order['status']) => {
    const icons: Record<Order['status'], React.ReactNode> = {
      pending: <AlertCircle className="w-4 h-4" />,
      'in-progress': <Loader className="w-4 h-4" />,
      completed: <CheckCircle className="w-4 h-4" />,
      cancelled: <XCircle className="w-4 h-4" />,
    };
    return icons[status] || <AlertCircle className="w-4 h-4" />;
  };

  const getUrgencyColor = (urgency: Order['urgency']): string => {
    const colors: Record<Order['urgency'], string> = {
      low: 'text-green-600 bg-green-50',
      medium: 'text-yellow-600 bg-yellow-50',
      high: 'text-red-600 bg-red-50',
    };
    return colors[urgency] || 'text-gray-600 bg-gray-50';
  };

  const parseImages = (imagesJson: string): OrderImage[] => {
    try {
      return JSON.parse(imagesJson || '[]');
    } catch {
      return [];
    }
  };

  const filteredOrders = selectedCategory === 'All' 
    ? orders 
    : orders.filter(order => order.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Strategic Value Proposition */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Submit Your Sourcing Request</h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-6">
            We connect you with verified suppliers worldwide. Get competitive quotes within <strong>24–48 hours</strong>. 
            Your data is secure, and there’s <strong>no obligation</strong> to proceed.
          </p>

          {/* Trust & Value Badges */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <Shield className="w-4 h-4" />
              <span>Secure & Confidential</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700 font-medium">
              <ClockIcon className="w-4 h-4" />
              <span>Response in 1–2 Business Days</span>
            </div>
            <div className="flex items-center gap-2 text-purple-700 font-medium">
              <MessageSquare className="w-4 h-4" />
              <span>Dedicated Supplier Matching</span>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex justify-center gap-4 mb-6">
            <div className="bg-white px-4 py-2 rounded-lg shadow text-sm border border-gray-200">
              <span className="font-medium">Total Requests:</span> <span className="text-blue-600">{orders.length}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow text-sm border border-gray-200">
              <span className="font-medium">Pending Review:</span> <span className="text-amber-600">{pendingCount}</span>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg shadow text-sm border border-gray-200">
              <span className="font-medium">High Priority:</span> <span className="text-red-600">{highUrgencyCount}</span>
            </div>
          </div>

          <div className="flex justify-center">
            <a
              href="/admin"
              className="inline-flex items-center space-x-2 bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-gray-800 transition-all duration-200 shadow-md"
            >
              <Settings className="w-5 h-5" />
              <span>Go to Admin Panel</span>
            </a>
          </div>
        </div>

        {/* Order Form */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-2xl font-bold text-white">Your Sourcing Details</h2>
            <p className="text-blue-100 mt-1 text-sm">
              Provide as much detail as possible to receive the most accurate supplier matches.
            </p>
          </div>

          <div className="p-8 space-y-8">
            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Contact Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Sarah Johnson"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email (Optional but Recommended)</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="you@company.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">We’ll send updates here</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1 234 567 8900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                  <select
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Standard (5–7 days)</option>
                    <option value="medium">Medium (3–5 days)</option>
                    <option value="high">Urgent (1–2 days)</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location *</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Full address or city, country"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Helps us find local or regionally compliant suppliers</p>
              </div>
            </div>

            {/* Order Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Product or Service Requirements</h3>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Order Quantity (MOQ) *
                  </label>
                  <input
                    type="text"
                    name="moq"
                    value={formData.moq}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 500 units, 2 tons, 100 sets"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Be specific about units, packaging, and tolerances</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Solar Panels, Lab Coats, CNC Machined Parts..."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Be as specific as possible (e.g., “Biodegradable Food Containers” vs. “Packaging”)
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detailed Description *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe materials, dimensions, certifications, standards, samples needed, etc."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  The more detail you provide, the better we can match you with qualified suppliers.
                </p>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reference Images (Optional but Helpful)</h3>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Upload sketches, samples, or reference photos (max 5)</p>
              </button>

              {formData.images.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-700">Uploaded Images:</h4>
                    <button
                      onClick={clearForm}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Clear All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {formData.images.slice(0, 5).map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="w-full h-32 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit & Clear Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={clearForm}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Clear Form
              </button>
              <button
                onClick={submitOrder}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Processing Request...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Submit Sourcing Request
                  </>
                )}
              </button>
            </div>

            {/* Final Reassurance */}
            <div className="pt-4 text-center text-sm text-gray-600 border-t border-gray-100">
              <p>
                ✅ <strong>No cost to submit.</strong> We’ll contact you with supplier options within 1–2 business days.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderManagementApp;