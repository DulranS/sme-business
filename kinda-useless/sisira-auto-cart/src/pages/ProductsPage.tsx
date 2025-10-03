import { useEffect, useState, useRef } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/main-layout";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductFilters } from "@/components/product/product-filters";
import { useProductStore } from "@/lib/product-store";
import { Search, MessageCircle, PhoneCall, RotateCcw } from "lucide-react";

// Helper function to shuffle an array using Fisher-Yates algorithm
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Helper to create a unique ID with timestamp and random suffix
const generateFreshShuffleId = () => {
  const timestamp = Date.now().toString();
  const randomSuffix = Math.floor(Math.random() * 10000).toString();
  return `${timestamp}-${randomSuffix}`;
};

export default function ProductsPage() {
  // Extract all needed state and actions from the store
  const { products, fetchProducts, loading, error, fetchStatus } =
    useProductStore();

  useEffect(() => {
    if (error) {
      console.error("Error fetching products:", error);
    }
  }, [fetchStatus, error]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredProducts, setFilteredProducts] = useState([]);

  // Separate state for the input field value
  const [inputSearchTerm, setInputSearchTerm] = useState(
    searchParams.get("query") || ""
  );

  const shuffleSeedRef = useRef(generateFreshShuffleId());
  const initializedRef = useRef(false);
  const location = useLocation();

  // State for WhatsApp message modal
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState(
    "Hello, I'd like to inquire about the following auto parts: "
  );
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Window scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.key]); // Add location.key as dependency to detect navigation changes

  // One-time initialization on component mount or when location changes
  useEffect(() => {
    // Reset initialization flag when the location changes
    if (location.key) {
      initializedRef.current = false;
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    // Initialize the search query from URL
    const queryFromUrl = searchParams.get("query") || "";
    setInputSearchTerm(queryFromUrl);

    // Get or create a shuffle ID
    const urlShuffleId = searchParams.get("shuffle");
    if (urlShuffleId) {
      shuffleSeedRef.current = urlShuffleId;
    } else {
      // Apply the shuffle ID to URL but don't trigger a refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.set("shuffle", shuffleSeedRef.current);
      setSearchParams(newParams, { replace: true });
    }

    // Initial fetch of products
    const filterOptions = parseSearchParamsToOptions(searchParams);
    fetchProducts(filterOptions);
  }, [fetchProducts, searchParams, setSearchParams, location.key]); // Add location.key as dependency

  // Filter products whenever products array or search params change
  useEffect(() => {
    // Guard against empty or null products
    if (!products || products.length === 0) {
      setFilteredProducts([]);
      return;
    }

    // Parse all filter parameters from the URL
    const filterParams = parseSearchParamsToClientFilters(searchParams);

    // Apply filters
    let filtered = [...products];

    // Filter by category
    if (filterParams.categories.length > 0) {
      filtered = filtered.filter(
        (product) =>
          product.category && filterParams.categories.includes(product.category)
      );
    }

    // Filter by subcategory
    if (filterParams.subcategories.length > 0) {
      filtered = filtered.filter(
        (product) =>
          product.subcategory &&
          (typeof product.subcategory === "string"
            ? filterParams.subcategories.includes(product.subcategory)
            : filterParams.subcategories.some((sc) =>
                product.subcategory.includes(sc)
              ))
      );
    }

    // Filter by vehicle type
    if (filterParams.vehicles.length > 0) {
      filtered = filtered.filter(
        (product) =>
          product.vehicleType &&
          (Array.isArray(product.vehicleType)
            ? product.vehicleType.some((type) =>
                filterParams.vehicles.includes(type)
              )
            : filterParams.vehicles.includes(product.vehicleType))
      );
    }

    // Filter by brand
    if (filterParams.brands.length > 0) {
      filtered = filtered.filter(
        (product) =>
          product.brand && filterParams.brands.includes(product.brand)
      );
    }

    // Filter by price range
    if (filterParams.minPrice !== null) {
      filtered = filtered.filter(
        (product) => product.price >= filterParams.minPrice
      );
    }

    if (filterParams.maxPrice !== null) {
      filtered = filtered.filter(
        (product) => product.price <= filterParams.maxPrice
      );
    }

    // Filter by search query - Make search case-insensitive and more thorough
    if (filterParams.query && filterParams.query.trim() !== "") {
      const lowerQuery = filterParams.query.toLowerCase().trim();
      filtered = filtered.filter(
        (product) =>
          (product.name && product.name.toLowerCase().includes(lowerQuery)) ||
          (product.description &&
            product.description.toLowerCase().includes(lowerQuery)) ||
          (product.brand && product.brand.toLowerCase().includes(lowerQuery)) ||
          (product.category &&
            product.category.toLowerCase().includes(lowerQuery)) ||
          (product.partNumber &&
            product.partNumber.toLowerCase().includes(lowerQuery))
      );
    }

    try {
      // Use simple shuffle for consistent randomization based on shuffle seed
      const randomizedProducts = shuffleArray(filtered);
      setFilteredProducts(randomizedProducts);
    } catch (err) {
      console.error("Error shuffling products:", err);
      // Fallback to unshuffled products if something goes wrong
      setFilteredProducts(filtered);
    }
  }, [searchParams, products]);

  // Keep input search term in sync with URL parameter when URL changes
  useEffect(() => {
    const queryParam = searchParams.get("query") || "";
    setInputSearchTerm(queryParam);
  }, [searchParams]);

  // Listen for custom filter change events from ProductFilters component
  useEffect(() => {
    const handleFiltersChanged = (event) => {
      try {
        if (event.detail && event.detail.params) {
          const newParams = new URLSearchParams(event.detail.params);

          // Preserve the shuffle parameter
          newParams.set("shuffle", shuffleSeedRef.current);

          // Preserve the search query if it exists
          const currentQuery = searchParams.get("query");
          if (currentQuery) {
            newParams.set("query", currentQuery);
          }

          setSearchParams(newParams);
        }
      } catch (err) {
        console.error("Error processing filter change:", err);
      }
    };

    window.addEventListener("filtersChanged", handleFiltersChanged);

    return () => {
      window.removeEventListener("filtersChanged", handleFiltersChanged);
    };
  }, [searchParams, setSearchParams]);

  // Handle search input changes
  const handleSearchChange = (e) => {
    setInputSearchTerm(e.target.value);
  };

  // Handle form submission
  const handleFormSubmit = (e) => {
    e.preventDefault();

    try {
      const newParams = new URLSearchParams(searchParams);

      // Update or remove the query parameter
      if (inputSearchTerm.trim()) {
        newParams.set("query", inputSearchTerm.trim());
      } else {
        newParams.delete("query");
      }

      // Always preserve the shuffle parameter
      newParams.set("shuffle", shuffleSeedRef.current);

      // Replace rather than push to avoid history stack issues
      setSearchParams(newParams, { replace: true });
    } catch (err) {
      console.error("Error submitting search form:", err);
    }
  };

  // Clear search
  const handleClearSearch = () => {
    setInputSearchTerm("");

    try {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("query");
      newParams.set("shuffle", shuffleSeedRef.current);

      setSearchParams(newParams, { replace: true });
    } catch (err) {
      console.error("Error clearing search:", err);
    }
  };

  // Handle reload or refresh of products if there's an error
  const handleRefreshProducts = () => {
    try {
      const filterOptions = parseSearchParamsToOptions(searchParams);
      fetchProducts(filterOptions);
    } catch (err) {
      console.error("Error refreshing products:", err);
    }
  };

  // Open WhatsApp chat with request message
  const openWhatsAppChat = () => {
    try {
      // Format the message for URL
      const encodedMessage = encodeURIComponent(requestMessage);
      const whatsappUrl = `https://wa.me/94772091359?text=${encodedMessage}`;
      window.open(whatsappUrl, "_blank");

      // Close modal after opening WhatsApp
      setShowWhatsAppModal(false);
    } catch (err) {
      console.error("Error opening WhatsApp chat:", err);
    }
  };

  // Toggle WhatsApp modal
  const toggleWhatsAppModal = () => {
    try {
      if (!showWhatsAppModal && filteredProducts.length > 0) {
        // Prepare a sample message with a few product names if available
        const productSample = filteredProducts
          .slice(0, 3)
          .map((p) => p.name || "Unknown part")
          .join(", ");
        setRequestMessage(
          `Hello, I'd like to request for a part that I am looking for!`
        );
      }
      setShowWhatsAppModal(!showWhatsAppModal);
    } catch (err) {
      console.error("Error toggling WhatsApp modal:", err);
    }
  };

  // Parse search params into options for API filtering
  function parseSearchParamsToOptions(params) {
    const options = {};

    try {
      // Gather all filter parameters
      for (const [key, value] of params.entries()) {
        if (
          [
            "category",
            "subcategory",
            "vehicle",
            "brand",
            "minPrice",
            "maxPrice",
            "query",
          ].includes(key)
        ) {
          if (options[key]) {
            if (!Array.isArray(options[key])) {
              options[key] = [options[key]];
            }
            options[key].push(value);
          } else {
            options[key] = value;
          }
        }
      }

      // Convert numeric values
      if (options.minPrice) options.minPrice = parseInt(options.minPrice);
      if (options.maxPrice) options.maxPrice = parseInt(options.maxPrice);
    } catch (err) {
      console.error("Error parsing search params to options:", err);
    }

    return options;
  }

  // Parse search params into client-side filter structure
  function parseSearchParamsToClientFilters(params) {
    try {
      return {
        categories: params.getAll("category"),
        subcategories: params.getAll("subcategory"),
        vehicles: params.getAll("vehicle"),
        brands: params.getAll("brand"),
        minPrice: params.has("minPrice")
          ? parseInt(params.get("minPrice"))
          : null,
        maxPrice: params.has("maxPrice")
          ? parseInt(params.get("maxPrice"))
          : null,
        query: params.get("query") || "",
        shuffle: params.get("shuffle") || shuffleSeedRef.current,
      };
    } catch (err) {
      console.error("Error parsing search params to client filters:", err);
      return {
        categories: [],
        subcategories: [],
        vehicles: [],
        brands: [],
        minPrice: null,
        maxPrice: null,
        query: "",
        shuffle: shuffleSeedRef.current,
      };
    }
  }

  const currentQuery = searchParams.get("query") || "";

  return (
    <MainLayout>
      {/* WhatsApp Request Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-xl">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-green-600">
                  Request Parts via WhatsApp
                </h3>
                <button
                  onClick={toggleWhatsAppModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your message:
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md min-h-32 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Describe the parts you're looking for..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={toggleWhatsAppModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={openWhatsAppChat}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <MessageCircle size={18} className="mr-2" />
                  Send via WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container py-8">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 mb-8 shadow-lg">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold text-white mb-3">
              Premium Auto Parts Catalog
            </h1>
            <p className="text-blue-100 text-lg mb-6">
              Find the perfect parts for your vehicle from our extensive
              selection of high-quality components
            </p>

            {/* Search Bar */}
            <form onSubmit={handleFormSubmit} className="relative">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for parts by name, description, or part number..."
                  value={inputSearchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-12 pr-10 py-3 border-0 rounded-lg shadow-md focus:ring-2 focus:ring-blue-300 focus:border-blue-300 text-gray-800"
                  aria-label="Search products"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={20} className="text-gray-500" />
                </div>
                {inputSearchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button type="submit" className="sr-only">
                Search
              </button>
            </form>
          </div>
        </div>

        {/* WhatsApp Request Button - Fixed Position */}
        <div className="fixed bottom-8 right-8 z-40">
          <button
            onClick={toggleWhatsAppModal}
            className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-105"
            aria-label="Request parts via WhatsApp"
          >
            <MessageCircle size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
          <aside>
            <div className="sticky top-24">
              <div className="bg-white rounded-xl shadow-md p-5 mb-6">
                <h2 className="font-bold text-lg mb-4 text-gray-800">
                  Refine Your Search
                </h2>
                <ProductFilters
                  setSearchQuery={setInputSearchTerm}
                  selectedProducts={filteredProducts}
                  totalProducts={products ? products.length : 0}
                  setSearchParams={setSearchParams}
                  searchParams={searchParams}
                  loading={loading}
                  searchQuery={inputSearchTerm}
                  onSearchChange={handleSearchChange}
                  onSearchSubmit={handleFormSubmit}
                />
              </div>

              {/* Contact Box */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-md p-5">
                <h3 className="font-bold text-gray-800 mb-3">
                  Need Help Finding Parts?
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  Our experts are ready to assist you with your specific
                  requirements
                </p>
                <button
                  onClick={toggleWhatsAppModal}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 flex items-center justify-center mb-2"
                >
                  <MessageCircle size={16} className="mr-2" />
                  Request via WhatsApp
                </button>
                <a
                  href="tel:+94772091359"
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 flex items-center justify-center"
                >
                  <PhoneCall size={16} className="mr-2" />
                  Call Us
                </a>
              </div>
            </div>
          </aside>

          <div>
            <div className="flex items-center justify-between mb-4 pb-4 border-b">
              <div>
                {loading ? (
                  <p className="text-sm text-gray-500">Loading products...</p>
                ) : error ? (
                  <p className="text-sm text-red-500">Error: {error}</p>
                ) : (
                  <p className="text-sm text-gray-500">
                    Showing{" "}
                    <span className="font-semibold">
                      {filteredProducts.length}
                    </span>{" "}
                    {filteredProducts.length === 1 ? "product" : "products"} in
                    random order
                    {currentQuery && (
                      <span>
                        {" "}
                        matching "
                        <span className="font-medium">{currentQuery}</span>"
                      </span>
                    )}
                  </p>
                )}
              </div>

              {!loading && filteredProducts.length > 0 && (
                <button
                  onClick={toggleWhatsAppModal}
                  className="bg-green-600 text-white text-sm py-2 px-4 rounded-md hover:bg-green-700 flex items-center"
                >
                  <MessageCircle size={16} className="mr-2" />
                  Request Parts
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 text-red-700 p-8 rounded-xl text-center shadow-md">
                <div className="mb-4 font-medium">
                  Failed to load products. Please try again later.
                </div>
                <button
                  onClick={handleRefreshProducts}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center mx-auto"
                >
                  <RotateCcw size={16} className="mr-2" />
                  Refresh Products
                </button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="bg-amber-50 text-amber-700 p-8 rounded-xl text-center shadow-md">
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p>Try adjusting your filters or search criteria.</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-6">
                <ProductGrid products={filteredProducts} />
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
