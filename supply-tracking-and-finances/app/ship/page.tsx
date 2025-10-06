"use client";
import React, { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

// ------------------------
// Extended Order Interface (with "ship" status)
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
// Custom Supabase Client
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
        execute: async (): Promise<Order[]> => this.request<Order[]>(`${table}?select=${columns}`),
      }),
    };
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------
// Discord Webhook Helper
// ------------------------
const sendDiscordWebhook = async (order: Order) => {
  if (!DISCORD_WEBHOOK_URL) return;

  const payload = {
    username: "Order Bot",
    avatar_url: "https://i.imgur.com/AfFp7pu.png",
content: `
**---------------------------------------------------------------------------------------**
🚚 **Shipping Order Notification - Ready to SHIP**
**Order #${order.id}** - ${order.customer_name}
Location: ${order.location}
Phone: ${order.phone}
MOQ: ${order.moq}
Urgency: ${order.urgency}
Description: ${order.description}
Status: ${order.status}
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
// ShipOrdersPage Component
// ------------------------
const ShipOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ------------------------
  // Fetch Ship Orders
  // ------------------------
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

        // Identify new ship orders and send Discord webhook
        const newOrders = shipOrders.filter(
          (o) => !orders.some((existing) => existing.id === o.id)
        );
        newOrders.forEach((order) => sendDiscordWebhook(order));

        setOrders(shipOrders);
      } catch (err) {
        console.error(err);
        setError("Failed to load shipping orders.");
      } finally {
        setLoading(false);
      }
    };

    fetchShipOrders();
  }, []);

  // ------------------------
  // Parse Images
  // ------------------------
  const parseImages = (imagesJson: string): OrderImage[] => {
    try {
      return JSON.parse(imagesJson || "[]");
    } catch {
      return [];
    }
  };

  const ImageGallery: React.FC<{ images: OrderImage[] }> = ({ images }) => {
    const openImage = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

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
  // Export to CSV
  // ------------------------
  const exportToCSV = () => {
    if (orders.length === 0) return;

    const headers = Object.keys(orders[0]);
    const csvRows = [
      headers.join(","), // header row
      ...orders.map((order) =>
        headers
          .map((field) => `"${String((order as any)[field] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "shipping_orders.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ------------------------
  // Loading / Error / Empty States
  // ------------------------
  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500" style={{ color: "white" }}>Loading shipping orders...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex items-center justify-center h-screen text-center">
        <p className="text-red-600 font-semibold">{error}</p>
      </div>
    );

  if (orders.length === 0)
    return (
      <div className="flex items-center justify-center h-screen text-center">
        <p className="text-gray-500 font-medium">No shipping orders available.</p>
      </div>
    );

  // ------------------------
  // Render Ship Orders
  // ------------------------
  return (
    <div className="p-4 space-y-2 bg-blue-50 min-h-screen">
      <button
        onClick={exportToCSV}
        className="mb-3 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
      >
        Export to CSV
      </button>

      {orders.map((order) => {
        const images = parseImages(order.images);
        return (
          <div
            key={order.id}
            className="bg-white p-3 rounded shadow border border-blue-200 hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-blue-800 mb-1">
                  Order #{order.id} - {order.customer_name}
                </h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  <p className="truncate"><span className="font-medium">Email:</span> {order.email || "N/A"}</p>
                  <p className="truncate"><span className="font-medium">Phone:</span> {order.phone}</p>
                  <p className="truncate"><span className="font-medium">Location:</span> {order.location}</p>
                  <p className="truncate"><span className="font-medium">MOQ:</span> {order.moq}</p>
                  <p className="truncate"><span className="font-medium">Urgency:</span> {order.urgency}</p>
                  <p className="truncate"><span className="font-medium">Supplier Price:</span> {order.supplier_price || "N/A"}</p>
                  <p className="truncate"><span className="font-medium">Customer Price:</span> {order.customer_price || "N/A"}</p>
                  <p className="truncate"><span className="font-medium">Created:</span> {new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-xs mt-1 line-clamp-2"><span className="font-medium">Description:</span> {order.description}</p>
              </div>
              {images.length > 0 && (
                <div className="flex gap-2 flex-shrink-0">
                  {images.slice(0, 2).map((image, i) => (
                    <img
                      key={i}
                      src={image.url}
                      alt={image.name}
                      className="w-24 h-24 object-contain rounded border border-gray-300 cursor-pointer hover:opacity-75 transition hover:scale-105 bg-gray-50"
                      onClick={() => window.open(image.url, "_blank", "noopener,noreferrer")}
                      title={`${image.name} - Click to view full size`}
                    />
                  ))}
                  {images.length > 2 && (
                    <div className="w-24 h-24 bg-gray-100 rounded border border-gray-300 flex items-center justify-center text-sm text-gray-600 font-medium cursor-pointer hover:bg-gray-200 transition">
                      +{images.length - 2}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ShipOrdersPage;
