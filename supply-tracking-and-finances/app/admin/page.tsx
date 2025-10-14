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
  Truck,
  MapPin,
  RotateCcw,
  Warehouse,
  Timer,
  Copy,
  Tag,
  Users2,
  Shield,
  Award,
} from "lucide-react";
import Link from "next/link";

// ------------------------
// TypeScript Types (Enhanced)
// ------------------------
interface OrderImage {
  name: string;
  url: string;
}

interface SupplierBid {
  supplier_name: string;
  price: string; // e.g., "5000 USD"
  notes?: string;
  submitted_at: string; // ISO
  lead_time_days?: number;
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
  last_contacted?: string;
  inventory_status?: "in-stock" | "low-stock" | "out-of-stock" | "reorder-needed";
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  refund_status?: "none" | "requested" | "approved" | "processed";
  logistics_cost?: string;
  supplier_lead_time_days?: number;
  route_optimized?: boolean;
  category?: string;
  bids?: string;
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
  grossMargin: number;
  cogs: number;
  roi: number;
  projectedCashFlow30Days: number;
  lowMarginOrders: number;
  totalLogisticsCost: number;
  onTimeDeliveryRate: number;
  inventoryTurnover: number;
  avgSupplierLeadTime: number;
  refundRate: number;
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
  inventory_status?: string;
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  actual_delivery?: string;
  refund_status?: string;
  logistics_cost?: string;
  supplier_lead_time_days?: string;
  route_optimized?: string;
  category?: string;
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
const parseCategories = (categoryString?: string): string[] => {
  if (!categoryString) return [];
  return categoryString
    .split(",")
    .map((cat) => cat.trim())
    .filter(Boolean);
};
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

const getInventoryColor = (inv: Order["inventory_status"]) => {
  const map: Record<string, string> = {
    "in-stock": "bg-green-100 text-green-800",
    "low-stock": "bg-yellow-100 text-yellow-800",
    "out-of-stock": "bg-red-100 text-red-800",
    "reorder-needed": "bg-orange-100 text-orange-800",
  };
  return map[inv || ""] || "bg-gray-100 text-gray-800";
};

const parseImages = (imagesJson: string): OrderImage[] => {
  try {
    return JSON.parse(imagesJson || "[]");
  } catch {
    console.warn("Failed to parse images JSON:", imagesJson);
    return [];
  }
};

const parseBids = (bidsJson: string): SupplierBid[] => {
  try {
    return JSON.parse(bidsJson || "[]");
  } catch {
    console.warn("Failed to parse bids JSON:", bidsJson);
    return [];
  }
};

const extractNumericValue = (priceString?: any): number => {
  if (priceString == null) return 0;
  const str = String(priceString);
  const match = str.match(/[\d,]+\.?\d*/);
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
  let totalLogisticsCost = 0;
  let onTimeDeliveries = 0;
  let totalDeliveries = 0;
  let totalLeadTime = 0;
  let supplierCount = 0;
  let refunds = 0;

  orders.forEach((order) => {
    const customerPrice = extractNumericValue(order.customer_price);
    const supplierPrice = extractNumericValue(order.supplier_price);
    const logisticsCost = extractNumericValue(order.logistics_cost);
    const margin =
      customerPrice > 0 ? (customerPrice - supplierPrice) / customerPrice : 0;

    if (order.status === "completed") {
      totalRevenue += customerPrice;
      totalCost += supplierPrice;
      completedOrders++;
      cashInflow += customerPrice;
      cashOutflow += supplierPrice + logisticsCost;
      totalLogisticsCost += logisticsCost;
      if (margin < 0.2) lowMarginOrders++;
      if (order.estimated_delivery && order.actual_delivery) {
        totalDeliveries++;
        if (new Date(order.actual_delivery) <= new Date(order.estimated_delivery)) {
          onTimeDeliveries++;
        }
      }
      if (order.supplier_lead_time_days) {
        totalLeadTime += order.supplier_lead_time_days;
        supplierCount++;
      }
      if (order.refund_status && order.refund_status !== "none") {
        refunds++;
      }
    } else if (order.status === "ship") {
      totalCost += supplierPrice + logisticsCost;
      cashOutflow += supplierPrice + logisticsCost;
      totalLogisticsCost += logisticsCost;
      shippedValue += customerPrice;
    } else if (order.status === "pending") {
      pendingValue += customerPrice;
    } else if (order.status === "in-progress") {
      inProgressValue += customerPrice;
    }
  });

  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
  const cogs = totalCost;
  const roi = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const netCashFlow = cashInflow - cashOutflow;
  const reinvestmentPool = totalProfit > 0 ? totalProfit * 0.3 : 0;
  const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;
  const averageProfit = completedOrders > 0 ? totalProfit / completedOrders : 0;
  const projectedCashFlow30Days = cashInflow + inProgressValue * 0.5 - shippedValue * 0.3;
  const onTimeDeliveryRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0;
  const avgSupplierLeadTime = supplierCount > 0 ? totalLeadTime / supplierCount : 0;
  const refundRate = completedOrders > 0 ? (refunds / completedOrders) * 100 : 0;
  const inventoryTurnover = completedOrders > 0 ? totalRevenue / (totalCost || 1) : 0;

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
    totalLogisticsCost,
    onTimeDeliveryRate,
    inventoryTurnover,
    avgSupplierLeadTime,
    refundRate,
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
Category: ${order.category || "N/A"}
Inventory: ${order.inventory_status || "N/A"}
Shipping: ${order.shipping_carrier || "N/A"} | ${order.tracking_number || "N/A"}
Est. Delivery: ${order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : "N/A"}
Refund: ${order.refund_status || "None"}
Created At: ${new Date(order.created_at).toLocaleString()}
Supplied By: ${order.supplier_name || "N/A"}
Supplier Price: ${order.supplier_price || "N/A"}
Customer Price: ${order.customer_price || "N/A"}
Logistics Cost: ${order.logistics_cost || "N/A"}
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
// Financial Dashboard Component
// ------------------------
const FinancialDashboard: React.FC<{ summary: FinancialSummary }> = ({
  summary,
}) => {
  return (
    <div className="space-y-6">
      {(summary.lowMarginOrders > 0 ||
        summary.netCashFlow < 0 ||
        summary.refundRate > 10 ||
        summary.onTimeDeliveryRate < 90) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                Action Required
              </h3>
              <div className="mt-2 text-sm text-yellow-700 space-y-1">
                {summary.lowMarginOrders > 0 && (
                  <p>
                    ⚠️ {summary.lowMarginOrders} order(s) have profit margin below 20%
                  </p>
                )}
                {summary.netCashFlow < 0 && (
                  <p>
                    ⚠️ Negative cash flow: {formatCurrency(summary.netCashFlow)}
                  </p>
                )}
                {summary.refundRate > 10 && (
                  <p>⚠️ High refund rate: {summary.refundRate.toFixed(1)}%</p>
                )}
                {summary.onTimeDeliveryRate < 90 && (
                  <p>
                    ⚠️ On-time delivery rate: {summary.onTimeDeliveryRate.toFixed(1)}% (below 90%)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-gray-600" />
          Strategic Performance Indicators
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">On-Time Delivery</p>
            <p className={`text-lg font-bold ${
              summary.onTimeDeliveryRate >= 90 ? "text-green-600" : "text-red-600"
            }`}>
              {summary.onTimeDeliveryRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Avg Lead Time</p>
            <p className="text-lg font-bold text-blue-600">
              {summary.avgSupplierLeadTime.toFixed(1)} days
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Refund Rate</p>
            <p className={`text-lg font-bold ${
              summary.refundRate > 10 ? "text-red-600" : "text-green-600"
            }`}>
              {summary.refundRate.toFixed(1)}%
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Logistics Cost</p>
            <p className="text-lg font-bold text-purple-600">
              {formatCurrency(summary.totalLogisticsCost)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Inventory Turnover</p>
            <p className="text-lg font-bold text-indigo-600">
              {summary.inventoryTurnover.toFixed(2)}x
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
      <p className="text-sm text-gray-600 mb-1">{order.moq}</p>
{parseCategories(order.category).map((cat, idx) => (
  <span
    key={idx}
    className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 mr-1"
  >
    {cat}
  </span>
))}
      <p className="text-xs text-gray-500 mt-1">
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
          {isAging && <Clock className="w-3 h-3 text-red-500" />}
          {isLowMargin && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
          {order.refund_status && order.refund_status !== "none" && (
            <RotateCcw className="w-3 h-3 text-red-500" />
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
        {images.map((image, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-800 mb-2">{image.name}</p>
            <div className="flex justify-center">
              <img
                src={image.url}
                alt={image.name}
                className="h-80 object-cover rounded border cursor-pointer hover:opacity-80"
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
        ))}
      </div>
    </div>
  );
};


// ------------------------
// Supplier Bidding Section (ENHANCED WITH APPROVAL LOCK)
// ------------------------
const SupplierBiddingSection: React.FC<{
  order: Order;
  onBidSubmit: (bid: Omit<SupplierBid, "submitted_at">) => void;
  onApproveBid: (bid: SupplierBid, password: string) => void;
  customerPrice: number;
}> = ({ order, onBidSubmit, onApproveBid, customerPrice }) => {
  const [supplierName, setSupplierName] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState<SupplierBid | null>(null);
  const [password, setPassword] = useState("");

  // ✅ Check if supplier is already approved
  const isAlreadyApproved = !!order.supplier_name || order.status !== "pending";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName || !price) return;
    setIsSubmitting(true);
    onBidSubmit({
      supplier_name: supplierName,
      price,
      notes,
      lead_time_days: leadTime ? parseInt(leadTime, 10) : undefined,
    });
    setSupplierName("");
    setPrice("");
    setNotes("");
    setLeadTime("");
    setIsSubmitting(false);
  };

  const bids = parseBids(order.bids || "[]");
  const publicLink = `${window.location.origin}/bid/${order.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicLink);
    alert("Public bidding link copied to clipboard!");
  };

  const handleApprove = () => {
    if (showApprovalModal) {
      onApproveBid(showApprovalModal, password);
      setShowApprovalModal(null);
      setPassword("");
    }
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
          <Users2 className="w-5 h-5 text-amber-600" />
          <span>Supplier Bidding</span>
        </h3>
        {!isAlreadyApproved && (
          <button
            onClick={copyToClipboard}
            className="flex items-center text-amber-700 hover:text-amber-900 text-sm"
          >
            <Copy className="w-4 h-4 mr-1" />
            Copy Public Link
          </button>
        )}
      </div>

      {isAlreadyApproved ? (
        <div className="mb-4 p-3 bg-green-100 rounded border border-green-300">
          <p className="text-sm font-medium text-green-800 flex items-center">
            <CheckCircle className="w-4 h-4 mr-2" />
            Supplier already approved: <span className="font-bold ml-1">{order.supplier_name}</span>
          </p>
          <p className="text-xs text-green-700 mt-1">
            Bidding is closed for this order.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 p-3 bg-white rounded border border-amber-200">
            <p className="text-sm text-gray-700 mb-1">Share this link with suppliers:</p>
            <code className="text-xs bg-gray-100 p-2 rounded break-all">{publicLink}</code>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 mb-6">
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Your Company Name"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500"
              required
              disabled={isAlreadyApproved}
            />
            <input
              type="text"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Your Price (e.g., 5000 USD)"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500"
              required
              disabled={isAlreadyApproved}
            />
            <input
              type="number"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
              placeholder="Lead Time (days)"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500"
              disabled={isAlreadyApproved}
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes (MOQ, terms, etc.)"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500"
              rows={2}
              disabled={isAlreadyApproved}
            />
            <button
              type="submit"
              disabled={isSubmitting || isAlreadyApproved}
              className={`px-4 py-2 rounded text-sm w-full ${
                isAlreadyApproved
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-amber-600 text-white hover:bg-amber-700"
              }`}
            >
              {isAlreadyApproved ? "Bidding Closed" : isSubmitting ? "Submitting..." : "Submit Bid"}
            </button>
          </form>
        </>
      )}

      {bids.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-3 flex items-center">
            <Award className="w-4 h-4 mr-2 text-amber-600" />
            Received Bids ({bids.length})
          </h4>
          <div className="space-y-3">
            {bids.map((bid, i) => {
              const bidPrice = extractNumericValue(bid.price);
              const margin = customerPrice > 0 && bidPrice > 0 ? ((customerPrice - bidPrice) / customerPrice) * 100 : 0;
              const isHighMargin = margin >= 30;
              const isLowMargin = margin > 0 && margin < 20;

              return (
                <div
                  key={i}
                  className={`bg-white p-4 rounded-lg border ${
                    isHighMargin ? "border-green-300" : isLowMargin ? "border-red-300" : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-900">{bid.supplier_name}</div>
                      <div className="text-lg font-semibold text-green-600 mt-1">{bid.price}</div>
                      {bid.lead_time_days && (
                        <div className="text-sm text-gray-600 mt-1">Lead Time: {bid.lead_time_days} days</div>
                      )}
                      {bid.notes && <div className="text-sm text-gray-600 mt-1">{bid.notes}</div>}
                      <div className="text-xs text-gray-500 mt-2">
                        Submitted: {new Date(bid.submitted_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      {customerPrice > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Margin:</span>{" "}
                          <span
                            className={`font-bold ${
                              isHighMargin ? "text-green-600" : isLowMargin ? "text-red-600" : "text-blue-600"
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </div>
                      )}
                      {!isAlreadyApproved && (
                        <button
                          onClick={() => setShowApprovalModal(bid)}
                          className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center"
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Approve as Supplier
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-4">Approve Supplier</h3>
            <p className="mb-3">
              Approve <span className="font-semibold">{showApprovalModal.supplier_name}</span> at{" "}
              <span className="font-semibold">{showApprovalModal.price}</span>?
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password: veloxalbaka"
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowApprovalModal(null)}
                className="px-4 py-2 bg-gray-300 rounded text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={password !== "veloxalbaka"}
                className={`px-4 py-2 rounded text-white ${
                  password === "veloxalbaka" ? "bg-green-600 hover:bg-green-700" : "bg-gray-400"
                }`}
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------
// Pricing Section Component
// ------------------------
// ------------------------
// Pricing Section Component (WITH SUPPLIER REMOVAL + PASSWORD)
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
  onRemoveSupplier?: (password: string) => void; // NEW
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
  onRemoveSupplier,
}) => {
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removePassword, setRemovePassword] = useState("");

  const handleRemove = () => {
    if (onRemoveSupplier) {
      onRemoveSupplier(removePassword);
      setRemovePassword("");
      setShowRemoveModal(false);
    }
  };

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
        <div className="flex space-x-2">
          {order.supplier_name && !isEditing && (
            <button
              onClick={() => setShowRemoveModal(true)}
              className="text-red-600 hover:text-red-800 flex items-center space-x-1 text-sm"
            >
              <X className="w-4 h-4" />
              <span>Remove Supplier</span>
            </button>
          )}
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
              placeholder="e.g., 8000 LKR"
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
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Logistics Cost</p>
              <p className="text-2xl font-bold text-purple-600">
                {order.logistics_cost || "Not set"}
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

      {/* Remove Supplier Modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="font-bold text-lg mb-3 text-red-600">Remove Supplier?</h3>
            <p className="mb-4 text-sm text-gray-700">
              You are about to remove <span className="font-semibold">{order.supplier_name}</span> as the supplier for this order. This cannot be undone.
            </p>
            <input
              type="password"
              value={removePassword}
              onChange={(e) => setRemovePassword(e.target.value)}
              placeholder="Enter admin password: veloxalbaka"
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRemoveModal(false)}
                className="px-4 py-2 bg-gray-300 rounded text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removePassword !== "veloxalbaka"}
                className={`px-4 py-2 rounded text-white ${
                  removePassword === "veloxalbaka" ? "bg-red-600 hover:bg-red-700" : "bg-gray-400"
                }`}
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------
// Logistics & Inventory Section
// ------------------------
const LogisticsSection: React.FC<{
  order: Order;
  isEditing: boolean;
  inventoryStatus: string;
  shippingCarrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
  actualDelivery: string;
  refundStatus: string;
  logisticsCost: string;
  supplierLeadTime: string;
  routeOptimized: boolean;
  setInventoryStatus: (val: string) => void;
  setShippingCarrier: (val: string) => void;
  setTrackingNumber: (val: string) => void;
  setEstimatedDelivery: (val: string) => void;
  setActualDelivery: (val: string) => void;
  setRefundStatus: (val: string) => void;
  setLogisticsCost: (val: string) => void;
  setSupplierLeadTime: (val: string) => void;
  setRouteOptimized: (val: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  loading: boolean;
  onEdit: () => void;
}> = ({
  order,
  isEditing,
  inventoryStatus,
  shippingCarrier,
  trackingNumber,
  estimatedDelivery,
  actualDelivery,
  refundStatus,
  logisticsCost,
  supplierLeadTime,
  routeOptimized,
  setInventoryStatus,
  setShippingCarrier,
  setTrackingNumber,
  setEstimatedDelivery,
  setActualDelivery,
  setRefundStatus,
  setLogisticsCost,
  setSupplierLeadTime,
  setRouteOptimized,
  onSave,
  onCancel,
  loading,
  onEdit,
}) => {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
          <Truck className="w-5 h-5 text-purple-600" />
          <span>Logistics & Inventory</span>
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
              Inventory Status
            </label>
            <select
              value={inventoryStatus}
              onChange={(e) => setInventoryStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
              <option value="reorder-needed">Reorder Needed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shipping Carrier
            </label>
            <input
              type="text"
              value={shippingCarrier}
              onChange={(e) => setShippingCarrier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., DHL, FedEx"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tracking Number
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Delivery (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={estimatedDelivery}
              onChange={(e) => setEstimatedDelivery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Actual Delivery (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={actualDelivery}
              onChange={(e) => setActualDelivery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refund Status
            </label>
            <select
              value={refundStatus}
              onChange={(e) => setRefundStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="none">None</option>
              <option value="requested">Requested</option>
              <option value="approved">Approved</option>
              <option value="processed">Processed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logistics Cost
            </label>
            <input
              type="text"
              value={logisticsCost}
              onChange={(e) => setLogisticsCost(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1200 LKR"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier Lead Time (days)
            </label>
            <input
              type="number"
              value={supplierLeadTime}
              onChange={(e) => setSupplierLeadTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 5"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="routeOptimized"
              checked={routeOptimized}
              onChange={(e) => setRouteOptimized(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="routeOptimized" className="ml-2 text-sm text-gray-700">
              Route Optimized
            </label>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onSave}
              disabled={loading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center space-x-2 disabled:opacity-50 text-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save Logistics</span>
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
              <p className="text-xs text-gray-500 mb-1">Inventory</p>
              <span className={`text-sm font-medium px-2 py-1 rounded-full ${getInventoryColor(inventoryStatus as any)}`}>
                {inventoryStatus || "Not set"}
              </span>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Shipping Carrier</p>
              <p className="text-gray-900">{shippingCarrier || "N/A"}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Tracking #</p>
              <p className="text-gray-900">{trackingNumber || "N/A"}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Est. Delivery</p>
              <p className="text-gray-900">
                {estimatedDelivery ? new Date(estimatedDelivery).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Actual Delivery</p>
              <p className="text-gray-900">
                {actualDelivery ? new Date(actualDelivery).toLocaleDateString() : "N/A"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Refund Status</p>
              <p className="text-gray-900">{refundStatus || "None"}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Logistics Cost</p>
              <p className="text-2xl font-bold text-purple-600">
                {logisticsCost || "Not set"}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Lead Time</p>
              <p className="text-gray-900">{supplierLeadTime ? `${supplierLeadTime} days` : "N/A"}</p>
            </div>
          </div>
          {routeOptimized && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <p className="text-sm text-green-700 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Route optimized for delivery efficiency
              </p>
            </div>
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
  const [isEditingLogistics, setIsEditingLogistics] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  // Pricing state
  const [supplierName, setSupplierName] = useState("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [supplierDescription, setSupplierDescription] = useState("");
  const [customerPrice, setCustomerPrice] = useState("");
  // Logistics state
  const [inventoryStatus, setInventoryStatus] = useState("");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimatedDelivery, setEstimatedDelivery] = useState("");
  const [actualDelivery, setActualDelivery] = useState("");
  const [refundStatus, setRefundStatus] = useState("none");
  const [logisticsCost, setLogisticsCost] = useState("");
  const [supplierLeadTime, setSupplierLeadTime] = useState("");
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "low-margin" | "aging" | "refund">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

const loadOrders = useCallback(async () => {
  setLoading(true);
  try {
    const data = await supabase.from("orders").select("*").execute();
    const urgencyPriority = { high: 3, medium: 2, low: 1 };
    const sorted = data.sort((a, b) => {
      const urgencyDiff = urgencyPriority[b.urgency] - urgencyPriority[a.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setOrders(sorted);

    // ✅ Extract all unique categories from comma-separated strings
    const allCats = sorted.flatMap((o) => parseCategories(o.category));
    const uniqueCats = Array.from(new Set(allCats));
    setAvailableCategories(uniqueCats);
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
      const orderCategories = parseCategories(order.category);

  // Category filter: match if "all" OR if selected category is in order's categories
  if (categoryFilter !== "all" && !orderCategories.includes(categoryFilter)) {
    return false;
  }
    if (filter === "low-margin") {
      const margin =
        order.customer_price && order.supplier_price
          ? (extractNumericValue(order.customer_price) - extractNumericValue(order.supplier_price)) /
            extractNumericValue(order.customer_price)
          : 0;
      return order.status === "completed" && margin < 0.2;
    }
    if (filter === "aging") {
      return order.status === "pending" && getDaysSince(order.created_at) > 14;
    }
    if (filter === "refund") {
      return order.refund_status && order.refund_status !== "none";
    }
    return true;
  });

  const updateOrderStatus = async (orderId: number, status: Order["status"]) => {
    setLoading(true);
    try {
      await supabase.from("orders").update({ status }).eq("id", orderId).execute();
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
      const updatePayload: Partial<Order> = {};
      if (supplierName.trim() !== "") updatePayload.supplier_name = supplierName;
      if (supplierPrice.trim() !== "") updatePayload.supplier_price = supplierPrice;
      if (supplierDescription.trim() !== "") updatePayload.supplier_description = supplierDescription;
      if (customerPrice.trim() !== "") updatePayload.customer_price = customerPrice;
      if (Object.keys(updatePayload).length === 0) {
        setIsEditingPricing(false);
        return;
      }
      await supabase.from("orders").update(updatePayload).eq("id", orderId).execute();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }
      setIsEditingPricing(false);
      alert("Pricing updated successfully");
      await sendOrderUpdateWebhook({ ...selectedOrder, ...updatePayload } as Order, "Pricing Updated");
    } catch (error) {
      console.error("Pricing update error:", error);
      alert("Failed to update pricing");
    } finally {
      setLoading(false);
    }
  };

  const updateLogisticsInfo = async (orderId: number) => {
    setLoading(true);
    try {
      const updatePayload: Partial<Order> = {};
      if (inventoryStatus) updatePayload.inventory_status = inventoryStatus as any;
      if (shippingCarrier) updatePayload.shipping_carrier = shippingCarrier;
      if (trackingNumber) updatePayload.tracking_number = trackingNumber;
      if (estimatedDelivery) updatePayload.estimated_delivery = estimatedDelivery;
      if (actualDelivery) updatePayload.actual_delivery = actualDelivery;
      if (refundStatus !== "none") updatePayload.refund_status = refundStatus as any;
      if (logisticsCost) updatePayload.logistics_cost = logisticsCost;
      if (supplierLeadTime) updatePayload.supplier_lead_time_days = parseInt(supplierLeadTime, 10);
      updatePayload.route_optimized = routeOptimized;
      await supabase.from("orders").update(updatePayload).eq("id", orderId).execute();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }
      setIsEditingLogistics(false);
      alert("Logistics updated successfully");
      await sendOrderUpdateWebhook({ ...selectedOrder, ...updatePayload } as Order, "Logistics Updated");
    } catch (error) {
      console.error("Logistics update error:", error);
      alert("Failed to update logistics info");
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (orderId: number) => {
    setLoading(true);
    try {
      const updatePayload: Partial<Order> = { category: categoryInput || undefined };
      await supabase.from("orders").update(updatePayload).eq("id", orderId).execute();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }
      setIsEditingCategory(false);
      await loadOrders();
      alert("Category updated");
    } catch (error) {
      console.error("Category update error:", error);
      alert("Failed to update category");
    } finally {
      setLoading(false);
    }
  };

  const submitSupplierBid = async (orderId: number, bidData: Omit<SupplierBid, "submitted_at">) => {
    try {
      const existingBids = parseBids(selectedOrder?.bids || "[]");
      const newBid: SupplierBid = {
        ...bidData,
        submitted_at: new Date().toISOString(),
      };
      const updatedBids = [...existingBids, newBid];
      const updatePayload = { bids: JSON.stringify(updatedBids) };
      await supabase.from("orders").update(updatePayload).eq("id", orderId).execute();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }
      alert("Bid submitted successfully!");
    } catch (err) {
      console.error("Bid submission error:", err);
      alert("Failed to submit bid");
    }
  };

  const approveSupplierBid = async (orderId: number, bid: SupplierBid, password: string) => {
    if (password !== "veloxalbaka") {
      alert("Incorrect password. Supplier not approved.");
      return;
    }
    try {
      const updatePayload: Partial<Order> = {
        supplier_name: bid.supplier_name,
        supplier_price: bid.price,
        supplier_description: bid.notes || "",
        supplier_lead_time_days: bid.lead_time_days,
        status: "in-progress",
      };
      await supabase.from("orders").update(updatePayload).eq("id", orderId).execute();
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updatePayload } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatePayload } : null));
      }
      alert(`Supplier ${bid.supplier_name} approved successfully!`);
      await sendOrderUpdateWebhook({ ...selectedOrder, ...updatePayload } as Order, "Supplier Approved");
    } catch (err) {
      console.error("Supplier approval error:", err);
      alert("Failed to approve supplier");
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

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line);
        if (lines.length < 2) {
          alert("CSV must contain headers and at least one data row");
          return;
        }
        const headers = lines[0].split(",").map((h) =>
          h.trim().replace(/^"(.*)"$/, "$1").toLowerCase()
        );
        const newOrders: Partial<Order>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
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
          if (!rowData.customer_name || !rowData.phone || !rowData.location || !rowData.description || !rowData.moq) {
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
            urgency: (["low", "medium", "high"].includes(rowData.urgency?.toLowerCase() || "")
              ? rowData.urgency?.toLowerCase()
              : "medium") as Order["urgency"],
            status: (["pending", "in-progress", "completed", "cancelled", "ship"].includes(rowData.status?.toLowerCase() || "")
              ? rowData.status?.toLowerCase()
              : "pending") as Order["status"],
            created_at: new Date().toISOString(),
            supplier_name: rowData.supplier_name || undefined,
            supplier_price: rowData.supplier_price || undefined,
            supplier_description: rowData.supplier_description || undefined,
            customer_price: rowData.customer_price || undefined,
            images: "[]",
            inventory_status: rowData.inventory_status as any,
            shipping_carrier: rowData.shipping_carrier,
            tracking_number: rowData.tracking_number,
            estimated_delivery: rowData.estimated_delivery,
            actual_delivery: rowData.actual_delivery,
            refund_status: rowData.refund_status as any,
            logistics_cost: rowData.logistics_cost,
            supplier_lead_time_days: rowData.supplier_lead_time_days ? parseInt(rowData.supplier_lead_time_days, 10) : undefined,
            route_optimized: rowData.route_optimized?.toLowerCase() === "true",
            category: rowData.category || undefined,
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
          alert("Failed to import orders. Check CSV format and required fields.");
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
      "customer_name,email,phone,location,description,moq,urgency,status,supplier_name,supplier_price,supplier_description,customer_price,inventory_status,shipping_carrier,tracking_number,estimated_delivery,actual_delivery,refund_status,logistics_cost,supplier_lead_time_days,route_optimized,category",
      '"John Doe","john@example.com","+1234567890","New York","Custom widgets","1000 units","high","pending","ABC Supplier","5000 USD","Fast shipping","8000 USD","in-stock","DHL","123456789","2024-07-10","","none","1200 LKR","5","true","Electronics"',
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
      "Order ID","Customer Name","Email","Phone","Location","Description","MOQ","Status","Urgency","Category",
      "Customer Price","Supplier Name","Supplier Price","Profit","Margin %","Inventory Status",
      "Shipping Carrier","Tracking #","Est. Delivery","Actual Delivery","Refund Status",
      "Logistics Cost","Lead Time (days)","Route Optimized","Created Date","Days Since Created"
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
          o.category || "N/A",
          o.customer_price || "N/A",
          o.supplier_name || "N/A",
          o.supplier_price || "N/A",
          customerPrice > 0 && supplierPrice > 0 ? profit.toFixed(2) : "N/A",
          customerPrice > 0 && supplierPrice > 0 ? margin.toFixed(1) : "N/A",
          o.inventory_status || "N/A",
          o.shipping_carrier || "N/A",
          o.tracking_number || "N/A",
          o.estimated_delivery ? new Date(o.estimated_delivery).toISOString().split("T")[0] : "N/A",
          o.actual_delivery ? new Date(o.actual_delivery).toISOString().split("T")[0] : "N/A",
          o.refund_status || "none",
          o.logistics_cost || "N/A",
          o.supplier_lead_time_days || "N/A",
          o.route_optimized ? "true" : "false",
          new Date(o.created_at).toISOString().split("T")[0],
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
    const date = new Date().toISOString().split("T")[0];
    const reportSections = [
      "STRATEGIC OPERATIONS & FINANCIAL REPORT",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      "=== EXECUTIVE SUMMARY ===",
      `Total Revenue,${summary.totalRevenue.toFixed(2)}`,
      `Total Costs (COGS + Logistics),${summary.totalCost.toFixed(2)}`,
      `Gross Profit,${summary.totalProfit.toFixed(2)}`,
      `Gross Margin,${summary.grossMargin.toFixed(2)}%`,
      `On-Time Delivery Rate,${summary.onTimeDeliveryRate.toFixed(2)}%`,
      `Refund Rate,${summary.refundRate.toFixed(2)}%`,
      `Avg Supplier Lead Time,${summary.avgSupplierLeadTime.toFixed(2)} days`,
      `Inventory Turnover,${summary.inventoryTurnover.toFixed(2)}x`,
      "",
      "=== LOGISTICS PERFORMANCE ===",
      `Total Logistics Cost,${summary.totalLogisticsCost.toFixed(2)}`,
      `Logistics Cost / Order,${summary.completedOrders > 0 ? (summary.totalLogisticsCost / summary.completedOrders).toFixed(2) : "0"}`,
      "",
      "=== RECOMMENDATIONS ===",
      `1. Optimize suppliers with lead time > ${Math.ceil(summary.avgSupplierLeadTime * 1.5)} days`,
      `2. Investigate refund causes if rate > 10% (${summary.refundRate.toFixed(1)}%)`,
      `3. Negotiate logistics rates – current avg: ${summary.completedOrders > 0 ? formatCurrency(summary.totalLogisticsCost / summary.completedOrders) : "N/A"}`,
      `4. Reorder inventory for items marked "reorder-needed"`,
      "",
    ];
    const csv = reportSections.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strategic_operations_report_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrdersList(false);
    setIsEditingPricing(false);
    setIsEditingLogistics(false);
    setIsEditingCategory(false);
    setCategoryInput(order.category || "");
    setSupplierName(order.supplier_name || "");
    setSupplierPrice(order.supplier_price || "");
    setSupplierDescription(order.supplier_description || "");
    setCustomerPrice(order.customer_price || "");
    setInventoryStatus(order.inventory_status || "");
    setShippingCarrier(order.shipping_carrier || "");
    setTrackingNumber(order.tracking_number || "");
    setEstimatedDelivery(order.estimated_delivery || "");
    setActualDelivery(order.actual_delivery || "");
    setRefundStatus(order.refund_status || "none");
    setLogisticsCost(order.logistics_cost || "");
    setSupplierLeadTime(order.supplier_lead_time_days?.toString() || "");
    setRouteOptimized(!!order.route_optimized);
  };

  const handleBackToList = () => {
    setShowOrdersList(true);
    setSelectedOrder(null);
    setIsEditingPricing(false);
    setIsEditingLogistics(false);
    setIsEditingCategory(false);
  };

  const handleEditPricing = () => setIsEditingPricing(true);
  const handleCancelEditPricing = () => {
    setIsEditingPricing(false);
    if (selectedOrder) {
      setSupplierName(selectedOrder.supplier_name || "");
      setSupplierPrice(selectedOrder.supplier_price || "");
      setSupplierDescription(selectedOrder.supplier_description || "");
      setCustomerPrice(selectedOrder.customer_price || "");
    }
  };

  const handleEditLogistics = () => setIsEditingLogistics(true);
  const handleCancelEditLogistics = () => {
    setIsEditingLogistics(false);
    if (selectedOrder) {
      setInventoryStatus(selectedOrder.inventory_status || "");
      setShippingCarrier(selectedOrder.shipping_carrier || "");
      setTrackingNumber(selectedOrder.tracking_number || "");
      setEstimatedDelivery(selectedOrder.estimated_delivery || "");
      setActualDelivery(selectedOrder.actual_delivery || "");
      setRefundStatus(selectedOrder.refund_status || "none");
      setLogisticsCost(selectedOrder.logistics_cost || "");
      setSupplierLeadTime(selectedOrder.supplier_lead_time_days?.toString() || "");
      setRouteOptimized(!!selectedOrder.route_optimized);
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
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div>
            <h2 className="font-semibold text-gray-900">
              Orders ({filteredOrders.length})
            </h2>
            <div className="flex flex-wrap gap-1 mt-2">
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
              <button
                onClick={() => setFilter("refund")}
                className={`px-3 py-1 text-xs rounded flex items-center space-x-1 ${
                  filter === "refund"
                    ? "bg-pink-100 text-pink-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Refunds</span>
              </button>
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <Tag className="w-4 h-4 text-gray-500" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All Categories</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
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
            <Link href={"/ready"}>Show completed orders</Link>
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
                            Full operational data
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
                            Strategic Operations Report
                          </p>
                          <p className="text-xs text-gray-500">
                            Supplier, logistics & inventory insights
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
                    {selectedOrder.category && (
                      <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                        {selectedOrder.category}
                      </span>
                    )}
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
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900">Category</h3>
                  {!isEditingCategory && (
                    <button
                      onClick={() => setIsEditingCategory(true)}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                    >
                      <Edit2 className="w-4 h-4 mr-1" /> Edit
                    </button>
                  )}
                </div>
                {isEditingCategory ? (
                  <div className="flex space-x-2 mt-2">
                    <input
                      type="text"
                      value={categoryInput}
                      onChange={(e) => setCategoryInput(e.target.value)}
                      placeholder="e.g., Electronics, Textiles"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => updateCategory(selectedOrder.id)}
                      className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingCategory(false);
                        setCategoryInput(selectedOrder.category || "");
                      }}
                      className="bg-gray-300 text-gray-700 px-3 py-2 rounded hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
<div className="mt-2 flex flex-wrap gap-2">
  {parseCategories(selectedOrder.category).length > 0 ? (
    parseCategories(selectedOrder.category).map((cat, idx) => (
      <span
        key={idx}
        className="text-sm px-2 py-1 rounded-full bg-indigo-100 text-indigo-800"
      >
        {cat}
      </span>
    ))
  ) : (
    <span className="text-gray-500 italic">Not assigned</span>
  )}
</div>
                )}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Customer Information</h3>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <Users className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Customer Name</p>
                      <p className="font-medium text-gray-900">{selectedOrder.customer_name}</p>
                    </div>
                  </div>
                  {selectedOrder.email && (
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-900">{selectedOrder.email}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{selectedOrder.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">{selectedOrder.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Days Since Created</p>
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
                <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-gray-900">{selectedOrder.description}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Minimum Order Quantity</p>
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
                <h3 className="font-semibold text-gray-900 mb-4">Update Status</h3>
                <StatusUpdater
                  currentStatus={selectedOrder.status}
                  onUpdate={(status) => updateOrderStatus(selectedOrder.id, status)}
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
  onCancel={handleCancelEditPricing}
  loading={loading}
  onEdit={handleEditPricing}
  onRemoveSupplier={(pwd) => {
    if (pwd !== "veloxalbaka") {
      alert("Incorrect password. Supplier not removed.");
      return;
    }
    // Clear supplier fields
    const updatePayload: Partial<Order> = {
      supplier_name: undefined,
      supplier_price: undefined,
      supplier_description: undefined,
      supplier_lead_time_days: undefined,
      status: "pending", // revert to pending
    };
    supabase.from("orders").update(updatePayload).eq("id", selectedOrder!.id).execute().then(() => {
      setOrders(prev => prev.map(o => o.id === selectedOrder!.id ? { ...o, ...updatePayload } : o));
      setSelectedOrder(prev => prev ? { ...prev, ...updatePayload } : null);
      alert("Supplier removed successfully.");
    }).catch(err => {
      console.error("Remove supplier error:", err);
      alert("Failed to remove supplier.");
    });
  }}
/>

              <LogisticsSection
                order={selectedOrder}
                isEditing={isEditingLogistics}
                inventoryStatus={inventoryStatus}
                shippingCarrier={shippingCarrier}
                trackingNumber={trackingNumber}
                estimatedDelivery={estimatedDelivery}
                actualDelivery={actualDelivery}
                refundStatus={refundStatus}
                logisticsCost={logisticsCost}
                supplierLeadTime={supplierLeadTime}
                routeOptimized={routeOptimized}
                setInventoryStatus={setInventoryStatus}
                setShippingCarrier={setShippingCarrier}
                setTrackingNumber={setTrackingNumber}
                setEstimatedDelivery={setEstimatedDelivery}
                setActualDelivery={setActualDelivery}
                setRefundStatus={setRefundStatus}
                setLogisticsCost={setLogisticsCost}
                setSupplierLeadTime={setSupplierLeadTime}
                setRouteOptimized={setRouteOptimized}
                onSave={() => updateLogisticsInfo(selectedOrder.id)}
                onCancel={handleCancelEditLogistics}
                loading={loading}
                onEdit={handleEditLogistics}
              />

              <SupplierBiddingSection
                order={selectedOrder}
                onBidSubmit={(bid) => submitSupplierBid(selectedOrder.id, bid)}
                onApproveBid={(bid, pwd) => approveSupplierBid(selectedOrder.id, bid, pwd)}
                customerPrice={extractNumericValue(selectedOrder.customer_price)}
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