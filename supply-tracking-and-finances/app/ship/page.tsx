"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  CheckCircle,
  Package,
  MapPin,
  Calendar,
  Download,
  ImageIcon,
  AlertTriangle,
  Truck,
  ClipboardList,
  TrendingUp,
  Clock,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

// ------------------------
// Extended Order Interface
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
  status: "pending" | "in-progress" | "completed" | "cancelled" | "ship" | "dispatched";
  images: string;
  created_at: string;
  supplier_price?: string;
  supplier_description?: string;
  supplier_delivery_fee?: string;
  customer_price?: string;
  inventory_status?: "in-stock" | "low-stock" | "out-of-stock" | "reorder-needed";
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  logistics_cost?: string;
  supplier_lead_time_days?: number;
  route_optimized?: boolean;
  shipped_quantity?: number;
  shipped_at?: string;
}

interface OrderImage {
  name: string;
  url: string;
}

// ------------------------
// Env Vars
// ------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const DISCORD_WEBHOOK_URL = process.env.NEXT_PUBLIC_DISCORD_SHIP_WEBHOOK_URL || "";

// ------------------------
// Supabase Client
// ------------------------
class SupabaseClient {
  constructor(private url: string, private key: string) {}

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
            this.request<Order[]>(`${table}?select=${columns}&${column}=eq.${value}`),
        }),
      }),
      update: (data: Partial<Order>) => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(`${this.url}/rest/v1/${table}?${column}=eq.${value}`, {
              method: "PATCH",
              headers: {
                apikey: this.key,
                Authorization: `Bearer ${this.key}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`Update failed: ${response.status}`);
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

const extractMOQNumber = (moq: string): number => {
  const cleaned = moq.replace(/,/g, "");
  const match = cleaned.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

const extractNumericValue = (priceString?: string): number => {
  if (!priceString) return 0;
  const match = priceString.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, "")) : 0;
};

const calculateOrderProfit = (order: Order): number => {
  const cust = extractNumericValue(order.customer_price);
  const supp = extractNumericValue(order.supplier_price);
  const delivery = extractNumericValue(order.supplier_delivery_fee);
  const logistics = extractNumericValue(order.logistics_cost);
  return cust - supp - delivery - logistics;
};

// ------------------------
// Image Gallery
// ------------------------
const ImageGallery: React.FC<{ images: OrderImage[] }> = ({ images }) => {
  const openImage = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  if (images.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="w-4 h-4 text-gray-600" />
        <span className="text-xs font-medium text-gray-700">Attachments ({images.length})</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {images.slice(0, 3).map((image, i) => (
          <img
            key={i}
            src={image.url}
            alt={image.name}
            className="h-24 w-24 object-cover rounded border cursor-pointer hover:opacity-80"
            onClick={() => openImage(image.url)}
            title={image.name}
          />
        ))}
        {images.length > 3 && (
          <div className="w-10 h-10 bg-gray-100 rounded border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
            +{images.length - 3}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------
// Discord Webhook on Dispatch
// ------------------------
const sendDiscordWebhookOnDispatch = async (
  order: Order,
  shippedQuantity: number,
  carrier: string,
  trackingNumber: string
) => {
  if (!DISCORD_WEBHOOK_URL) return;

  const custPrice = extractNumericValue(order.customer_price);
  const profit = calculateOrderProfit(order);
  const margin = custPrice > 0 ? ((profit / custPrice) * 100).toFixed(1) : "N/A";

  const payload = {
    username: "✅ Order Dispatched",
    avatar_url: "https://i.imgur.com/AfFp7pu.png",
    content: `
**---------------------------------------------------------------------------------------**
📦 **DISPATCH CONFIRMED – Order #${order.id}**
👤 **Customer**: ${order.customer_name}
📍 **Location**: ${order.location}
📞 **Phone**: ${order.phone}
📦 **Shipped Qty**: ${shippedQuantity} (MOQ: ${order.moq})
💰 **Revenue**: ${order.customer_price || "N/A"} | **Profit**: $${profit.toFixed(2)} (${margin}%)
🚚 **Carrier**: ${carrier}
🔖 **Tracking**: ${trackingNumber}
⏰ **Dispatched**: ${new Date().toLocaleString()}
❗ **Urgency**: ${order.urgency.toUpperCase()}
📊 **Inventory Status**: ${order.inventory_status?.replace(/-/g, " ") || "Unknown"}
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
    console.error("Discord dispatch webhook failed:", err);
  }
};

// ------------------------
// Main Component
// ------------------------
const ShipOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatchData, setDispatchData] = useState<Record<number, { carrier: string; tracking: string }>>({});
  const [shippingQuantities, setShippingQuantities] = useState<Record<number, number>>({});

  // Fetch orders
  useEffect(() => {
    const fetchShipOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const shipOrders: Order[] = await supabase
          .from("orders")
          .select("*")
          .eq("status", "ship")
          .execute();

        setOrders(shipOrders);

        // ✅ Initialize shipping quantities to remaining amount
        const initialQuantities: Record<number, number> = {};
        shipOrders.forEach((order) => {
          const total = extractMOQNumber(order.moq);
          const shipped = order.shipped_quantity || 0;
          initialQuantities[order.id] = Math.max(0, total - shipped);
        });
        setShippingQuantities(initialQuantities);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load shipping orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchShipOrders();
  }, []);

  // Strategic Metrics
  const totalRevenue = useMemo(() =>
    orders.reduce((sum, o) => sum + extractNumericValue(o.customer_price), 0), [orders]
  );
  const totalProfit = useMemo(() =>
    orders.reduce((sum, o) => sum + calculateOrderProfit(o), 0), [orders]
  );
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const avgDaysInQueue = useMemo(() => {
    if (orders.length === 0) return 0;
    const totalDays = orders.reduce((sum, o) => {
      return sum + Math.ceil((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return totalDays / orders.length;
  }, [orders]);

  const atRiskOrders = useMemo(() =>
    orders.filter(o =>
      o.urgency === "high" ||
      o.inventory_status === "low-stock" ||
      o.inventory_status === "out-of-stock"
    ).length, [orders]);

  const getRemaining = (order: Order): number => {
    const total = extractMOQNumber(order.moq);
    const shipped = order.shipped_quantity || 0;
    return Math.max(0, total - shipped);
  };

  const getInventoryColor = (status?: string) => {
    if (!status) return "bg-gray-100 text-gray-800";
    const map: Record<string, string> = {
      "in-stock": "bg-green-100 text-green-800",
      "low-stock": "bg-yellow-100 text-yellow-800",
      "out-of-stock": "bg-red-100 text-red-800",
      "reorder-needed": "bg-orange-100 text-orange-800",
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  const handleDispatchChange = (orderId: number, field: "carrier" | "tracking", value: string) => {
    setDispatchData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [field]: value },
    }));
  };

  const handleQuantityChange = (orderId: number, value: string) => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setShippingQuantities((prev) => ({ ...prev, [orderId]: num }));
    }
  };

  const shipRemaining = (orderId: number, remaining: number) => {
    setShippingQuantities((prev) => ({ ...prev, [orderId]: remaining }));
  };

  const markAsDispatched = async (order: Order) => {
    const toShip = shippingQuantities[order.id] || 0;
    const remaining = getRemaining(order);

    if (toShip < 1) {
      alert("Shipment quantity must be at least 1.");
      return;
    }

    if (toShip > remaining) {
      alert(`Cannot ship more than remaining quantity (${remaining}).`);
      return;
    }

    const carrier = dispatchData[order.id]?.carrier?.trim();
    const tracking = dispatchData[order.id]?.tracking?.trim();

    if (!carrier || !tracking || tracking.length < 4) {
      alert("Please enter valid carrier and tracking number (min 4 characters).");
      return;
    }

    const now = new Date().toISOString();

    try {
      await sendDiscordWebhookOnDispatch(order, toShip, carrier, tracking);

      await supabase
        .from("orders")
        .update({
          status: "dispatched",
          shipping_carrier: carrier,
          tracking_number: tracking,
          shipped_quantity: (order.shipped_quantity || 0) + toShip,
          shipped_at: order.shipped_at || now,
        })
        .eq("id", order.id)
        .execute();

      // Remove dispatched order from UI
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      setDispatchData((prev) => {
        const newD = { ...prev };
        delete newD[order.id];
        return newD;
      });
      setShippingQuantities((prev) => {
        const newQ = { ...prev };
        delete newQ[order.id];
        return newQ;
      });
    } catch (err) {
      console.error("Dispatch update failed:", err);
      alert("Failed to mark as dispatched. Please try again.");
    }
  };

  // ✅ Fixed CSV Export — aligned headers and rows
  const exportToCSV = () => {
    if (orders.length === 0) return;

    const headers = [
      "Order ID",
      "Customer Name",
      "Phone",
      "Location",
      "MOQ",
      "Shipped Qty",
      "Remaining",
      "Description",
      "Customer Price",
      "Supplier Price",
      "Supplier Delivery Fee",
      "Logistics Cost",
      "Profit",
      "Margin %",
      "Profit per Unit",
      "Urgency",
      "Inventory Status",
      "Days in Queue",
      "Shipping Carrier",
      "Tracking Number",
      "Route Optimized",
      "Lead Time (days)",
      "Created At",
    ];

    const csvRows = orders.map((o) => {
      const cust = extractNumericValue(o.customer_price);
      const profit = calculateOrderProfit(o);
      const margin = cust > 0 ? (profit / cust) * 100 : 0;
      const totalMOQ = extractMOQNumber(o.moq);
      const shipped = o.shipped_quantity || 0;
      const remaining = totalMOQ - shipped;
      const profitPerUnit = totalMOQ > 0 ? profit / totalMOQ : 0;
      const daysInQueue = Math.ceil((Date.now() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));

      return [
        o.id,
        `"${o.customer_name.replace(/"/g, '""')}"`,
        o.phone,
        `"${o.location.replace(/"/g, '""')}"`,
        o.moq,
        shipped,
        remaining,
        `"${o.description.replace(/"/g, '""')}"`,
        o.customer_price || "N/A",
        o.supplier_price || "N/A",
        o.supplier_delivery_fee || "N/A",
        o.logistics_cost || "N/A",
        profit > 0 ? profit.toFixed(2) : "N/A",
        margin > 0 ? margin.toFixed(2) : "N/A",
        profitPerUnit > 0 ? profitPerUnit.toFixed(2) : "N/A",
        o.urgency,
        o.inventory_status || "N/A",
        daysInQueue,
        o.shipping_carrier || "N/A",
        o.tracking_number || "N/A",
        o.route_optimized ? "Yes" : "No",
        o.supplier_lead_time_days || "N/A",
        new Date(o.created_at).toISOString().split("T")[0],
      ];
    });

    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `shipping_orders_analytics_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // UI
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-blue-50">
        <p className="text-blue-700 font-medium">Loading shipping orders...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen bg-blue-50">
        <p className="text-red-600 font-semibold">{error}</p>
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-blue-50 p-4 text-center">
        <Package className="w-16 h-16 text-blue-400 mb-3" />
        <h2 className="text-lg font-bold text-blue-800 mb-1">No Orders Ready to Ship</h2>
        <p className="text-blue-600">Orders with status “ship” will appear here.</p>
        <br />
        <Link href="/admin" className="text-green-700 font-medium underline">
          Go to Admin Panel
        </Link>
      </div>
    );

  return (
    <div className="p-4 space-y-6 bg-blue-50 min-h-screen">
      {/* Strategic Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-700">Total Revenue</h3>
          </div>
          <p className="text-xl font-bold text-green-700">${totalRevenue.toFixed(0)}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-700">Total Profit</h3>
          </div>
          <p className="text-xl font-bold text-blue-700">${totalProfit.toFixed(0)}</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-700">Avg. Days in Queue</h3>
          </div>
          <p className="text-xl font-bold text-purple-700">{avgDaysInQueue.toFixed(1)} days</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-700">At-Risk Orders</h3>
          </div>
          <p className="text-xl font-bold text-red-700">{atRiskOrders} / {orders.length}</p>
        </div>
      </div>

      {/* Margin Insight */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
        <h2 className="text-lg font-bold text-gray-800 mb-2">Profitability & Efficiency</h2>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-gray-600">Avg. Margin</p>
            <p className={`text-lg font-bold ${
              avgMargin >= 30 ? 'text-green-700' :
              avgMargin >= 20 ? 'text-yellow-700' : 'text-red-700'
            }`}>
              {avgMargin.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Orders to Fulfill</p>
            <p className="text-lg font-bold text-blue-700">{orders.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">High Urgency</p>
            <p className="text-lg font-bold text-red-700">
              {orders.filter(o => o.urgency === "high").length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl font-bold text-blue-900 flex items-center gap-2">
          <Truck className="w-6 h-6" />
          Shipping Orders ({orders.length})
        </h1>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition"
          >
            <Download className="w-4 h-4" />
            Export Analytics CSV
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition"
          >
            <AlertTriangle className="w-4 h-4" />
            Admin Panel
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const images = parseImages(order.images);
          const daysSinceCreated = Math.ceil(
            (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          const remaining = getRemaining(order);
          const totalMOQ = extractMOQNumber(order.moq);
          const toShip = shippingQuantities[order.id] || 0;
          const isOverShipping = toShip > remaining;
          const isDispatchDisabled = toShip < 1 || isOverShipping || 
            !dispatchData[order.id]?.carrier?.trim() || 
            !dispatchData[order.id]?.tracking?.trim();

          const showUrgencyFlag = order.urgency === "high";
          const showInventoryRisk = order.inventory_status === "low-stock" || order.inventory_status === "out-of-stock";
          const profit = calculateOrderProfit(order);
          const profitPerUnit = totalMOQ > 0 ? profit / totalMOQ : 0;

          return (
            <div
              key={order.id}
              className={`bg-white p-4 rounded-lg shadow-sm border ${
                showUrgencyFlag ? "border-red-300 bg-red-50" : 
                showInventoryRisk ? "border-yellow-300 bg-yellow-50" : "border-blue-200"
              } hover:shadow-md transition`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 p-2 bg-blue-100 rounded-full">
                    <Truck className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-blue-800 truncate">
                      #{order.id} – {order.customer_name}
                      {showUrgencyFlag && (
                        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">❗ HIGH URGENCY</span>
                      )}
                      {showInventoryRisk && (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">⚠️ INVENTORY RISK</span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{order.description}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs">
                      <div><span className="font-medium">📍 Location:</span> {order.location}</div>
                      <div><span className="font-medium">📞 Phone:</span> {order.phone}</div>
                      <div><span className="font-medium">📦 MOQ:</span> {order.moq}</div>
                      <div>
                        <span className="font-medium">💰 Revenue:</span>{" "}
                        <span className="text-green-700 font-medium">{order.customer_price || "N/A"}</span>
                      </div>
                      <div>
                        <span className="font-medium">📈 Profit/Unit:</span>{" "}
                        <span className="text-blue-700 font-medium">
                          {profitPerUnit > 0 ? `$${profitPerUnit.toFixed(2)}` : "N/A"}
                        </span>
                      </div>
                      <div><span className="font-medium">🕒 Age:</span> {daysSinceCreated}d</div>
                      <div>
                        <span className="font-medium">🚚 Shipped:</span>{" "}
                        <span className="text-blue-700">{order.shipped_quantity || 0}</span>
                        {remaining > 0 && <span className="text-yellow-600 ml-1">({remaining} left)</span>}
                      </div>
                      {order.inventory_status && (
                        <div>
                          <span className="font-medium">📊 Inventory:</span>{" "}
                          <span className={`px-2 py-0.5 rounded text-xs ${getInventoryColor(order.inventory_status)}`}>
                            {order.inventory_status.replace(/-/g, " ")}
                          </span>
                        </div>
                      )}
                    </div>

                    <ImageGallery images={images} />
                  </div>
                </div>

                {/* Dispatch Controls */}
                <div className="ml-4 w-60 flex flex-col gap-2 text-xs">
                  <div>
                    <label className="block text-gray-700 mb-1">Ship Qty (Max: {remaining})</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min="1"
                        max={remaining}
                        value={shippingQuantities[order.id] ?? ""}
                        onChange={(e) => handleQuantityChange(order.id, e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        placeholder="1"
                      />
                      {remaining > 0 && (
                        <button
                          type="button"
                          onClick={() => shipRemaining(order.id, remaining)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                        >
                          Max
                        </button>
                      )}
                    </div>
                    {isOverShipping && (
                      <p className="text-red-600 text-xs mt-1">Exceeds remaining</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-1">Carrier</label>
                    <input
                      type="text"
                      value={dispatchData[order.id]?.carrier || ""}
                      onChange={(e) => handleDispatchChange(order.id, "carrier", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="e.g., FedEx"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-1">Tracking #</label>
                    <input
                      type="text"
                      value={dispatchData[order.id]?.tracking || ""}
                      onChange={(e) => handleDispatchChange(order.id, "tracking", e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="123456789"
                    />
                  </div>

                  <button
                    onClick={() => markAsDispatched(order)}
                    disabled={isDispatchDisabled}
                    className="mt-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ClipboardList className="w-3 h-3" />
                    Mark Dispatched
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShipOrdersPage;