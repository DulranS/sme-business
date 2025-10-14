"use client";
import React, { useEffect, useState, useMemo } from "react";
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
  status: "pending" | "in-progress" | "completed" | "cancelled" | "ship";
  images: string;
  created_at: string;
  supplier_price?: string;
  supplier_description?: string;
  customer_price?: string;
  shipped_quantity?: number; // 👈 NEW: tracks how much has been shipped

  // Optional: future logistics fields (for consistency)
  shipping_carrier?: string;
  estimated_delivery?: string;
}

interface OrderImage {
  name: string;
  url: string;
}

// ------------------------
// Environment Variables
// ------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const DISCORD_WEBHOOK_URL = process.env.NEXT_PUBLIC_DISCORD_READY_WEBHOOK_URL || "";

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
// Discord Webhook (Only for NEW completed orders)
// ------------------------
const sendDiscordWebhook = async (order: Order) => {
  if (!DISCORD_WEBHOOK_URL) return;

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

// ------------------------
// Helper: Parse Images
// ------------------------
const parseImages = (imagesJson: string): OrderImage[] => {
  try {
    return JSON.parse(imagesJson || "[]");
  } catch {
    return [];
  }
};

// ------------------------
// Helper: Extract Numeric Price
// ------------------------
const extractNumericValue = (priceString?: string): number => {
  if (!priceString) return 0;
  const match = priceString.match(/[\d,]+\.?\d*/);
  return match ? parseFloat(match[0].replace(/,/g, "")) : 0;
};

// ------------------------
// Helper: Extract Numeric MOQ
// ------------------------
const extractMOQNumber = (moq: string): number => {
  const match = moq.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
};

// ------------------------
// Image Gallery Component
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
              className="h-80 object-cover rounded border cursor-pointer hover:opacity-80"
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
// CompletedOrdersPage Component
// ------------------------
const CompletedOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<number>>(new Set());
  const [shippingQuantities, setShippingQuantities] = useState<Record<number, number>>({});

  // Fetch completed orders on mount
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

        // Notify only newly completed orders (not seen in this session)
        const newOrders = completedOrders.filter((o) => !notifiedOrderIds.has(o.id));
        newOrders.forEach((order) => {
          sendDiscordWebhook(order);
          setNotifiedOrderIds((prev) => new Set(prev).add(order.id));
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

  // Helper: Get remaining quantity to ship
  const getRemaining = (order: Order): number => {
    const total = extractMOQNumber(order.moq);
    const shipped = order.shipped_quantity || 0;
    return Math.max(0, total - shipped);
  };

  // Handle quantity input change
  const handleQuantityChange = (orderId: number, value: string) => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (!isNaN(num)) {
      setShippingQuantities((prev) => ({ ...prev, [orderId]: num }));
    }
  };

  // Submit shipping quantity
  const submitShipping = async (order: Order) => {
    const totalMOQ = extractMOQNumber(order.moq);
    const currentShipped = order.shipped_quantity || 0;
    const toShip = shippingQuantities[order.id] || 0;
    const newShipped = currentShipped + toShip;

    if (toShip <= 0) {
      alert("Please enter a valid quantity to ship.");
      return;
    }

    if (newShipped > totalMOQ) {
      if (
        !confirm(
          `Warning: You're shipping ${newShipped}, but only ${totalMOQ} were ordered. Proceed anyway?`
        )
      ) {
        return;
      }
    }

    try {
      await supabase
        .from("orders")
        .update({ status: "ship", shipped_quantity: newShipped })
        .eq("id", order.id)
        .execute();

      // Optimistically update UI
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? { ...o, shipped_quantity: newShipped, status: "ship" }
            : o
        )
      );

      // Clear input
      setShippingQuantities((prev) => {
        const newQty = { ...prev };
        delete newQty[order.id];
        return newQty;
      });
    } catch (err) {
      console.error("Shipping update failed:", err);
      alert("Failed to update shipping quantity. Please try again.");
    }
  };

  // Export with profit/margin
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
    ];

    const csvRows = orders.map((o) => {
      const cust = extractNumericValue(o.customer_price);
      const supp = extractNumericValue(o.supplier_price);
      const profit = cust - supp;
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
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `completed_orders_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading / Error / Empty
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-green-50">
        <p className="text-green-700 font-medium">Loading completed orders...</p>
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
        <h2 className="text-lg font-bold text-green-800 mb-1">No Completed Orders</h2>
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
    <div className="p-4 space-y-4 bg-green-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-green-900 flex items-center gap-2">
          <CheckCircle className="w-6 h-6" />
          Completed Orders ({orders.length})
        </h1>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
        <Link
          href={"/admin"}
          className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm transition"
        >
          <Package className="w-4 h-4" />
          Back to Admin
        </Link>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const customerPrice = extractNumericValue(order.customer_price);
          const supplierPrice = extractNumericValue(order.supplier_price);
          const profit = customerPrice - supplierPrice;
          const margin = customerPrice > 0 ? (profit / customerPrice) * 100 : 0;
          const daysSince = Math.ceil(
            (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          const totalMOQ = extractMOQNumber(order.moq);
          const remaining = getRemaining(order);

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
                    <h2 className="text-sm font-bold text-green-800 truncate">
                      #{order.id} – {order.customer_name}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {order.description}
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 text-xs">
                      <div>
                        <span className="font-medium">📍 Location:</span>{" "}
                        <span className="text-gray-800">{order.location}</span>
                      </div>
                      <div>
                        <span className="font-medium">📞 Phone:</span>{" "}
                        <span className="text-gray-800">{order.phone}</span>
                      </div>
                      <div>
                        <span className="font-medium">📦 MOQ:</span>{" "}
                        <span className="text-gray-800">{order.moq}</span>
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
                        <span className="font-medium">🕒 Age:</span>{" "}
                        <span className="text-gray-800">{daysSince}d</span>
                      </div>
                      {/* Shipped/Remaining Summary */}
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

                {/* Shipping Control */}
                <div className="ml-4 flex flex-col justify-start space-y-2">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Ship Qty:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      value={shippingQuantities[order.id] ?? ""}
                      onChange={(e) => handleQuantityChange(order.id, e.target.value)}
                      className="w-20 px-2 py-1 text-xs border border-gray-300 rounded text-center"
                      placeholder="0"
                    />
                    <button
                      onClick={() => submitShipping(order)}
                      disabled={!shippingQuantities[order.id]}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <Truck className="w-3 h-3" />
                      Ship
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

export default CompletedOrdersPage;