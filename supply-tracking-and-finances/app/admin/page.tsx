"use client";
import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Download,
  Trash2,
  Loader,
  CheckCircle,
  AlertCircle,
  XCircle,
  Package,
  Mail,
  Phone,
  ArrowLeft,
  X,
  DollarSign,
  Edit2,
  Save,
  TrendingUp,
  Upload,FileDown,
  Wallet,
  Calculator,
} from "lucide-react";

// ------------------------
// TypeScript Types
// ------------------------
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
  urgency: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "completed" | "cancelled" | "ship";
  images: string;
  created_at: string;
  supplier_price?: string;
  supplier_description?: string;
  customer_price?: string;
}

interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  completedOrders: number;
  pendingValue: number;
  inProgressValue: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  reinvestmentPool: number;
  averageOrderValue: number;
  averageProfit: number;
}

interface CSVRow {
  customer_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  description?: string;
  moq?: string;
  urgency?: string;
  status?: string;
  supplier_price?: string;
  supplier_description?: string;
  customer_price?: string;
}

// ------------------------
// Supabase Client
// ------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

class SupabaseClient {
  constructor(private url: string, private key: string) {}

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/${endpoint}`, {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json() as Promise<T>;
  }

  from(table: string) {
    return {
      select: (columns: string = "*") => ({
        execute: async (): Promise<Order[]> =>
          this.request<Order[]>(`${table}?select=${columns}`),
      }),
      insert: (data: Partial<Order> | Partial<Order>[]) => ({
        execute: async (): Promise<Order[]> =>
          this.request<Order[]>(table, {
            method: "POST",
            body: JSON.stringify(data),
          }),
      }),
      update: (data: Partial<Order>) => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<Order[]> =>
            this.request<Order[]>(`${table}?${column}=eq.${value}`, {
              method: "PATCH",
              body: JSON.stringify(data),
            }),
        }),
      }),
      delete: () => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> =>
            this.request<void>(`${table}?${column}=eq.${value}`, {
              method: "DELETE",
            }),
        }),
      }),
    };
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------
// Helper Functions
// ------------------------
const getStatusColor = (status: Order["status"]) => {
  const colors: Record<Order["status"], string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    "in-progress": "bg-blue-100 text-blue-800 border-blue-300",
    completed: "bg-green-100 text-green-800 border-green-300",
    cancelled: "bg-red-100 text-red-800 border-red-300",
      ship: "bg-purple-100 text-purple-800 border-purple-300", // Add this
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
};

const getStatusIcon = (status: Order["status"]) => {
  const icons: Record<Order["status"], React.ReactElement> = {
    pending: <AlertCircle className="w-4 h-4" />,
    "in-progress": <Loader className="w-4 h-4" />,
    completed: <CheckCircle className="w-4 h-4" />,
    cancelled: <XCircle className="w-4 h-4" />,
      ship: <Package className="w-4 h-4" />, // Add this
  };
  return icons[status] || <AlertCircle className="w-4 h-4" />;
};

const getUrgencyColor = (urgency: Order["urgency"]) => {
  const colors: Record<Order["urgency"], string> = {
    low: "text-green-600 bg-green-50",
    medium: "text-yellow-600 bg-yellow-50",
    high: "text-red-600 bg-red-50",
  };
  return colors[urgency] || "text-gray-600 bg-gray-50";
};

const parseImages = (imagesJson: string): OrderImage[] => {
  try {
    return JSON.parse(imagesJson || "[]");
  } catch {
    return [];
  }
};

const extractNumericValue = (priceString?: string): number => {
  if (!priceString) return 0;
  const match = priceString.match(/[\d,]+\.?\d*/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/,/g, ""));
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const calculateFinancials = (orders: Order[]): FinancialSummary => {
  let totalRevenue = 0;
  let totalCost = 0;
  let completedOrders = 0;
  let pendingValue = 0;
  let inProgressValue = 0;
  let cashInflow = 0;
  let cashOutflow = 0;

  orders.forEach((order) => {
    const customerPrice = extractNumericValue(order.customer_price);
    const supplierPrice = extractNumericValue(order.supplier_price);

    if (order.status === "completed") {
      totalRevenue += customerPrice;
      totalCost += supplierPrice;
      completedOrders++;
      cashInflow += customerPrice; // Money received
      cashOutflow += supplierPrice; // Money paid out
    } else if (order.status === "pending") {
      pendingValue += customerPrice;
    } else if (order.status === "in-progress") {
      inProgressValue += customerPrice;
      // For in-progress, we might have already paid suppliers
      if (supplierPrice > 0) {
        cashOutflow += supplierPrice;
      }
    }
  });

  const totalProfit = totalRevenue - totalCost;
  const profitMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const netCashFlow = cashInflow - cashOutflow;

  // Reinvestment pool: 30% of profit reserved for growth
  const reinvestmentPool = totalProfit > 0 ? totalProfit * 0.3 : 0;

  const averageOrderValue =
    completedOrders > 0 ? totalRevenue / completedOrders : 0;
  const averageProfit = completedOrders > 0 ? totalProfit / completedOrders : 0;

  return {
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    completedOrders,
    pendingValue,
    inProgressValue,
    cashInflow,
    cashOutflow,
    netCashFlow,
    reinvestmentPool,
    averageOrderValue,
    averageProfit,
  };
};

// ------------------------
// Status Updater Component
// ------------------------
const StatusUpdater: React.FC<{
  currentStatus: Order["status"];
  onUpdate: (status: Order["status"]) => void;
  loading: boolean;
}> = ({ currentStatus, onUpdate, loading }) => {
  const statuses: Order["status"][] = [
    "pending",
    "in-progress",
    "completed",
    "cancelled",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <button
          key={status}
          onClick={() => onUpdate(status)}
          disabled={loading || currentStatus === status}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            currentStatus === status
              ? "bg-blue-600 text-white cursor-default"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          } disabled:opacity-50`}
        >
          {status}
        </button>
      ))}
    </div>
  );
};

// ------------------------
// Financial Dashboard Component
// ------------------------
const FinancialDashboard: React.FC<{ summary: FinancialSummary }> = ({
  summary,
}) => {
  const operatingCashFlow = summary.totalProfit - summary.reinvestmentPool;
  const cashFlowHealth = summary.netCashFlow >= 0 ? "positive" : "negative";

  return (
    <div className="space-y-6">
      {/* Main Financial Metrics */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Calculator className="w-6 h-6 mr-2 text-blue-600" />
          Financial Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Total Revenue
              </span>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.totalRevenue)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {summary.completedOrders} orders
              </span>
              <span className="text-green-600 font-medium">
                Avg: {formatCurrency(summary.averageOrderValue)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Total Cost
              </span>
              <Wallet className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.totalCost)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">Supplier payments</span>
              <span className="text-red-600 font-medium">
                {summary.totalRevenue > 0
                  ? ((summary.totalCost / summary.totalRevenue) * 100).toFixed(
                      1
                    )
                  : 0}
                % of revenue
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Net Profit
              </span>
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <p
              className={`text-2xl font-bold ${
                summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(summary.totalProfit)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">
                {summary.profitMargin.toFixed(1)}% margin
              </span>
              <span className="text-blue-600 font-medium">
                Avg: {formatCurrency(summary.averageProfit)}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Pipeline Value
              </span>
              <Package className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.pendingValue + summary.inProgressValue)}
            </p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Pending:</span>
                <span className="font-medium text-amber-600">
                  {formatCurrency(summary.pendingValue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">In Progress:</span>
                <span className="font-medium text-blue-600">
                  {formatCurrency(summary.inProgressValue)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Flow Analysis */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg border border-emerald-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
          Cash Flow Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Cash Inflows
              </span>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-lg">↓</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.cashInflow)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Money received from customers
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Cash Outflows
              </span>
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-lg">↑</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.cashOutflow)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Payments to suppliers</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Net Cash Flow
              </span>
              <div
                className={`w-8 h-8 rounded-full ${
                  cashFlowHealth === "positive" ? "bg-green-100" : "bg-red-100"
                } flex items-center justify-center`}
              >
                <span
                  className={`${
                    cashFlowHealth === "positive"
                      ? "text-green-600"
                      : "text-red-600"
                  } text-lg font-bold`}
                >
                  {cashFlowHealth === "positive" ? "+" : "-"}
                </span>
              </div>
            </div>
            <p
              className={`text-2xl font-bold ${
                summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(summary.netCashFlow)}
            </p>
            <p
              className={`text-xs mt-1 font-medium ${
                cashFlowHealth === "positive"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {cashFlowHealth === "positive"
                ? "Healthy cash position"
                : "Cash flow needs attention"}
            </p>
          </div>
        </div>

        {/* Cash Flow Bar Visualization */}
        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Cash Flow Balance
            </span>
            <span className="text-xs text-gray-500">Visual representation</span>
          </div>
          <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
              style={{
                width: `${
                  summary.cashInflow > 0
                    ? (summary.cashInflow /
                        (summary.cashInflow + summary.cashOutflow)) *
                      100
                    : 0
                }%`,
              }}
            />
            <div
              className="absolute right-0 top-0 h-full bg-gradient-to-l from-red-400 to-red-600 transition-all duration-500"
              style={{
                width: `${
                  summary.cashOutflow > 0
                    ? (summary.cashOutflow /
                        (summary.cashInflow + summary.cashOutflow)) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-green-600 font-medium">
              Inflows:{" "}
              {summary.cashInflow > 0
                ? (
                    (summary.cashInflow /
                      (summary.cashInflow + summary.cashOutflow)) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </span>
            <span className="text-red-600 font-medium">
              Outflows:{" "}
              {summary.cashOutflow > 0
                ? (
                    (summary.cashOutflow /
                      (summary.cashInflow + summary.cashOutflow)) *
                    100
                  ).toFixed(1)
                : 0}
              %
            </span>
          </div>
        </div>
      </div>

      {/* Profit Distribution & Reinvestment */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-6 rounded-lg border border-violet-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-violet-600" />
          Profit Distribution & Growth Strategy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Reinvestment Pool (30%)
              </span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600">
              {formatCurrency(summary.reinvestmentPool)}
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Available for growth</span>
                <span className="font-medium text-purple-600">
                  30% of profit
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: "30%" }}
                />
              </div>
            </div>
            <div className="mt-3 p-2 bg-purple-50 rounded text-xs text-gray-600">
              <span className="font-medium">Use for:</span> Marketing,
              inventory, expansion
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Operating Cash (70%)
              </span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {formatCurrency(operatingCashFlow)}
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Available for operations</span>
                <span className="font-medium text-blue-600">70% of profit</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: "70%" }}
                />
              </div>
            </div>
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-gray-600">
              <span className="font-medium">Use for:</span> Salaries, expenses,
              reserves
            </div>
          </div>
        </div>

        {/* Profit Margin Indicator */}
        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Profit Margin Health
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                summary.profitMargin >= 30
                  ? "bg-green-100 text-green-700"
                  : summary.profitMargin >= 20
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {summary.profitMargin >= 30
                ? "Excellent"
                : summary.profitMargin >= 20
                ? "Good"
                : "Needs Improvement"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${
                summary.profitMargin >= 30
                  ? "bg-gradient-to-r from-green-400 to-green-600"
                  : summary.profitMargin >= 20
                  ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                  : "bg-gradient-to-r from-red-400 to-red-600"
              }`}
              style={{ width: `${Math.min(summary.profitMargin, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>Target: 30%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Package className="w-5 h-5 mr-2 text-gray-600" />
          Key Performance Indicators
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Avg Order Value</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(summary.averageOrderValue)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Avg Profit/Order</p>
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(summary.averageProfit)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Total Orders</p>
            <p className="text-lg font-bold text-gray-900">
              {summary.completedOrders}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Profit Margin</p>
            <p
              className={`text-lg font-bold ${
                summary.profitMargin >= 20 ? "text-green-600" : "text-red-600"
              }`}
            >
              {summary.profitMargin.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};



// ------------------------
// Order Card Component
// ------------------------
const OrderCard: React.FC<{
  order: Order;
  selected?: boolean;
  onClick: () => void;
}> = ({ order, selected, onClick }) => {
  const customerPrice = extractNumericValue(order.customer_price);
  const supplierPrice = extractNumericValue(order.supplier_price);
  const profit = customerPrice - supplierPrice;

  return (
    <div
      className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
        selected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{order.customer_name}</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(
            order.status
          )}`}
        >
          {order.status}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-2">{order.moq}</p>
      <p className="text-xs text-gray-500">
        {new Date(order.created_at).toLocaleDateString()}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`text-xs px-2 py-1 rounded-full ${getUrgencyColor(
            order.urgency
          )}`}
        >
          {order.urgency} priority
        </span>
        {customerPrice > 0 && (
          <div className="text-xs">
            <span className="font-medium text-green-600">
              {formatCurrency(customerPrice)}
            </span>
            {supplierPrice > 0 && profit > 0 && (
              <span className="ml-2 text-blue-600">
                +{formatCurrency(profit)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------
// Image Gallery Component
// ------------------------
const ImageGallery: React.FC<{ images: OrderImage[] }> = ({ images }) => {
  const openImage = (url: string) =>
    window.open(url, "_blank", "noopener,noreferrer");

  if (images.length === 0) {
    return (
      <div>
        <h3 className="font-semibold text-gray-900 mb-4">Order Images</h3>
        <p className="text-gray-500 text-sm">No images available</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="font-semibold text-gray-900 mb-4">
        Order Images ({images.length})
      </h3>
      <div className="space-y-4">
        {images.map((image, i) => (
          <div
            key={i}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
          >
            <p className="text-sm font-medium text-gray-800 mb-2">
              {image.name}
            </p>
            <div className="flex justify-center">
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-auto object-contain rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => openImage(image.url)}
                title="Click to view full size in new tab"
              />
            </div>
            <div className="mt-2 text-center">
              <button
                onClick={() => openImage(image.url)}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                View full size in new tab
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ------------------------
// Pricing Section Component
// ------------------------
const PricingSection: React.FC<{
  order: Order;
  isEditing: boolean;
  supplierPrice: string;
  supplierDescription: string;
  customerPrice: string;
  setSupplierPrice: (val: string) => void;
  setSupplierDescription: (val: string) => void;
  setCustomerPrice: (val: string) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  onEdit: () => void;
}> = ({
  order,
  isEditing,
  supplierPrice,
  supplierDescription,
  customerPrice,
  setSupplierPrice,
  setSupplierDescription,
  setCustomerPrice,
  onSave,
  onCancel,
  loading,
  onEdit,
}) => {
  const supplierCost = extractNumericValue(
    isEditing ? supplierPrice : order.supplier_price
  );
  const customerRevenue = extractNumericValue(
    isEditing ? customerPrice : order.customer_price
  );
  const profit = customerRevenue - supplierCost;
  const margin = customerRevenue > 0 ? (profit / customerRevenue) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          <span>Pricing & Financials</span>
        </h3>
        {!isEditing && (
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1 text-sm"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Price (Revenue)
            </label>
            <input
              type="text"
              value={customerPrice}
              onChange={(e) => setCustomerPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 8000 USD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier Price (Cost)
            </label>
            <input
              type="text"
              value={supplierPrice}
              onChange={(e) => setSupplierPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 5000 USD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier Notes (Optional)
            </label>
            <textarea
              value={supplierDescription}
              onChange={(e) => setSupplierDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional details about pricing, materials, shipping, etc."
            />
          </div>

          {supplierCost > 0 && customerRevenue > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Profit Calculation:
              </p>
              <p className="text-lg font-bold text-blue-600">
                {formatCurrency(profit)} ({margin.toFixed(1)}% margin)
              </p>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={onSave}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button
              onClick={onCancel}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 flex items-center space-x-2 text-sm"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Customer Price</p>
              <p className="text-2xl font-bold text-green-600">
                {order.customer_price || "Not set"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Supplier Cost</p>
              <p className="text-2xl font-bold text-red-600">
                {order.supplier_price || "Not set"}
              </p>
            </div>
          </div>

          {supplierCost > 0 && customerRevenue > 0 && (
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-gray-700">Profit:</p>
                <p
                  className={`text-2xl font-bold ${
                    profit >= 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(profit)}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-500">Margin:</p>
                <p className="text-sm font-medium text-gray-700">
                  {margin.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {order.supplier_description && (
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Supplier Notes:</p>
              <p className="text-sm text-gray-700">
                {order.supplier_description}
              </p>
            </div>
          )}

          {!order.customer_price && !order.supplier_price && (
            <p className="text-gray-500 italic text-sm">
              No pricing information added yet
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// ------------------------
// Main App Component
// ------------------------
const OrderManagementApp: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrdersList, setShowOrdersList] = useState(true);
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [supplierPrice, setSupplierPrice] = useState("");
  const [supplierDescription, setSupplierDescription] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target?.result as string;
      const rows = text.split('\n').map(row => row.trim()).filter(row => row);
      
      if (rows.length < 2) {
        alert('CSV file is empty or invalid');
        return;
      }

      // Parse headers
      const headers = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      
      // Parse data rows
      const newOrders: Partial<Order>[] = [];
      
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => 
          v.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"')
        ) || [];
        
        if (values.length === 0) continue;
        
        const rowData: CSVRow = {};
        headers.forEach((header, index) => {
          if (values[index]) {
            rowData[header as keyof CSVRow] = values[index];
          }
        });

        // Validate required fields
        if (!rowData.customer_name || !rowData.phone || !rowData.location || 
            !rowData.description || !rowData.moq) {
          console.warn(`Skipping row ${i + 1}: Missing required fields`);
          continue;
        }

        // Map and validate data
        const order: Partial<Order> = {
          customer_name: rowData.customer_name,
          email: rowData.email || undefined,
          phone: rowData.phone,
          location: rowData.location,
          description: rowData.description,
          moq: rowData.moq,
          urgency: (['low', 'medium', 'high'].includes(rowData.urgency?.toLowerCase() || '') 
            ? rowData.urgency?.toLowerCase() 
            : 'medium') as Order['urgency'],
          status: (['pending', 'in-progress', 'completed', 'cancelled'].includes(rowData.status?.toLowerCase() || '') 
            ? rowData.status?.toLowerCase() 
            : 'pending') as Order['status'],
          supplier_price: rowData.supplier_price || undefined,
          supplier_description: rowData.supplier_description || undefined,
          customer_price: rowData.customer_price || undefined,
          images: '[]', // Default empty images array
        };

        newOrders.push(order);
      }

      if (newOrders.length === 0) {
        alert('No valid orders found in CSV file');
        return;
      }

      // Insert orders into database
      setLoading(true);
      try {
        const result = await supabase.from("orders").insert(newOrders).execute();
        
        // Refresh orders list
        await loadOrders();
        
        alert(`Successfully imported ${newOrders.length} order(s)`);
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import orders. Please check the CSV format.');
      } finally {
        setLoading(false);
      }
      
    } catch (error) {
      console.error('CSV parsing error:', error);
      alert('Error parsing CSV file. Please check the format.');
    }
  };

  reader.readAsText(file);
  event.target.value = ''; // Reset input
};

// CSV Template Download Function
const downloadCSVTemplate = () => {
  const template = [
    'customer_name,email,phone,location,description,moq,urgency,status,supplier_price,supplier_description,customer_price',
    '"John Doe","john@example.com","+1234567890","New York","Custom widgets order","1000 units","high","pending","5000 USD","Premium supplier","8000 USD"',
    '"Jane Smith","jane@example.com","+9876543210","Los Angeles","Bulk electronics","500 units","medium","in-progress","3000 USD","Standard shipping","4500 USD"'
  ].join('\n');

  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'order_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

  // ------------------------
  // Load Orders
  // ------------------------
const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await supabase.from("orders").select("*").execute();
      // Filter out orders with status "ship" and sort by urgency (high > medium > low), then by date
      const filtered = data.filter((order) => order.status !== "ship");
      const urgencyPriority = { high: 3, medium: 2, low: 1 };
      const sorted = filtered.sort((a, b) => {
        const urgencyDiff = urgencyPriority[b.urgency] - urgencyPriority[a.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setOrders(sorted);
    } catch (error) {
      console.error(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const financialSummary = calculateFinancials(orders);

  // ------------------------
  // Actions
  // ------------------------
  const updateOrderStatus = async (
    orderId: number,
    status: Order["status"]
  ) => {
    setLoading(true);
    try {
      await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId)
        .execute();
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      if (selectedOrder?.id === orderId)
        setSelectedOrder({ ...selectedOrder, status });
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const updatePricingInfo = async (orderId: number) => {
    setLoading(true);
    try {
      await supabase
        .from("orders")
        .update({
          supplier_price: supplierPrice || undefined,
          supplier_description: supplierDescription || undefined,
          customer_price: customerPrice || undefined,
        })
        .eq("id", orderId)
        .execute();

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                supplier_price: supplierPrice || undefined,
                supplier_description: supplierDescription || undefined,
                customer_price: customerPrice || undefined,
              }
            : o
        )
      );

      if (selectedOrder?.id === orderId)
        setSelectedOrder({
          ...selectedOrder,
          supplier_price: supplierPrice || undefined,
          supplier_description: supplierDescription || undefined,
          customer_price: customerPrice || undefined,
        });

      setIsEditingPricing(false);
      alert("Pricing updated successfully");
    } catch {
      alert("Failed to update pricing");
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (orderId: number) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    setLoading(true);
    try {
      await supabase.from("orders").delete().eq("id", orderId).execute();
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setSelectedOrder(null);
      alert("Order deleted");
    } catch {
      alert("Failed to delete order");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Order ID",
      "Customer Name",
      "Email",
      "Phone",
      "Location",
      "Description",
      "MOQ",
      "Status",
      "Urgency",
      "Customer Price",
      "Supplier Price",
      "Profit",
      "Margin %",
      "Supplier Description",
      "Created Date",
    ];
    const csv = [
      headers.join(","),
      ...orders.map((o) => {
        const customerPrice = extractNumericValue(o.customer_price);
        const supplierPrice = extractNumericValue(o.supplier_price);
        const profit = customerPrice - supplierPrice;
        const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;

        return [
          o.id,
          `"${o.customer_name}"`,
          o.email || "N/A",
          o.phone,
          `"${o.location}"`,
          `"${o.description.replace(/"/g, '""')}"`,
          `"${o.moq}"`,
          o.status,
          o.urgency,
          o.customer_price || "N/A",
          o.supplier_price || "N/A",
          customerPrice > 0 && supplierPrice > 0 ? profit.toFixed(2) : "N/A",
          customerPrice > 0 && supplierPrice > 0 ? margin.toFixed(1) : "N/A",
          `"${(o.supplier_description || "").replace(/"/g, '""')}"`,
          new Date(o.created_at).toLocaleDateString(),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportStrategicReport = () => {
    const summary = financialSummary;
    const operatingCashFlow = summary.totalProfit - summary.reinvestmentPool;
    const date = new Date().toISOString().split("T")[0];

    // Strategic Financial Report
    const reportSections = [
      "STRATEGIC FINANCIAL REPORT",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "=== EXECUTIVE SUMMARY ===",
      `Total Revenue,${summary.totalRevenue.toFixed(2)}`,
      `Total Costs,${summary.totalCost.toFixed(2)}`,
      `Net Profit,${summary.totalProfit.toFixed(2)}`,
      `Profit Margin,${summary.profitMargin.toFixed(2)}%`,
      `Completed Orders,${summary.completedOrders}`,
      "",
      "=== CASH FLOW ANALYSIS ===",
      `Cash Inflows (Revenue Received),${summary.cashInflow.toFixed(2)}`,
      `Cash Outflows (Supplier Payments),${summary.cashOutflow.toFixed(2)}`,
      `Net Cash Flow,${summary.netCashFlow.toFixed(2)}`,
      `Cash Flow Status,${
        summary.netCashFlow >= 0
          ? "POSITIVE - Healthy"
          : "NEGATIVE - Needs Attention"
      }`,
      `Inflow to Outflow Ratio,${
        summary.cashOutflow > 0
          ? (summary.cashInflow / summary.cashOutflow).toFixed(2)
          : "N/A"
      }`,
      "",
      "=== PROFIT DISTRIBUTION STRATEGY ===",
      `Reinvestment Pool (30% of Profit),${summary.reinvestmentPool.toFixed(
        2
      )}`,
      `Operating Cash (70% of Profit),${operatingCashFlow.toFixed(2)}`,
      `Reinvestment Recommendations,Marketing expansion; Inventory growth; Technology upgrades`,
      `Operating Cash Uses,Salaries; Operational expenses; Emergency reserves`,
      "",
      "=== PIPELINE & FUTURE REVENUE ===",
      `Pending Orders Value,${summary.pendingValue.toFixed(2)}`,
      `In-Progress Orders Value,${summary.inProgressValue.toFixed(2)}`,
      `Total Pipeline Value,${(
        summary.pendingValue + summary.inProgressValue
      ).toFixed(2)}`,
      `Pipeline to Revenue Ratio,${
        summary.totalRevenue > 0
          ? (
              ((summary.pendingValue + summary.inProgressValue) /
                summary.totalRevenue) *
              100
            ).toFixed(1)
          : 0
      }%`,
      "",
      "=== KEY PERFORMANCE INDICATORS ===",
      `Average Order Value,${summary.averageOrderValue.toFixed(2)}`,
      `Average Profit per Order,${summary.averageProfit.toFixed(2)}`,
      `Cost to Revenue Ratio,${
        summary.totalRevenue > 0
          ? ((summary.totalCost / summary.totalRevenue) * 100).toFixed(1)
          : 0
      }%`,
      `Profit per Dollar of Revenue,${
        summary.totalRevenue > 0
          ? (summary.totalProfit / summary.totalRevenue).toFixed(2)
          : 0
      }`,
      "",
      "=== PERFORMANCE HEALTH SCORES ===",
      `Profit Margin Health,${
        summary.profitMargin >= 30
          ? "EXCELLENT (30%+)"
          : summary.profitMargin >= 20
          ? "GOOD (20-30%)"
          : "NEEDS IMPROVEMENT (<20%)"
      }`,
      `Cash Flow Health,${summary.netCashFlow >= 0 ? "HEALTHY" : "AT RISK"}`,
      `Revenue Growth Potential,${
        summary.pendingValue + summary.inProgressValue > summary.totalRevenue
          ? "HIGH"
          : "MODERATE"
      }`,
      "",
      "=== STRATEGIC RECOMMENDATIONS ===",
      `Priority 1,${
        summary.profitMargin < 20
          ? "Improve profit margins through cost reduction or pricing optimization"
          : "Maintain current margin levels"
      }`,
      `Priority 2,${
        summary.netCashFlow < 0
          ? "Address negative cash flow - review payment terms with suppliers/customers"
          : "Continue positive cash flow management"
      }`,
      `Priority 3,${
        summary.pendingValue > 0
          ? "Convert pending orders to in-progress status to accelerate revenue"
          : "Focus on new customer acquisition"
      }`,
      `Priority 4,${
        summary.reinvestmentPool > 0
          ? `Allocate ${summary.reinvestmentPool.toFixed(
              2
            )} USD for growth initiatives`
          : "Build profit base before major investments"
      }`,
      "",
      "=== DETAILED ORDER BREAKDOWN ===",
      "",
      "Order ID,Customer,Status,Revenue,Cost,Profit,Margin %,Urgency,Date,Cash Impact",
    ];

    // Add individual order details
    orders.forEach((o) => {
      const customerPrice = extractNumericValue(o.customer_price);
      const supplierPrice = extractNumericValue(o.supplier_price);
      const profit = customerPrice - supplierPrice;
      const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
      const cashImpact =
        o.status === "completed"
          ? "Realized"
          : o.status === "in-progress"
          ? "Pending"
          : o.status === "cancelled"
          ? "Lost"
          : "Future";

      reportSections.push(
        [
          o.id,
          `"${o.customer_name}"`,
          o.status,
          customerPrice > 0 ? customerPrice.toFixed(2) : "0",
          supplierPrice > 0 ? supplierPrice.toFixed(2) : "0",
          customerPrice > 0 && supplierPrice > 0 ? profit.toFixed(2) : "0",
          customerPrice > 0 && supplierPrice > 0 ? margin.toFixed(1) : "0",
          o.urgency,
          new Date(o.created_at).toLocaleDateString(),
          cashImpact,
        ].join(",")
      );
    });

    // Add summary statistics by status
    reportSections.push("");
    reportSections.push("=== STATUS-WISE BREAKDOWN ===");
    reportSections.push(
      "Status,Count,Total Revenue,Total Cost,Total Profit,Avg Margin %"
    );

    const statuses: Order["status"][] = [
      "pending",
      "in-progress",
      "completed",
      "cancelled",
    ];
    statuses.forEach((status) => {
      const statusOrders = orders.filter((o) => o.status === status);
      const statusRevenue = statusOrders.reduce(
        (sum, o) => sum + extractNumericValue(o.customer_price),
        0
      );
      const statusCost = statusOrders.reduce(
        (sum, o) => sum + extractNumericValue(o.supplier_price),
        0
      );
      const statusProfit = statusRevenue - statusCost;
      const statusMargin =
        statusRevenue > 0 ? (statusProfit / statusRevenue) * 100 : 0;

      reportSections.push(
        [
          status,
          statusOrders.length,
          statusRevenue.toFixed(2),
          statusCost.toFixed(2),
          statusProfit.toFixed(2),
          statusMargin.toFixed(1),
        ].join(",")
      );
    });

    // Add urgency-wise breakdown
    reportSections.push("");
    reportSections.push("=== URGENCY-WISE BREAKDOWN ===");
    reportSections.push("Urgency,Count,Total Revenue,Avg Order Value");

    const urgencies: Order["urgency"][] = ["high", "medium", "low"];
    urgencies.forEach((urgency) => {
      const urgencyOrders = orders.filter((o) => o.urgency === urgency);
      const urgencyRevenue = urgencyOrders.reduce(
        (sum, o) => sum + extractNumericValue(o.customer_price),
        0
      );
      const avgOrderValue =
        urgencyOrders.length > 0 ? urgencyRevenue / urgencyOrders.length : 0;

      reportSections.push(
        [
          urgency,
          urgencyOrders.length,
          urgencyRevenue.toFixed(2),
          avgOrderValue.toFixed(2),
        ].join(",")
      );
    });

    const csv = reportSections.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategic_report_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------------------------
  // Handlers
  // ------------------------
  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrdersList(false);
    setIsEditingPricing(false);
    setSupplierPrice(order.supplier_price || "");
    setSupplierDescription(order.supplier_description || "");
    setCustomerPrice(order.customer_price || "");
  };

  const handleBackToList = () => {
    setShowOrdersList(true);
    setSelectedOrder(null);
    setIsEditingPricing(false);
  };

  const handleEditPricing = () => setIsEditingPricing(true);
  const handleCancelEdit = () => {
    setIsEditingPricing(false);
    if (selectedOrder) {
      setSupplierPrice(selectedOrder.supplier_price || "");
      setSupplierDescription(selectedOrder.supplier_description || "");
      setCustomerPrice(selectedOrder.customer_price || "");
    }
  };

  // ------------------------
  // Render
  // ------------------------
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Orders List Sidebar */}
      <div
        className={`flex-shrink-0 w-full md:w-1/3 border-r border-gray-200 bg-white flex flex-col ${
          showOrdersList ? "block" : "hidden md:flex"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <h2 className="font-semibold text-gray-900">
            Orders ({orders.length})
          </h2>
          <div className="flex space-x-2">
           <button
      onClick={loadOrders}
      className="bg-gray-100 p-2 rounded hover:bg-gray-200"
      title="Refresh Orders"
    >
      <RefreshCw className="w-4 h-4" />
    </button>
    
    <input
      type="file"
      accept=".csv"
      onChange={handleCSVImport}
      className="hidden"
      id="csv-import"
    />
    <label
      htmlFor="csv-import"
      className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 flex items-center space-x-1 cursor-pointer"
      title="Import CSV"
    >
      <Upload className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">Import</span>
    </label>
    
    <button
      onClick={downloadCSVTemplate}
      className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 flex items-center space-x-1"
      title="Download Template"
    >
      <FileDown className="w-4 h-4" />
      <span className="text-sm hidden sm:inline">Template</span>
    </button>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 flex items-center space-x-1"
                title="Export Options"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Export</span>
              </button>
              {showExportMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          exportToCSV();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 border-b border-gray-100"
                      >
                        <Download className="w-5 h-5 text-gray-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Export Orders
                          </p>
                          <p className="text-xs text-gray-500">
                            Basic order data CSV
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          exportStrategicReport();
                          setShowExportMenu(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3"
                      >
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Strategic Report
                          </p>
                          <p className="text-xs text-gray-500">
                            Full financial analysis
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto">
          {loading && orders.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No orders found
            </div>
          ) : (
            orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                selected={selectedOrder?.id === order.id}
                onClick={() => handleSelectOrder(order)}
              />
            ))
          )}
        </div>
      </div>

      {/* Order Details Panel */}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${
          showOrdersList ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedOrder ? (
          <>
            {/* Details Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleBackToList}
                  className="md:hidden p-2 hover:bg-gray-100 rounded"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Order #{selectedOrder.id}
                  </h2>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon(selectedOrder.status)}
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(
                        selectedOrder.status
                      )}`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteOrder(selectedOrder.id)}
                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded"
                title="Delete Order"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Details Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Financial Dashboard */}
              <FinancialDashboard summary={financialSummary} />

              {/* Customer Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Customer Name</p>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.customer_name}
                      </p>
                    </div>
                  </div>
                  {selectedOrder.email && (
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">
                          {selectedOrder.email}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">
                        {selectedOrder.location}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Order Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-gray-900">{selectedOrder.description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      Minimum Order Quantity
                    </p>
                    <p className="text-gray-900">{selectedOrder.moq}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Urgency</p>
                    <span
                      className={`inline-block text-xs px-3 py-1 rounded-full ${getUrgencyColor(
                        selectedOrder.urgency
                      )}`}
                    >
                      {selectedOrder.urgency} priority
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Created</p>
                    <p className="text-gray-900">
                      {new Date(selectedOrder.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Management */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Update Status
                </h3>
                <StatusUpdater
                  currentStatus={selectedOrder.status}
                  onUpdate={(status) =>
                    updateOrderStatus(selectedOrder.id, status)
                  }
                  loading={loading}
                />
              </div>

              {/* Pricing Section */}
              <PricingSection
                order={selectedOrder}
                isEditing={isEditingPricing}
                supplierPrice={supplierPrice}
                supplierDescription={supplierDescription}
                customerPrice={customerPrice}
                setSupplierPrice={setSupplierPrice}
                setSupplierDescription={setSupplierDescription}
                setCustomerPrice={setCustomerPrice}
                onSave={() => updatePricingInfo(selectedOrder.id)}
                onCancel={handleCancelEdit}
                loading={loading}
                onEdit={handleEditPricing}
              />

              {/* Images */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <ImageGallery images={parseImages(selectedOrder.images)} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No order selected</p>
              <p className="text-sm mt-2">
                Select an order from the list to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagementApp;
