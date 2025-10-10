"use client";
import React, { useEffect, useState, useMemo } from "react";
import {
  CheckCircle,
  Package,
  MapPin,
  Calendar,
  Download,
  Image as ImageIcon,
  AlertTriangle,
  Link,
} from "lucide-react";

// ------------------------
// Extended Order Interface (with logistics fields)
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

  // === NEW: Logistics & Inventory Fields ===
  inventory_status?: "in-stock" | "low-stock" | "out-of-stock" | "reorder-needed";
  shipping_carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string; // ISO date
  logistics_cost?: string;
  supplier_lead_time_days?: number;
  route_optimized?: boolean;
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
    };
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------
// Discord Webhook (Only once per order)
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
// Image Gallery Component
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
        {/* {images.slice(0, 3).map((image, i) => (
          <img
            key={i}
            src={image.url}
            alt={image.name}
            className="w-16 h-16 object-cover rounded border border-gray-300 cursor-pointer hover:opacity-80 transition"
            onClick={() => openImage(image.url)}
            title={image.name}
          />
        ))} */}
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
// ShipOrdersPage Component (Optimized)
// ------------------------
const ShipOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifiedOrderIds, setNotifiedOrderIds] = useState<Set<number>>(new Set());

  // Fetch only "ship" orders on mount
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

        // Notify only new orders not yet notified in this session
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

  // Export with strategic fields
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
      "Created At",
    ];

    const csvRows = orders.map((o) => [
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
      new Date(o.created_at).toISOString().split("T")[0],
    ]);

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
      </div>
    );

  return (
    <div className="p-4 space-y-4 bg-blue-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-900 flex items-center gap-2">
          <Package className="w-6 h-6" />
          Shipping Orders ({orders.length})
        </h1>
        
        <Link href={"/"} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <AlertTriangle className="w-4 h-4" />
          Report Issue
        </Link>

        <button
          onClick={exportToCSV}
          className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm transition"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const images = parseImages(order.images);
          const daysSinceCreated = Math.ceil(
            (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );

          return (
            <div
              key={order.id}
              className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 bg-blue-100 rounded-full">
                    <CheckCircle className="w-5 h-5 text-blue-700" />
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
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          order.urgency === "high" ? "bg-red-100 text-red-800" :
                          order.urgency === "medium" ? "bg-yellow-100 text-yellow-800" :
                          "bg-green-100 text-green-800"
                        }`}>
                          {order.urgency}
                        </span>
                      </div>
                      {order.inventory_status && (
                        <div>
                          <span className="font-medium">📊 Inventory:</span>{" "}
                          <span className={`px-2 py-0.5 rounded text-xs ${getInventoryColor(order.inventory_status)}`}>
                            {order.inventory_status.replace("-", " ")}
                          </span>
                        </div>
                      )}
                      {order.shipping_carrier && (
                        <div>
                          <span className="font-medium">🚚 Carrier:</span>{" "}
                          <span className="text-gray-800">{order.shipping_carrier}</span>
                        </div>
                      )}
                      {order.estimated_delivery && (
                        <div>
                          <span className="font-medium">📅 Est. Delivery:</span>{" "}
                          <span className="text-gray-800">
                            {new Date(order.estimated_delivery).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">💰 Revenue:</span>{" "}
                        <span className="text-green-700 font-medium">{order.customer_price || "N/A"}</span>
                      </div>
                      <div>
                        <span className="font-medium">🕒 Age:</span>{" "}
                        <span className="text-gray-800">{daysSinceCreated}d</span>
                      </div>
                    </div>

                    <ImageGallery images={images} />
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

export default ShipOrdersPage;