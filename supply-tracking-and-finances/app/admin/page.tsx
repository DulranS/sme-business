"use client";
import React, { useState, useEffect, useCallback } from "react";
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
  Upload,
  FileDown,
  Wallet,
  Calculator,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  BarChart3,
  Users,
  Calendar,
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
  supplier_name?: string;
  supplier_price?: string;
  supplier_description?: string;
  customer_price?: string;
  last_contacted?: string; // NEW: for follow-ups
}

interface FinancialSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  completedOrders: number;
  pendingValue: number;
  inProgressValue: number;
  shippedValue: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  reinvestmentPool: number;
  averageOrderValue: number;
  averageProfit: number;
  // NEW METRICS
  grossMargin: number;
  cogs: number;
  roi: number;
  projectedCashFlow30Days: number;
  lowMarginOrders: number;
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
  supplier_name?: string;
}

// ------------------------
// Supabase Client (Enhanced)
// ------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const DISCORD_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_DISCORD_UPDATE_WEBHOOK_URL || "";

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

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Supabase error:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
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
            body: JSON.stringify(Array.isArray(data) ? data : [data]),
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
    ship: "bg-purple-100 text-purple-800 border-purple-300",
  };
  return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
};

const getStatusIcon = (status: Order["status"]) => {
  const icons: Record<Order["status"], React.ReactElement> = {
    pending: <AlertCircle className="w-4 h-4" />,
    "in-progress": <Loader className="w-4 h-4" />,
    completed: <CheckCircle className="w-4 h-4" />,
    cancelled: <XCircle className="w-4 h-4" />,
    ship: <Package className="w-4 h-4" />,
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
    console.warn("Failed to parse images JSON:", imagesJson);
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
    currency: "LKR",
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
  let shippedValue = 0;
  let cashInflow = 0;
  let cashOutflow = 0;
  let lowMarginOrders = 0;

  orders.forEach((order) => {
    const customerPrice = extractNumericValue(order.customer_price);
    const supplierPrice = extractNumericValue(order.supplier_price);
    const margin =
      customerPrice > 0 ? (customerPrice - supplierPrice) / customerPrice : 0;

    if (order.status === "completed") {
      totalRevenue += customerPrice;
      totalCost += supplierPrice;
      completedOrders++;
      cashInflow += customerPrice;
      cashOutflow += supplierPrice;
      if (margin < 0.2) lowMarginOrders++;
    } else if (order.status === "ship") {
      // Shipped = cost incurred, but revenue not yet realized
      totalCost += supplierPrice;
      cashOutflow += supplierPrice;
      shippedValue += customerPrice;
    } else if (order.status === "pending") {
      pendingValue += customerPrice;
    } else if (order.status === "in-progress") {
      inProgressValue += customerPrice;
    }
  });

  const totalProfit = totalRevenue - totalCost;
  const profitMargin =
    totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const grossMargin =
    totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const cogs = totalCost;
  const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const netCashFlow = cashInflow - cashOutflow;
  const reinvestmentPool = totalProfit > 0 ? totalProfit * 0.3 : 0;
  const averageOrderValue =
    completedOrders > 0 ? totalRevenue / completedOrders : 0;
  const averageProfit = completedOrders > 0 ? totalProfit / completedOrders : 0;

  // Projected cash flow: assume 50% of in-progress convert in 30 days
  const projectedCashFlow30Days =
    cashInflow + inProgressValue * 0.5 - shippedValue * 0.3;

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
  };
};

const getDaysSince = (dateString: string): number => {
  const created = new Date(dateString);
  const now = new Date();
  const diffTime = now.getTime() - created.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const sendOrderUpdateWebhook = async (order: Order, action: string) => {
  if (!DISCORD_WEBHOOK_URL) return;

  const payload = {
    username: "Order Bot",
    avatar_url: "https://i.imgur.com/AfFp7pu.png",
    content: `
**---------------------------------------------------------------------------------------**
📢 **Order Update Notification**
Action: ${action}
**Order #${order.id}** - ${order.customer_name}
Location: ${order.location}
Phone: ${order.phone}
MOQ: ${order.moq}
Urgency: ${order.urgency}
Description: ${order.description}
Status: ${order.status}
Created At: ${new Date(order.created_at).toLocaleString()}
Supplied By: ${order.supplier_name || "N/A"}
Supplier Price: ${order.supplier_price || "N/A"}
Customer Price: ${order.customer_price || "N/A"}
Supplier Description: ${order.supplier_description || "N/A"}
**---------------------------------------------------------------------------------------**
`,
  };

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to send Discord webhook:", err);
  }
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
    "ship",
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
          {status.replace("-", " ")}
        </button>
      ))}
    </div>
  );
};

// ------------------------
// Financial Dashboard Component (Enhanced)
// ------------------------
const FinancialDashboard: React.FC<{ summary: FinancialSummary }> = ({
  summary,
}) => {
  const operatingCashFlow = summary.totalProfit - summary.reinvestmentPool;
  const cashFlowHealth = summary.netCashFlow >= 0 ? "positive" : "negative";
  const marginHealth =
    summary.profitMargin >= 30
      ? "excellent"
      : summary.profitMargin >= 20
      ? "good"
      : "poor";

  return (
    <div className="space-y-6">
      {/* Alerts Banner */}
      {(summary.lowMarginOrders > 0 || summary.netCashFlow < 0) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Action Required
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                {summary.lowMarginOrders > 0 && (
                  <p>
                    ⚠️ {summary.lowMarginOrders} order(s) have profit margin
                    below 20%
                  </p>
                )}
                {summary.netCashFlow < 0 && (
                  <p>
                    ⚠️ Negative cash flow: {formatCurrency(summary.netCashFlow)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Financial Metrics */}
      {/* <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Calculator className="w-6 h-6 mr-2 text-blue-600" />
          Financial Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Revenue</span>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">{summary.completedOrders} orders</span>
              <span className="text-green-600 font-medium">Avg: {formatCurrency(summary.averageOrderValue)}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">COGS</span>
              <Wallet className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.cogs)}</p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">Cost of Goods Sold</span>
              <span className="text-red-600 font-medium">{summary.totalRevenue > 0 ? ((summary.cogs / summary.totalRevenue) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Gross Profit</span>
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(summary.totalProfit)}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-gray-500">{summary.grossMargin.toFixed(1)}% margin</span>
              <span className="text-blue-600 font-medium">ROI: {summary.roi.toFixed(1)}%</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Pipeline Value</span>
              <Package className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summary.pendingValue + summary.inProgressValue + summary.shippedValue)}
            </p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Pending:</span>
                <span className="font-medium text-amber-600">{formatCurrency(summary.pendingValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">In Progress:</span>
                <span className="font-medium text-blue-600">{formatCurrency(summary.inProgressValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipped:</span>
                <span className="font-medium text-purple-600">{formatCurrency(summary.shippedValue)}</span>
              </div>
            </div>
          </div>
        </div>
      </div> */}

      {/* Cash Flow Analysis */}
      {/* <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg border border-emerald-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-emerald-600" />
          Cash Flow & Forecast
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Cash Inflows</span>
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-600 text-lg">↓</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.cashInflow)}</p>
            <p className="text-xs text-gray-500 mt-1">Realized revenue</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Cash Outflows</span>
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-lg">↑</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.cashOutflow)}</p>
            <p className="text-xs text-gray-500 mt-1">Supplier payments</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Net Cash Flow</span>
              <div className={`w-8 h-8 rounded-full ${cashFlowHealth === "positive" ? "bg-green-100" : "bg-red-100"} flex items-center justify-center`}>
                <span className={`${cashFlowHealth === "positive" ? "text-green-600" : "text-red-600"} text-lg font-bold`}>
                  {cashFlowHealth === "positive" ? "+" : "-"}
                </span>
              </div>
            </div>
            <p className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(summary.netCashFlow)}
            </p>
            <p className={`text-xs mt-1 font-medium ${cashFlowHealth === "positive" ? "text-green-600" : "text-red-600"}`}>
              {cashFlowHealth === "positive" ? "Healthy" : "Needs attention"}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">30-Day Forecast</span>
              <BarChart3 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className={`text-2xl font-bold ${summary.projectedCashFlow30Days >= 0 ? "text-indigo-600" : "text-red-600"}`}>
              {formatCurrency(summary.projectedCashFlow30Days)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Projected net cash</p>
          </div>
        </div>
      </div> */}

      {/* Profit Distribution & Reinvestment */}
      {/* <div className="bg-gradient-to-br from-violet-50 to-purple-50 p-6 rounded-lg border border-violet-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <Calculator className="w-5 h-5 mr-2 text-violet-600" />
          Profit Allocation Strategy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Reinvestment Pool (30%)</span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(summary.reinvestmentPool)}</p>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">For growth</span>
                <span className="font-medium text-purple-600">30% of profit</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full" style={{ width: "30%" }} />
              </div>
            </div>
            <div className="mt-3 p-2 bg-purple-50 rounded text-xs text-gray-600">
              <span className="font-medium">Use for:</span> Marketing, inventory, expansion
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">Operating Cash (70%)</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(operatingCashFlow)}</p>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">For operations</span>
                <span className="font-medium text-blue-600">70% of profit</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full" style={{ width: "70%" }} />
              </div>
            </div>
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-gray-600">
              <span className="font-medium">Use for:</span> Salaries, expenses, reserves
            </div>
          </div>
        </div>

       
        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Profit Margin Health</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              marginHealth === "excellent" ? "bg-green-100 text-green-700" :
              marginHealth === "good" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {marginHealth === "excellent" ? "Excellent" : marginHealth === "good" ? "Good" : "Needs Improvement"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div className={`h-4 rounded-full ${
              marginHealth === "excellent" ? "bg-gradient-to-r from-green-400 to-green-600" :
              marginHealth === "good" ? "bg-gradient-to-r from-yellow-400 to-yellow-600" :
              "bg-gradient-to-r from-red-400 to-red-600"
            }`} style={{ width: `${Math.min(summary.profitMargin, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0%</span>
            <span>Target: ≥30%</span>
            <span>100%</span>
          </div>
        </div>
      </div> */}

      {/* Executive KPIs */}
      {/* <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-gray-600" />
          Executive KPIs
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Avg Order Value</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.averageOrderValue)}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Avg Profit/Order</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(summary.averageProfit)}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Gross Margin</p>
            <p className={`text-lg font-bold ${summary.grossMargin >= 30 ? "text-green-600" : summary.grossMargin >= 20 ? "text-yellow-600" : "text-red-600"}`}>
              {summary.grossMargin.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">ROI</p>
            <p className="text-lg font-bold text-blue-600">{summary.roi.toFixed(1)}%</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Low Margin Orders</p>
            <p className="text-lg font-bold text-red-600">{summary.lowMarginOrders}</p>
          </div>
        </div>
      </div> */}
    </div>
  );
};

// ------------------------
// Order Card Component (Enhanced)
// ------------------------
const OrderCard: React.FC<{
  order: Order;
  selected?: boolean;
  onClick: () => void;
}> = ({ order, selected, onClick }) => {
  const customerPrice = extractNumericValue(order.customer_price);
  const supplierPrice = extractNumericValue(order.supplier_price);
  const profit = customerPrice - supplierPrice;
  const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
  const daysSince = getDaysSince(order.created_at);
  const isAging = daysSince > 14 && order.status === "pending";
  const isLowMargin = margin < 20 && order.status === "completed";

  return (
    <div
      className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
        selected ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
      } ${
        order.urgency === "high" || isAging
          ? "bg-red-50"
          : isLowMargin
          ? "bg-yellow-50"
          : ""
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
        {new Date(order.created_at).toLocaleDateString()} • {daysSince}d ago
      </p>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span
            className={`text-xs px-2 py-1 rounded-full ${getUrgencyColor(
              order.urgency
            )}`}
          >
            {order.urgency}
          </span>
          {isAging && (
            <Clock className="w-3 h-3 text-red-500" />
          )}
          {isLowMargin && (
            <AlertTriangle
              className="w-3 h-3 text-yellow-500"
            />
          )}
        </div>
        {customerPrice > 0 && (
          <div className="text-xs">
            <span className="font-medium text-green-600">
              {formatCurrency(customerPrice)}
            </span>
            {supplierPrice > 0 && profit > 0 && (
              <span
                className={`ml-2 ${
                  margin < 20 ? "text-red-600" : "text-blue-600"
                }`}
              >
                +{formatCurrency(profit)} ({margin.toFixed(0)}%)
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
        {/* {images.map((image, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-800 mb-2">{image.name}</p>
            <div className="flex justify-center">
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-auto object-contain rounded-lg shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => openImage(image.url)}
                title="Click to view full size"
              />
            </div>
            <div className="mt-2 text-center">
              <button
                onClick={() => openImage(image.url)}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                View full size
              </button>
            </div>
          </div>
        ))} */}
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
  supplierName: string;
  supplierPrice: string;
  supplierDescription: string;
  customerPrice: string;
  setSupplierName: (val: string) => void;
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
  supplierName,
  supplierPrice,
  supplierDescription,
  customerPrice,
  setSupplierName,
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
              className="..."
              placeholder={
                "e.g., 8000 LKR"
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplied By (Supplier Name)
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., ABC Manufacturing"
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
            <div
              className={`p-3 rounded-lg border ${
                margin < 20
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <p className="text-sm font-medium text-gray-700 mb-1">
                Profit Calculation:
              </p>
              <p
                className={`text-lg font-bold ${
                  margin < 20 ? "text-red-600" : "text-blue-600"
                }`}
              >
                {formatCurrency(profit)} ({margin.toFixed(1)}% margin)
                {margin < 20 && (
                  <span className="ml-2 text-xs">(Below target)</span>
                )}
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
              <p className="text-xs text-gray-500 mb-1">Supplied By</p>
              <p className="text-2xl font-bold text-gray-900">
                {order.supplier_name || "Not set"}
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
            <div
              className={`bg-white p-4 rounded-lg border ${
                margin < 20 ? "border-red-200" : "border-blue-200"
              }`}
            >
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
                <p
                  className={`text-sm font-medium ${
                    margin < 20 ? "text-red-600" : "text-gray-700"
                  }`}
                >
                  {margin.toFixed(1)}%
                  {margin < 20 && <span className="ml-1">(Low)</span>}
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
  const [supplierName, setSupplierName] = useState("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [supplierDescription, setSupplierDescription] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const [filter, setFilter] = useState<"all" | "low-margin" | "aging">("all");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await supabase.from("orders").select("*").execute();
      const urgencyPriority = { high: 3, medium: 2, low: 1 };
      const sorted = data.sort((a, b) => {
        const urgencyDiff =
          urgencyPriority[b.urgency] - urgencyPriority[a.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setOrders(sorted);
    } catch (error) {
      console.error("Failed to load orders:", error);
      setOrders([]);
      alert("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const financialSummary = calculateFinancials(orders);

  const filteredOrders = orders.filter((order) => {
    if (filter === "low-margin") {
      const margin =
        order.customer_price && order.supplier_price
          ? (extractNumericValue(order.customer_price) -
              extractNumericValue(order.supplier_price)) /
            extractNumericValue(order.customer_price)
          : 0;
      return order.status === "completed" && margin < 0.2;
    }
    if (filter === "aging") {
      return order.status === "pending" && getDaysSince(order.created_at) > 14;
    }
    return true;
  });

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
      const updatedOrder = orders.find((o) => o.id === orderId);
      if (updatedOrder) {
        const newOrder = { ...updatedOrder, status };
        setOrders((prev) => prev.map((o) => (o.id === orderId ? newOrder : o)));
        if (selectedOrder?.id === orderId) setSelectedOrder(newOrder);
        await sendOrderUpdateWebhook(newOrder, "Status Updated");
      }
    } catch (error) {
      console.error("Status update error:", error);
      alert("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const updatePricingInfo = async (orderId: number) => {
    setLoading(true);
    try {
      // Only include fields that are non-empty strings
      const updatePayload: Partial<Order> = {};
      if (supplierName.trim() !== "")
        updatePayload.supplier_name = supplierName;
      if (supplierPrice.trim() !== "")
        updatePayload.supplier_price = supplierPrice;
      if (supplierDescription.trim() !== "")
        updatePayload.supplier_description = supplierDescription;
      if (customerPrice.trim() !== "")
        updatePayload.customer_price = customerPrice;

      // If all fields are empty, skip the update
      if (Object.keys(updatePayload).length === 0) {
        setIsEditingPricing(false);
        return;
      }

      await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId)
        .execute();

      // Optimistically update local state
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o))
      );

      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, ...updatePayload } : null
        );
      }

      setIsEditingPricing(false);
      alert("Pricing updated successfully");
      await sendOrderUpdateWebhook(
        { ...selectedOrder, ...updatePayload } as Order,
        "Pricing Updated"
      );
    } catch (error) {
      console.error("Pricing update error:", error);
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
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete order");
    } finally {
      setLoading(false);
    }
  };

  const handleCSVImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line);

        if (lines.length < 2) {
          alert("CSV must contain headers and at least one data row");
          return;
        }

        const headers = lines[0].split(",").map((h) =>
          h
            .trim()
            .replace(/^"(.*)"$/, "$1")
            .toLowerCase()
        );
        const newOrders: Partial<Order>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;

          // Handle quoted fields with commas
          const values: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === "," && !inQuotes) {
              values.push(current.trim().replace(/^"(.*)"$/, "$1"));
              current = "";
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"(.*)"$/, "$1"));

          if (values.length !== headers.length) {
            console.warn(`Skipping row ${i + 1}: column count mismatch`);
            continue;
          }

          const rowData: CSVRow = {};
          headers.forEach((header, index) => {
            if (values[index] !== undefined) {
              rowData[header as keyof CSVRow] = values[index] || undefined;
            }
          });

          if (
            !rowData.customer_name ||
            !rowData.phone ||
            !rowData.location ||
            !rowData.description ||
            !rowData.moq
          ) {
            console.warn(`Skipping row ${i + 1}: missing required fields`);
            continue;
          }

          const order: Partial<Order> = {
            customer_name: rowData.customer_name,
            email: rowData.email || undefined,
            phone: rowData.phone,
            location: rowData.location,
            description: rowData.description,
            moq: rowData.moq,
            urgency: (["low", "medium", "high"].includes(
              rowData.urgency?.toLowerCase() || ""
            )
              ? rowData.urgency?.toLowerCase()
              : "medium") as Order["urgency"],
            status: ([
              "pending",
              "in-progress",
              "completed",
              "cancelled",
              "ship",
            ].includes(rowData.status?.toLowerCase() || "")
              ? rowData.status?.toLowerCase()
              : "pending") as Order["status"],
            created_at: new Date().toISOString(),
            supplier_name: rowData.supplier_name || undefined,
            supplier_price: rowData.supplier_price || undefined,
            supplier_description: rowData.supplier_description || undefined,
            customer_price: rowData.customer_price || undefined,
            images: "[]",
          };
          newOrders.push(order);
        }

        if (newOrders.length === 0) {
          alert("No valid orders found in CSV");
          return;
        }

        setLoading(true);
        try {
          await supabase.from("orders").insert(newOrders).execute();
          await loadOrders();
          alert(`Successfully imported ${newOrders.length} order(s)`);
        } catch (error) {
          console.error("Import error:", error);
          alert(
            "Failed to import orders. Check CSV format and required fields."
          );
        } finally {
          setLoading(false);
        }
      } catch (error) {
        console.error("CSV parsing error:", error);
        alert("Error parsing CSV file");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const downloadCSVTemplate = () => {
    const template = [
      "customer_name,email,phone,location,description,moq,urgency,status,supplier_name,supplier_price,supplier_description,customer_price",
      '"John Doe","john@example.com","+1234567890","New York","Custom widgets order","1000 units","high","pending","ABC Supplier","5000 USD","Premium supplier with fast shipping","8000 USD"',
    ].join("\n");
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
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
      "Supplier Name",
      "Supplier Price",
      "Profit",
      "Margin %",
      "Supplier Description",
      "Created Date",
      "Days Since Created",
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
          `"${o.customer_name.replace(/"/g, '""')}"`,
          o.email ? `"${o.email.replace(/"/g, '""')}"` : "N/A",
          o.phone,
          `"${o.location.replace(/"/g, '""')}"`,
          `"${o.description.replace(/"/g, '""')}"`,
          `"${o.moq.replace(/"/g, '""')}"`,
          o.status,
          o.urgency,
          o.customer_price || "N/A",
          o.supplier_name || "N/A",
          o.supplier_price || "N/A",
          customerPrice > 0 && supplierPrice > 0 ? profit.toFixed(2) : "N/A",
          customerPrice > 0 && supplierPrice > 0 ? margin.toFixed(1) : "N/A",
          o.supplier_description
            ? `"${o.supplier_description.replace(/"/g, '""')}"`
            : "N/A",
          new Date(o.created_at).toLocaleDateString(),
          getDaysSince(o.created_at),
        ].join(",");
      }),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportStrategicReport = () => {
    const summary = financialSummary;
    const operatingCashFlow = summary.totalProfit - summary.reinvestmentPool;
    const date = new Date().toISOString().split("T")[0];
    const reportSections = [
      "STRATEGIC FINANCIAL REPORT",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "=== EXECUTIVE SUMMARY ===",
      `Total Revenue,${summary.totalRevenue.toFixed(2)}`,
      `Total Costs (COGS),${summary.cogs.toFixed(2)}`,
      `Gross Profit,${summary.totalProfit.toFixed(2)}`,
      `Gross Margin,${summary.grossMargin.toFixed(2)}%`,
      `Profit Margin,${summary.profitMargin.toFixed(2)}%`,
      `ROI,${summary.roi.toFixed(2)}%`,
      `Completed Orders,${summary.completedOrders}`,
      `Low Margin Orders (<20%),${summary.lowMarginOrders}`,
      "",
      "=== CASH FLOW ANALYSIS ===",
      `Cash Inflows (Realized Revenue),${summary.cashInflow.toFixed(2)}`,
      `Cash Outflows (Supplier Payments),${summary.cashOutflow.toFixed(2)}`,
      `Net Cash Flow,${summary.netCashFlow.toFixed(2)}`,
      `30-Day Projected Cash Flow,${summary.projectedCashFlow30Days.toFixed(
        2
      )}`,
      `Cash Flow Status,${
        summary.netCashFlow >= 0
          ? "POSITIVE - Healthy"
          : "NEGATIVE - Needs Attention"
      }`,
      "",
      "=== PROFIT ALLOCATION ===",
      `Reinvestment Pool (30%),${summary.reinvestmentPool.toFixed(2)}`,
      `Operating Cash (70%),${operatingCashFlow.toFixed(2)}`,
      "",
      "=== PIPELINE & FUTURE REVENUE ===",
      `Pending Orders Value,${summary.pendingValue.toFixed(2)}`,
      `In-Progress Orders Value,${summary.inProgressValue.toFixed(2)}`,
      `Shipped (Cost Incurred),${summary.shippedValue.toFixed(2)}`,
      `Total Pipeline Value,${(
        summary.pendingValue +
        summary.inProgressValue +
        summary.shippedValue
      ).toFixed(2)}`,
      "",
      "=== STRATEGIC RECOMMENDATIONS ===",
      `Priority 1,${
        summary.lowMarginOrders > 0
          ? `Review ${summary.lowMarginOrders} low-margin orders for repricing`
          : "Maintain current margin levels"
      }`,
      `Priority 2,${
        summary.netCashFlow < 0
          ? "Improve cash flow: negotiate supplier terms or accelerate collections"
          : "Maintain healthy cash flow"
      }`,
      `Priority 3,${
        summary.pendingValue > 0
          ? "Follow up on pending orders to convert to in-progress"
          : "Focus on new acquisition"
      }`,
      `Priority 4,${
        summary.reinvestmentPool > 0
          ? `Allocate ${formatCurrency(summary.reinvestmentPool)} for growth`
          : "Build profit base before investing"
      }`,
      "",
      "=== DETAILED ORDER BREAKDOWN ===",
      "Order ID,Customer,Status,Revenue,Cost,Profit,Margin %,Urgency,Days Old,Cash Impact",
    ];

    orders.forEach((o) => {
      const customerPrice = extractNumericValue(o.customer_price);
      const supplierPrice = extractNumericValue(o.supplier_price);
      const profit = customerPrice - supplierPrice;
      const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
      const daysOld = getDaysSince(o.created_at);
      const cashImpact =
        o.status === "completed"
          ? "Realized"
          : o.status === "ship"
          ? "Cost Incurred"
          : "Pending";

      reportSections.push(
        [
          o.id,
          `"${o.customer_name.replace(/"/g, '""')}"`,
          o.status,
          customerPrice > 0 ? customerPrice.toFixed(2) : "0",
          supplierPrice > 0 ? supplierPrice.toFixed(2) : "0",
          profit > 0 ? profit.toFixed(2) : "0",
          margin > 0 ? margin.toFixed(1) : "0",
          o.urgency,
          daysOld,
          cashImpact,
        ].join(",")
      );
    });

    reportSections.push("");
    reportSections.push("=== STATUS BREAKDOWN ===");
    reportSections.push("Status,Count,Revenue,Cost,Profit,Margin %");
    const statuses: Order["status"][] = [
      "pending",
      "in-progress",
      "completed",
      "cancelled",
      "ship",
    ];
    statuses.forEach((status) => {
      const statusOrders = orders.filter((o) => o.status === status);
      const rev = statusOrders.reduce(
        (sum, o) => sum + extractNumericValue(o.customer_price),
        0
      );
      const cost = statusOrders.reduce(
        (sum, o) => sum + extractNumericValue(o.supplier_price),
        0
      );
      const prof = rev - cost;
      const marg = rev > 0 ? (prof / rev) * 100 : 0;
      reportSections.push(
        [
          status,
          statusOrders.length,
          rev.toFixed(2),
          cost.toFixed(2),
          prof.toFixed(2),
          marg.toFixed(1),
        ].join(",")
      );
    });

    const csv = reportSections.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategic_report_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrdersList(false);
    setIsEditingPricing(false);
    setSupplierName(order.supplier_name || "");
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
      setSupplierName(selectedOrder.supplier_name || "");
      setSupplierPrice(selectedOrder.supplier_price || "");
      setSupplierDescription(selectedOrder.supplier_description || "");
      setCustomerPrice(selectedOrder.customer_price || "");
    }
  };

  const toggleGroup = (status: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const groupOrdersByStatus = () => {
    const groups: Record<string, Order[]> = {};
    filteredOrders.forEach((order) => {
      if (!groups[order.status]) groups[order.status] = [];
      groups[order.status].push(order);
    });
    return groups;
  };

  const groupedOrders = groupOrdersByStatus();

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
          <div>
            <h2 className="font-semibold text-gray-900">
              Orders ({filteredOrders.length})
            </h2>
            <div className="flex space-x-2 mt-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 text-xs rounded ${
                  filter === "all"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("low-margin")}
                className={`px-3 py-1 text-xs rounded flex items-center space-x-1 ${
                  filter === "low-margin"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Low Margin</span>
              </button>
              <button
                onClick={() => setFilter("aging")}
                className={`px-3 py-1 text-xs rounded flex items-center space-x-1 ${
                  filter === "aging"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Aging</span>
              </button>
            </div>
          </div>
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
                        <BarChart3 className="w-5 h-5 text-blue-600" />
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
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-4">
              <Package className="w-12 h-12 mb-2 text-gray-300" />
              <p className="text-center">
                {filter === "all"
                  ? "No orders found"
                  : `No ${filter} orders found`}
              </p>
              {filter !== "all" && (
                <button
                  onClick={() => setFilter("all")}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  View all orders
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedOrders).map(([status, groupOrders]) => (
              <div key={status} className="border-b border-gray-100">
                <div
                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                  onClick={() => toggleGroup(status)}
                >
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(status as Order["status"])}
                    <span className="font-medium text-gray-800 capitalize">
                      {status.replace("-", " ")} ({groupOrders.length})
                    </span>
                  </div>
                  {collapsedGroups[status] ? (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                {!collapsedGroups[status] && (
                  <div>
                    {groupOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        selected={selectedOrder?.id === order.id}
                        onClick={() => handleSelectOrder(order)}
                      />
                    ))}
                  </div>
                )}
              </div>
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

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <FinancialDashboard summary={financialSummary} />

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Users className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
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
                  <div className="flex items-start">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">
                        Days Since Created
                      </p>
                      <p className="font-medium text-gray-900">
                        {getDaysSince(selectedOrder.created_at)} days
                      </p>
                      {getDaysSince(selectedOrder.created_at) > 14 &&
                        selectedOrder.status === "pending" && (
                          <p className="text-xs text-red-600 mt-1 flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> Follow up needed!
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>

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

              <PricingSection
                order={selectedOrder}
                isEditing={isEditingPricing}
                supplierName={supplierName}
                supplierPrice={supplierPrice}
                supplierDescription={supplierDescription}
                customerPrice={customerPrice}
                setSupplierName={setSupplierName}
                setSupplierPrice={setSupplierPrice}
                setSupplierDescription={setSupplierDescription}
                setCustomerPrice={setCustomerPrice}
                onSave={() => updatePricingInfo(selectedOrder.id)}
                onCancel={handleCancelEdit}
                loading={loading}
                onEdit={handleEditPricing}
              />

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
              <p className="text-sm mt-2">Select an order to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderManagementApp;
