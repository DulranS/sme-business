import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";

import Index from "./pages/Index";
import ProductsPage from "./pages/ProductsPage";
import ProductDetail from "./pages/ProductDetail";
import CartPage from "./pages/CartPage";
import AdminPage from "./pages/AdminPage";
import AdminLogin from "./pages/AdminLogin";
import NotFound from "./pages/NotFound";
import { WhatsAppButton } from "./pages/WhatsAppButton";

// Register service worker for image caching
const registerServiceWorker = (): void => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/image-cache-sw.js')
        .then(registration => {
          console.log('Image cache service worker registered:', registration.scope);
        })
        .catch(error => {
          console.error('Service worker registration failed:', error);
        });
    });
  }
};

// Create the persister using localStorage with a try-catch to handle SSR
const createPersister = () => {
  try {
    return createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : null,
    });
  } catch (e) {
    // Return a dummy persister for SSR
    return {
      persistClient: () => Promise.resolve(),
      restoreClient: () =>
        Promise.resolve({
          timestamp: 0,
          buster: "",
          clientState: { mutations: [], queries: [] },
        }),
      removeClient: () => Promise.resolve(),
    };
  }
};

// Query client factory with cache configuration for images
const getQueryClient = (() => {
  let client: QueryClient | null = null;

  return () => {
    if (!client) {
      client = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 300000, // 5 minutes: Data is considered fresh for this duration
            retry: 3, // Retry failed queries up to 3 times
            refetchOnWindowFocus: true, // Refetch data when the window regains focus
            refetchOnMount: true, // Refetch data when the component mounts
            cacheTime: 1000 * 60 * 60 * 24, // 24 hours: Keep cached data for images longer
          },
        },
      });

      // Only persist the cache on the client side
      if (typeof window !== "undefined") {
        const localStoragePersister = createPersister();
        persistQueryClient({
          queryClient: client,
          persister: localStoragePersister,
          maxAge: 1000 * 60 * 60, // 1 hour: Maximum age for persisted data (increased from 10 minutes)
        });
      }
    }
    return client;
  };
})();

// Image caching utility function
export const cachedImage = (src: string): string => {
  // Add a cache identifier to the URL to ensure it's processed by the service worker
  return `${src}?cache=true`;
};

// Protected admin route function
function ProtectedRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const auth = useAuth();

  if (!auth.isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

// App component
const App = (): JSX.Element => {
  // Handle SSR by conditionally creating states and effects
  const [isClient, setIsClient] = useState<boolean>(false);
  const queryClient = getQueryClient();

  useEffect(() => {
    setIsClient(true);
    
    // Register service worker for image caching when component mounts (client-side only)
    if (typeof window !== "undefined") {
      registerServiceWorker();
    }
  }, []);

  // Don't render sensitive parts until the client has hydrated
  if (!isClient && typeof window !== "undefined") {
    return <div>Loading...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
          <WhatsAppButton />
        </TooltipProvider>
      </BrowserRouter>

      {/* React Query Devtools - Only in development and only on client side */}
      {process.env.NODE_ENV === "development" && isClient && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}

      {/* Vercel Analytics and Speed Insights */}
      <Analytics />
      <SpeedInsights />
    </QueryClientProvider>
  );
};

export default App;