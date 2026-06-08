"use client";
import React, { useState } from 'react';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';
import { OrderManagement } from '@/components/orders/OrderManagement';
import { SupplierPerformanceDashboard } from '@/components/analytics/SupplierPerformance';
import { CustomerInsightsDashboard } from '@/components/analytics/CustomerInsights';
import { PricingDashboard } from '@/components/analytics/PricingDashboard';
import { LogisticsDashboard } from '@/components/analytics/LogisticsDashboard';
import { ReconditioningDashboard } from '@/components/analytics/ReconditioningDashboard';
import { Button } from '@/components/ui/Button';
import { BarChart3, Package, Users, Award, ArrowLeft, DollarSign, Truck, Wrench } from 'lucide-react';
import Link from 'next/link';

type AdminTab = 'analytics' | 'orders' | 'suppliers' | 'customers' | 'pricing' | 'logistics' | 'reconditioning';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  const tabs = [
    { id: 'analytics' as AdminTab, label: 'Analytics', icon: BarChart3 },
    { id: 'orders' as AdminTab, label: 'Orders', icon: Package },
    { id: 'suppliers' as AdminTab, label: 'Suppliers', icon: Award },
    { id: 'customers' as AdminTab, label: 'Customers', icon: Users },
    { id: 'pricing' as AdminTab, label: 'Pricing', icon: DollarSign },
    { id: 'logistics' as AdminTab, label: 'Logistics', icon: Truck },
    { id: 'reconditioning' as AdminTab, label: 'Reconditioning', icon: Wrench },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}>
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600 text-sm">Manage your supply chain and finances</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        {activeTab === 'orders' && <OrderManagement />}
        {activeTab === 'suppliers' && <SupplierPerformanceDashboard />}
        {activeTab === 'customers' && <CustomerInsightsDashboard />}
        {activeTab === 'pricing' && <PricingDashboard />}
        {activeTab === 'logistics' && <LogisticsDashboard />}
        {activeTab === 'reconditioning' && <ReconditioningDashboard />}
      </div>
    </div>
  );
}
