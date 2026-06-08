"use client";
import React, { useState, useEffect } from 'react';
import { OrderForm } from '@/components/orders/OrderForm';
import { Button } from '@/components/ui/Button';
import { Settings, Shield, Clock, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { orderService } from '@/lib/services/orders';
import { Order } from '@/types';

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const data = await orderService.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const highUrgencyCount = orders.filter(o => o.urgency === 'high').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Strategic Value Proposition */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Submit Your Sourcing Request</h1>
          <p className="text-lg text-gray-700 max-w-3xl mx-auto mb-6">
            We connect you with verified suppliers worldwide. Get competitive quotes within <strong>24–48 hours</strong>. 
            Your data is secure, and there's <strong>no obligation</strong> to proceed.
          </p>

          {/* Trust & Value Badges */}
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <Shield className="w-4 h-4" />
              <span>Secure & Confidential</span>
            </div>
            <div className="flex items-center gap-2 text-blue-700 font-medium">
              <Clock className="w-4 h-4" />
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
            <Link href="/admin">
              <Button variant="primary" icon={<Settings className="w-5 h-5" />}>
                Go to Admin Panel
              </Button>
            </Link>
          </div>
        </div>

        {/* Order Form */}
        <OrderForm onSuccess={loadOrders} />
      </div>
    </div>
  );
}
