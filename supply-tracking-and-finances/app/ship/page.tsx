"use client";
import React, { useEffect, useState } from "react";
import {
  CheckCircle,
  Package,
  MapPin,
  Calendar,
  Download,
  Image as ImageIcon,
  AlertTriangle,
  Truck,
  ClipboardList,
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
  customer_price?: string;

  // Logistics & Inventory
  inventory_status?: "in-stock" | "low-stock" | "out-of-stock" | "reorder-needed";
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  logistics_cost?: string;
  supplier_lead_time_days?: number;
  route_optimized?: boolean;

  // 👇 NEW
  shipped_quantity?: number; // how much has been shipped so far
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
// Supabase Client (with update support)
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
// Discord Webhook
// ------------------------
const sendDiscordWebhook = async (order: Order) => {
  if (!DISCORD_WEBHOOK_URL) return;

  const payload = {
    username: "🚚 Shipping Bot",
    avatar_url: "https://i.imgur.com/AfFp7pu.png",
    content: `
**---------------------------------------------------------------------------------------**
📦 **NEW SHIPPING ORDER – Ready for Dispatch!**
**Order #${order.id}** – ${order.customer_name}
📍 Location: ${order.location}
📞 Phone: ${order.phone}
📦 MOQ: ${order.moq}
❗ Urgency: ${order.urgency}
📝 Description: ${order.description}
💰 Customer Price: ${order.customer_price || "N/A"}
🚚 Carrier: ${order.shipping_carrier || "TBD"}
📅 Est. Delivery: ${order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : "N/A"}
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
  const match = moq.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
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
            className="h-80 object-cover rounded border cursor-pointer hover:opacity-80"
            onClick={() => openImage(image.url)}
            title={image.name}
          />
        ))}
        {images.length > 3 && (
          <div className="w-16 h-16 bg-gray-100 rounded border border-dashed border-gray-400 flex items-center justify-center text-xs text-gray-500">
            +{images.length - 3}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------
// Main Component
// ------------------------
const ShipOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<number>>(new Set());

  // Form state for dispatch
  const [dispatchData, setDispatchData] = useState<Record<number, { carrier: string; tracking: string }>>({});
  const [shippingQuantities, setShippingQuantities] = useState<Record<number, number>>({});

  // Fetch ship orders
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

        // Notify new orders
        const newOrders = shipOrders.filter((o) => !notifiedOrderIds.has(o.id));
        newOrders.forEach((order) => {
          sendDiscordWebhook(order);
          setNotifiedOrderIds((prev) => new Set(prev).add(order.id));
        });

        setOrders(shipOrders);
      } catch (err) {
        console.error("Fetch error:", err);
        setError("Failed to load shipping orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchShipOrders();
  }, []);

  // Helpers
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

  // Handle input changes
  const handleDispatchChange = (orderId: number, field: "carrier" | "tracking", value: string) => {
    setDispatchData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [field]: value },
    }));
  };

  const handleQuantityChange = (orderId: number, value: string) => {
    const num = value === "" ? 0 : parseInt(value, 10);
    if (!isNaN(num)) {
      setShippingQuantities((prev) => ({ ...prev, [orderId]: num }));
    }
  };

  // Mark as dispatched
  const markAsDispatched = async (order: Order) => {
    const toShip = shippingQuantities[order.id] || 0;
    const remaining = getRemaining(order);
    const totalMOQ = extractMOQNumber(order.moq);
    const newShipped = (order.shipped_quantity || 0) + toShip;

    if (toShip <= 0) {
      alert("Please enter a valid quantity to ship.");
      return;
    }

    if (newShipped > totalMOQ) {
      if (!confirm(`You're shipping ${newShipped}, but only ${totalMOQ} were ordered. Proceed?`)) {
        return;
      }
    }

    const carrier = dispatchData[order.id]?.carrier?.trim();
    const tracking = dispatchData[order.id]?.tracking?.trim();

    if (!carrier || !tracking) {
      alert("Please enter both carrier and tracking number.");
      return;
    }

    try {
      await supabase
        .from("orders")
        .update({
          status: "dispatched",
          shipping_carrier: carrier,
          tracking_number: tracking,
          shipped_quantity: newShipped,
        })
        .eq("id", order.id)
        .execute();

      // Optimistic UI update
      setOrders((prev) => prev.filter((o) => o.id !== order.id));

      // Clear local state
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

  // Export
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
      "Shipping Carrier",
      "Tracking Number",
      "Estimated Delivery",
      "Logistics Cost",
      "Inventory Status",
      "Lead Time (days)",
      "Route Optimized",
      "Shipped Quantity",
      "Remaining",
      "Created At",
    ];

    const csvRows = orders.map((o) => {
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
        o.shipping_carrier || "N/A",
        o.tracking_number || "N/A",
        o.estimated_delivery ? new Date(o.estimated_delivery).toISOString().split("T")[0] : "N/A",
        o.logistics_cost || "N/A",
        o.inventory_status || "N/A",
        o.supplier_lead_time_days || "N/A",
        o.route_optimized ? "Yes" : "No",
        shipped,
        remaining,
        new Date(o.created_at).toISOString().split("T")[0],
      ];
    });

    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `shipping_orders_${new Date().toISOString().split("T")[0]}.csv`;
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
    <div className="p-4 space-y-4 bg-blue-50 min-h-screen">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-xl font-bold text-blue-900 flex items-center gap-2">
          <Package className="w-6 h-6" />
          Shipping Orders ({orders.length})
        </h1>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition"
          >
            <Download className="w-4 h-4" />
            Export CSV
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

          return (
            <div
              key={order.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-0.5 p-2 bg-blue-100 rounded-full">
                    <Truck className="w-5 h-5 text-blue-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-blue-800 truncate">
                      #{order.id} – {order.customer_name}
                    </h2>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{order.description}</p>

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
                      {order.inventory_status && (
                        <div>
                          <span className="font-medium">📊 Inventory:</span>{" "}
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${getInventoryColor(
                              order.inventory_status
                            )}`}
                          >
                            {order.inventory_status.replace("-", " ")}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">💰 Revenue:</span>{" "}
                        <span className="text-green-700 font-medium">
                          {order.customer_price || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">🕒 Age:</span>{" "}
                        <span className="text-gray-800">{daysSinceCreated}d</span>
                      </div>
                      <div>
                        <span className="font-medium">🚚 Shipped:</span>{" "}
                        <span className="text-blue-700">
                          {order.shipped_quantity || 0}
                        </span>
                        {remaining > 0 && (
                          <span className="text-yellow-600 ml-1">({remaining} left)</span>
                        )}
                      </div>
                    </div>

                    <ImageGallery images={images} />
                  </div>
                </div>

                {/* Dispatch Controls */}
                <div className="ml-4 w-64 flex flex-col gap-2 text-xs">
                  <div>
                    <label className="block text-gray-700 mb-1">Ship Qty</label>
                    <input
                      type="number"
                      min="0"
                      max={remaining}
                      value={shippingQuantities[order.id] ?? ""}
                      onChange={(e) => handleQuantityChange(order.id, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                      placeholder="0"
                    />
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
                    disabled={
                      !shippingQuantities[order.id] ||
                      !dispatchData[order.id]?.carrier ||
                      !dispatchData[order.id]?.tracking
                    }
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