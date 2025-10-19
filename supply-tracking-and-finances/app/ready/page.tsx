"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  CheckCircle,
  Package,
  Download,
  AlertTriangle,
  Calendar,
  DollarSign,
  Truck,
} from "lucide-react";
import Link from "next/link";

// ------------------------
// Enhanced Order Interface
// ------------------------
interface Order {
  id: number;
  customer_name: string;
  email?: string;
  phone: string;
  location: string;
  description: string;
  moq: string;
  urgency: "low" | "medium" | "high";
  status:
    | "pending"
    | "in-progress"
    | "completed"
    | "cancelled"
    | "ship"
    | "shipped";
  images: string;
  created_at: string;
  supplier_price?: string; // 👈 product cost (scales with quantity)
  supplier_delivery_fee?: string; // 👈 NEW: flat delivery fee (quantity = 1)
  supplier_description?: string;
  customer_price?: string;
  shipped_quantity?: number;
  shipped_at?: string | null;
  supplier_name?: string;

  // Optional logistics
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
}

interface OrderImage {
  name: string;
  url: string;
}

// ------------------------
// Environment & Supabase
// ------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const DISCORD_WEBHOOK_URL =
  process.env.NEXT_PUBLIC_DISCORD_READY_WEBHOOK_URL || "";

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
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<Order[]> =>
            this.request<Order[]>(
              `${table}?select=${columns}&${column}=eq.${value}`
            ),
        }),
        like: (column: string, pattern: string) => ({
          execute: async (): Promise<any[]> =>
            this.request<any[]>(
              `${table}?select=${columns}&${column}=like.${encodeURIComponent(
                pattern
              )}`
            ),
        }),
      }),
      update: (data: Partial<Order>) => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(
              `${this.url}/rest/v1/${table}?${column}=eq.${value}`,
              {
                method: "PATCH",
                headers: {
                  apikey: this.key,
                  Authorization: `Bearer ${this.key}`,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify(data),
              }
            );
            if (!response.ok)
              throw new Error(`Update failed: ${response.status}`);
          },
        }),
      }),
      insert: (data: any) => ({
        execute: async (): Promise<void> => {
          const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: "POST",
            headers: {
              apikey: this.key,
              Authorization: `Bearer ${this.key}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(Array.isArray(data) ? data : [data]),
          });
          if (!response.ok)
            throw new Error(`Insert failed: ${response.status}`);
        },
      }),
      delete: () => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(
              `${this.url}/rest/v1/${table}?${column}=eq.${value}`,
              {
                method: "DELETE",
                headers: {
                  apikey: this.key,
                  Authorization: `Bearer ${this.key}`,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
              }
            );
            if (!response.ok)
              throw new Error(`Delete failed: ${response.status}`);
          },
        }),
        like: (column: string, pattern: string) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(
              `${this.url}/rest/v1/${table}?${column}=like.${encodeURIComponent(
                pattern
              )}`,
              {
                method: "DELETE",
                headers: {
                  apikey: this.key,
                  Authorization: `Bearer ${this.key}`,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
              }
            );
            if (!response.ok)
              throw new Error(`Delete failed: ${response.status}`);
          },
        }),
      }),
    };
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------
// Helpers
// ------------------------
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
  return match ? parseFloat(match[0].replace(/,/g, "")) : 0;
};

const extractMOQNumber = (moq: string): number => {
  const cleaned = moq.replace(/,/g, "");
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// ✅ ADD THIS HELPER
const calculateOrderProfit = (order: Order): number => {
  const cust = extractNumericValue(order.customer_price);
  const supp = extractNumericValue(order.supplier_price);
  const delivery = extractNumericValue(order.supplier_delivery_fee);
  return cust - supp - delivery;
};
// ------------------------
// Status Badge Component
// ------------------------
const StatusBadge: React.FC<{ status: Order["status"] }> = ({ status }) => {
  const config = {
    pending: { bg: "bg-gray-100", text: "text-gray-800", label: "Pending" },
    "in-progress": {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      label: "In Progress",
    },
    completed: {
      bg: "bg-green-100",
      text: "text-green-800",
      label: "Completed",
    },
    ship: { bg: "bg-blue-100", text: "text-blue-800", label: "Partial Ship" },
    shipped: { bg: "bg-purple-100", text: "text-purple-800", label: "Shipped" },
    cancelled: { bg: "bg-red-100", text: "text-red-800", label: "Cancelled" },
  }[status] || { bg: "bg-gray-100", text: "text-gray-800", label: status };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
};

// ------------------------
// Image Gallery
// ------------------------
const ImageGallery: React.FC<{ images: OrderImage[] }> = ({ images }) => {
  if (images.length === 0) return null;

  const openImage = (url: string) =>
    window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <h4 className="text-xs font-medium text-gray-700 mb-2">
        Attached Images ({images.length})
      </h4>
      <div className="flex flex-wrap gap-2">
        {images.map((image, i) => (
          <div key={i} className="relative group">
            <img
              src={image.url}
              alt={image.name || `Image ${i + 1}`}
              className="h-40 w-40 object-cover rounded border cursor-pointer hover:opacity-80"
              onClick={() => openImage(image.url)}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition opacity-0 group-hover:opacity-100 flex items-center justify-center">
              <span className="text-white text-xs font-bold">View</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ------------------------
// Main Component
// ------------------------
const CompletedOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shippingQuantities, setShippingQuantities] = useState<
    Record<number, number>
  >({});
  const [shippingInProgress, setShippingInProgress] = useState<
    Record<number, boolean>
  >({});

  const notifiedOrderIdsRef = useRef<Set<number>>(new Set());
  // Fetch orders
  useEffect(() => {
    const fetchCompletedOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const completedOrders: Order[] = await supabase
          .from("orders")
          .select("*")
          .eq("status", "completed")
          .execute();

        // Inside useEffect:
        const newOrders = completedOrders.filter(
          (o) => !notifiedOrderIdsRef.current.has(o.id)
        );
        newOrders.forEach((order) => {
          sendDiscordWebhook(order);
          notifiedOrderIdsRef.current.add(order.id);
        });

        setOrders(completedOrders);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load completed orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchCompletedOrders();
  }, []);

  // Profitability Summary
  const totalRevenue = useMemo(
    () =>
      orders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0),
    [orders]
  );
  const totalProfit = useMemo(
    () => orders.reduce((sum, o) => sum + calculateOrderProfit(o), 0),
    [orders]
  );
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const getRemaining = (order: Order): number => {
    const total = extractMOQNumber(order.moq);
    const shipped = order.shipped_quantity || 0;
    return Math.max(0, total - shipped);
  };

  const handleQuantityChange = (orderId: number, value: string) => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setShippingQuantities((prev) => ({ ...prev, [orderId]: num }));
    }
  };

  // ✅ STRATEGIC: Only this page sends bookkeeping records for completed orders
const submitShipping = async (order: Order) => {
  if (shippingInProgress[order.id]) return;

  setShippingInProgress((prev) => ({ ...prev, [order.id]: true }));

  const totalMOQ = extractMOQNumber(order.moq);
  const currentShipped = order.shipped_quantity || 0;
  const newShipped = shippingQuantities[order.id] ?? currentShipped;
  const isFirstShipment = currentShipped === 0;

  // Validation
  if (newShipped < 0) {
    alert("Shipped quantity cannot be negative.");
    setShippingInProgress((prev) => {
      const copy = { ...prev };
      delete copy[order.id];
      return copy;
    });
    return;
  }

  if (totalMOQ > 0 && newShipped > totalMOQ) {
    const confirm = window.confirm(
      `You're marking ${newShipped} units shipped, but MOQ is ${totalMOQ}. Proceed anyway?`
    );
    if (!confirm) {
      setShippingInProgress((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
      return;
    }
  }

  if (newShipped === 0 && totalMOQ > 0) {
    const confirmZero = window.confirm(
      "You're setting shipped quantity to 0. This will clear all financial records. Proceed?"
    );
    if (!confirmZero) {
      setShippingInProgress((prev) => {
        const copy = { ...prev };
        delete copy[order.id];
        return copy;
      });
      return;
    }
  }

  const finalStatus =
    totalMOQ === 0
      ? newShipped > 0
        ? "shipped"
        : "completed"
      : newShipped >= totalMOQ
      ? "shipped"
      : "ship";

  const now = new Date().toISOString();
  const baseDate = now.split("T")[0];

  try {
    // 🧹 ALWAYS delete all existing bookkeeping records for this order
    await supabase
      .from("bookkeeping_records")
      .delete()
      .like("tags", `%order-${order.id}%`)
      .execute();

    // 💰 Only insert new records if shipping something
    if (newShipped > 0) {
      const custTotal = extractNumericValue(order.customer_price) || 0;
      const suppTotal = extractNumericValue(order.supplier_price) || 0;
      const deliveryFee = extractNumericValue(order.supplier_delivery_fee) || 0;
      const recordsToInsert: any[] = [];

      // 💵 Revenue (scaled to shipped quantity)
      if (custTotal > 0) {
        const revenuePerUnit = totalMOQ > 0 ? custTotal / totalMOQ : custTotal;
        const revenueAmount = revenuePerUnit * newShipped;
        if (revenueAmount > 0) {
          recordsToInsert.push({
            date: baseDate,
            payment_date: baseDate,
            description: `Revenue from ${newShipped} units – Order #${order.id}: ${order.description}`,
            category: "Inflow",
            amount: parseFloat(revenueAmount.toFixed(2)),
            cost_per_unit: null,
            quantity: newShipped,
            notes: `Revenue for ${newShipped} shipped units out of ${totalMOQ || 1}.`,
            customer: order.customer_name || null,
            project: order.description || null,
            tags: `order-${order.id},revenue`,
            market_price: revenueAmount,
            supplied_by: null,
            approved: true,
          });
        }
      }

      // 📦 Supplier Product Cost (scaled to shipped quantity)
      if (suppTotal > 0 && order.supplier_name) {
        const suppPerUnit = totalMOQ > 0 ? suppTotal / totalMOQ : suppTotal;
        const costTotal = suppPerUnit * newShipped;
        if (costTotal > 0) {
          recordsToInsert.push({
            date: baseDate,
            payment_date: baseDate,
            description: `Supplier product cost for ${newShipped} units – Order #${order.id} – ${order.supplier_name}`,
            category: "Outflow",
            amount: parseFloat(costTotal.toFixed(2)),
            cost_per_unit: parseFloat(suppPerUnit.toFixed(2)),
            quantity: newShipped,
            notes: `Product cost for ${newShipped} units for order #${order.id}.`,
            customer: order.customer_name || null,
            project: order.description || null,
            tags: `order-${order.id},supplier,product`,
            market_price: null,
            supplied_by: order.supplier_name || null,
            approved: true,
          });
        }
      }

      // 🚚 Delivery Fee (one-time, only on first shipment)
      if (isFirstShipment && deliveryFee > 0 && order.supplier_name) {
        recordsToInsert.push({
          date: baseDate,
          payment_date: baseDate,
          description: `Delivery fee for Order #${order.id} – ${order.supplier_name}`,
          category: "Outflow",
          amount: deliveryFee,
          cost_per_unit: deliveryFee,
          quantity: 1,
          notes: `One-time delivery fee for order #${order.id}.`,
          customer: order.customer_name || null,
          project: order.description || null,
          tags: `order-${order.id},delivery`,
          market_price: null,
          supplied_by: order.supplier_name || null,
          approved: true,
        });
      }

      if (recordsToInsert.length > 0) {
        await supabase
          .from("bookkeeping_records")
          .insert(recordsToInsert)
          .execute();
      }
    }

    // ✅ Update order with fresh shipped_at on every shipment
    await supabase
      .from("orders")
      .update({
        status: finalStatus,
        shipped_quantity: newShipped,
        shipped_at: newShipped > 0 ? now : null,
      })
      .eq("id", order.id)
      .execute();

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              shipped_quantity: newShipped,
              status: finalStatus,
              shipped_at: newShipped > 0 ? now : null,
            }
          : o
      )
    );

    setShippingQuantities((prev) => {
      const newQty = { ...prev };
      delete newQty[order.id];
      return newQty;
    });

    alert("✅ Shipped quantity and financials updated!");
  } catch (err) {
    console.error("Update failed:", err);
    alert("❌ Failed to update. Please try again.");
  } finally {
    setShippingInProgress((prev) => {
      const copy = { ...prev };
      delete copy[order.id];
      return copy;
    });
  }
};
  const shipRemaining = (orderId: number, remaining: number) => {
    setShippingQuantities((prev) => ({ ...prev, [orderId]: remaining }));
  };

  const exportToCSV = () => {
    if (orders.length === 0) return;

    const headers = [
      "Order ID",
      "Customer Name",
      "Phone",
      "Location",
      "MOQ",
      "Description",
      "Customer Price",
      "Supplier Price",
      "Profit",
      "Margin %",
      "Urgency",
      "Completed Date",
      "Shipped Quantity",
      "Remaining",
      "Shipped At",
      "Status",
    ];

    const csvRows = orders.map((o) => {
      const cust = extractNumericValue(o.customer_price);
      const profit = calculateOrderProfit(o);
      const margin = cust > 0 ? (profit / cust) * 100 : 0;
      const totalMOQ = extractMOQNumber(o.moq);
      const shipped = o.shipped_quantity || 0;
      const remaining = totalMOQ - shipped;

      return [
        o.id,
        `"${o.customer_name.replace(/"/g, '""')}"`,
        o.phone,
        `"${o.location.replace(/"/g, '""')}"`,
        `"${o.moq.replace(/"/g, '""')}"`,
        `"${o.description.replace(/"/g, '""')}"`,
        o.customer_price || "N/A",
        o.supplier_price || "N/A",
        profit > 0 ? profit.toFixed(2) : "N/A",
        margin > 0 ? margin.toFixed(2) : "N/A",
        o.urgency,
        new Date(o.created_at).toISOString().split("T")[0],
        shipped,
        remaining,
        o.shipped_at
          ? new Date(o.shipped_at).toISOString().split("T")[0]
          : "N/A",
        o.status,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `completed_orders_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading / Error / Empty
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-green-50">
        <p className="text-green-700 font-medium">
          Loading completed orders...
        </p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-green-50">
        <p className="text-red-600 font-semibold">{error}</p>
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-green-50 p-4 text-center">
        <CheckCircle className="w-16 h-16 text-green-400 mb-3" />
        <h2 className="text-lg font-bold text-green-800 mb-1">
          No Completed Orders
        </h2>
        <p className="text-green-600">Completed orders will appear here.</p>
        <br />
        <b>
          <Link href={"/admin"}>Visit Admin Panel</Link>
        </b>
        <br />
        <h1>OR</h1> <br />
        <b>
          <Link href={"/ship"}>Visit Shipped Panel</Link>
        </b>
      </div>
    );

  return (
    <div className="p-4 space-y-6 bg-green-50 min-h-screen">
      {/* Profitability Summary */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          Performance Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="font-bold text-green-700">
              ${totalRevenue.toFixed(0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Profit</p>
            <p className="font-bold text-blue-700">${totalProfit.toFixed(0)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Avg Margin</p>
            <p
              className={`font-bold ${
                avgMargin >= 30
                  ? "text-green-700"
                  : avgMargin >= 20
                  ? "text-yellow-700"
                  : "text-red-700"
              }`}
            >
              {avgMargin.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h1 className="text-xl font-bold text-green-900 flex items-center gap-2">
          <CheckCircle className="w-6 h-6" />
          Completed Orders ({orders.length})
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <Link
            href={"/ship"}
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm transition"
          >
            <Package className="w-4 h-4" />
            Shipped Orders
          </Link>
          <Link
            href={"/admin"}
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm transition"
          >
            <Package className="w-4 h-4" />
            Back to Admin
          </Link>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const customerPrice = extractNumericValue(order.customer_price);
          const profit = calculateOrderProfit(order);
          const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
          const daysSince = Math.ceil(
            (Date.now() - new Date(order.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          const remaining = getRemaining(order);
          const toShip = shippingQuantities[order.id] || 0;
          const isOverShipping = toShip > remaining;
          const isShipDisabled = toShip <= 0 || isOverShipping;

          return (
            <div
              key={order.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-green-200 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-green-100 rounded-full">
                    <CheckCircle className="w-5 h-5 text-green-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-sm font-bold text-green-800 truncate">
                        #{order.id} – {order.customer_name}
                      </h2>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {order.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs">
                      <div>
                        <span className="font-medium">📍 Location:</span>{" "}
                        {order.location}
                      </div>
                      <div>
                        <span className="font-medium">📞 Phone:</span>{" "}
                        {order.phone}
                      </div>
                      <div>
                        <span className="font-medium">📦 MOQ:</span> {order.moq}
                      </div>
                      <div>
                        <span className="font-medium">❗ Urgency:</span>{" "}
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            order.urgency === "high"
                              ? "bg-red-100 text-red-800"
                              : order.urgency === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {order.urgency}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">💰 Revenue:</span>{" "}
                        <span className="text-green-700 font-medium">
                          {order.customer_price || "N/A"}
                        </span>
                      </div>
                      {profit > 0 && (
                        <>
                          <div>
                            <span className="font-medium">📊 Profit:</span>{" "}
                            <span className="text-blue-700 font-medium">
                              +{profit.toFixed(0)}
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">📈 Margin:</span>{" "}
                            <span
                              className={`font-medium ${
                                margin >= 30
                                  ? "text-green-700"
                                  : margin >= 20
                                  ? "text-yellow-700"
                                  : "text-red-700"
                              }`}
                            >
                              {margin.toFixed(1)}%
                            </span>
                          </div>
                        </>
                      )}
                      <div>
                        <span className="font-medium">🕒 Age:</span> {daysSince}
                        d
                      </div>
                      <div>
                        <span className="font-medium">🚚 Shipped:</span>{" "}
                        <span className="text-blue-700">
                          {order.shipped_quantity || 0}
                        </span>
                        {remaining > 0 && (
                          <span className="text-yellow-600 ml-1">
                            ({remaining} left)
                          </span>
                        )}
                      </div>
                    </div>
                    <ImageGallery images={parseImages(order.images)} />
                  </div>
                </div>

                {/* Shipping Controls */}
                <div className="ml-4 flex flex-col items-end space-y-2">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Edit Shipped Qty:</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={
                          shippingQuantities[order.id] ??
                          (order.shipped_quantity || 0)
                        }
                        onChange={(e) =>
                          handleQuantityChange(order.id, e.target.value)
                        }
                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                        placeholder="1"
                      />
                      <button
                        onClick={() => submitShipping(order)}
                        disabled={shippingInProgress[order.id]}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <Truck className="w-3 h-3" /> Save
                      </button>
                    </div>
                    <button
                      onClick={() => shipRemaining(order.id, remaining)}
                      className="text-xs text-blue-600 hover:underline mt-1"
                    >
                      Ship Remaining ({remaining})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------
// Discord Webhook
// ------------------------
const sendDiscordWebhook = async (order: Order) => {
  if (!DISCORD_WEBHOOK_URL) return;

  const shippedQty = order.shipped_quantity ?? 0;

  const payload = {
    username: "✅ Completed Orders Bot",
    avatar_url: "https://i.imgur.com/AfFp7pu.png",
    content: `
**---------------------------------------------------------------------------------------**
✅ **Order Completed – Ready for Shipping!**
**Order #${order.id}** – ${order.customer_name}
📍 Location: ${order.location}
📞 Phone: ${order.phone}
📦 MOQ: ${order.moq}
🚚 Shipped Quantity: ${shippedQty}
💰 Revenue: ${order.customer_price || "N/A"}
❗ Urgency: ${order.urgency}
📝 Description: ${order.description}
📅 Completed: ${new Date(order.created_at).toLocaleDateString()}
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
    console.error("Discord webhook failed:", err);
  }
};

export default CompletedOrdersPage;
