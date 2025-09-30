import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { PriceFormatter } from "@/components/ui/price-formatter";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductBreadcrumbs } from "@/components/product/product-breadcrumbs";
import { ProductFeatures } from "@/components/product/product-features";
import { ProductQuantitySelector } from "@/components/product/product-quantity-selector";
import { useProductStore } from "@/lib/product-store";
import { useCart } from "@/lib/cart";
import {
  ShoppingCart,
  MoveLeft,
  AlertCircle,
  Heart,
  Share2,
  Truck,
  CheckCircle,
  Star,
  ZoomIn,
  Shield,
  FileText,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

// Helper function to shuffle an array using Fisher-Yates algorithm
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function ProductDetail() {
  const { id } = useParams();
  const { products, getProductById, loading, error } = useProductStore();
  const cart = useCart();
  const navigate = useNavigate(); // Added for the go back functionality

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [emailForNotification, setEmailForNotification] = useState("");
  const [hasInventoryNotification, setHasInventoryNotification] =
    useState(false);
  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [recentlyViewedProducts, setRecentlyViewedProducts] = useState([]);
  const [productNotFound, setProductNotFound] = useState(false);

  // Create a ref for the carousel
  const carouselApiRef = useRef(null);

  // Refs for animations
  const addToCartButtonRef = useRef(null);

  // Scrolls to top on page load and when ID changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Go back function
  const handleGoBack = () => {
    navigate(-1); // Navigate to the previous page in history
  };

  // Mock multiple images
  const productImages = useMemo(() => {
    if (!product) return [];
    return product.images || [];
  }, [product]);

  // Get the product whenever id changes
  useEffect(() => {
    if (id) {
      // Reset product not found state when loading a new product
      setProductNotFound(false);
      // Reset quantity to 1 when changing products
      setQuantity(1);
      // Reset active image index when changing products
      setActiveImageIndex(0);

      getProductById(id).then((foundProduct) => {
        if (foundProduct) {
          setProduct(foundProduct);

          // Add to recently viewed
          const recentlyViewed = JSON.parse(
            localStorage.getItem("recentlyViewed") || "[]"
          );
          const updatedRecentlyViewed = [
            foundProduct.id,
            ...recentlyViewed.filter((pid) => pid !== foundProduct.id),
          ].slice(0, 5);
          localStorage.setItem(
            "recentlyViewed",
            JSON.stringify(updatedRecentlyViewed)
          );

          // Get recently viewed products
          setRecentlyViewedProducts(
            updatedRecentlyViewed
              .map((pid) => getProductById(pid))
              .filter(Boolean)
          );
        } else {
          // Only set product not found after we know it's truly not found
          setProductNotFound(true);
        }
      });
    }
  }, [id, getProductById]);

  // Function to handle thumbnail click and update carousel
  const handleThumbnailClick = (index) => {
    setActiveImageIndex(index);
    if (carouselApiRef.current) {
      carouselApiRef.current.scrollTo(index);
    }
  };

  // Simulate stock fluctuation for urgency (demo purpose)
  const [remainingStock, setRemainingStock] = useState(0);
  useEffect(() => {
    if (product && product.stockQuantity > 0) {
      // Show a lower number to create urgency
      setRemainingStock(
        Math.min(product.stockQuantity, Math.floor(Math.random() * 5) + 1)
      );
    }
  }, [product]);

  // Real-time filtering and shuffling for related products
  const relatedProducts = useMemo(() => {
    if (!product) return [];

    // Filter products in the same category but not the current product
    const filtered = products.filter(
      (p) =>
        p.category === product.category &&
        p.id !== product.id &&
        p.stockQuantity > 0
    );

    // Shuffle the filtered products and take the first 4
    return shuffleArray(filtered).slice(0, 4);
  }, [product, products]);

  // Filters for compatibility
  const compatibleVehicles = useMemo(() => {
    if (!product) return [];

    return [
      { make: "Toyota", models: ["Camry (2018-2023)", "Corolla (2019-2023)"] },
      { make: "Honda", models: ["Civic (2017-2023)", "Accord (2018-2023)"] },
      { make: "Ford", models: ["F-150 (2018-2023)", "Mustang (2019-2023)"] },
    ];
  }, [product]);

  // Aggregate review stats
  const reviewStats = useMemo(
    () => ({
      average: 4.7,
      total: 127,
      distribution: [
        { stars: 5, count: 95, percentage: 75 },
        { stars: 4, count: 20, percentage: 16 },
        { stars: 3, count: 7, percentage: 5 },
        { stars: 2, count: 3, percentage: 2 },
        { stars: 1, count: 2, percentage: 2 },
      ],
    }),
    []
  );

  const incrementQuantity = () => setQuantity((prev) => prev + 1);
  const decrementQuantity = () => setQuantity((prev) => Math.max(1, prev - 1));

  const addToCart = () => {
    if (product && product.stockQuantity > 0) {
      // Button press animation
      if (addToCartButtonRef.current) {
        addToCartButtonRef.current.classList.add("scale-95");
        setTimeout(() => {
          addToCartButtonRef.current.classList.remove("scale-95");
        }, 150);
      }

      cart.addItem(product, quantity);

      // Show toast notification
      toast({
        title: "Added to cart!",
        description: `${quantity} × ${product.name} added to your cart.`,
        duration: 2000,
      });

      // Update remaining stock for urgency display
      if (remainingStock <= quantity) {
        setRemainingStock(0);
      } else {
        setRemainingStock((prev) => prev - quantity);
      }
    }
  };

  // Add related product to cart with quantity of 1
  const addRelatedProductToCart = (relatedProduct) => {
    if (relatedProduct && relatedProduct.stockQuantity > 0) {
      cart.addItem(relatedProduct, 1);

      // Show toast notification
      toast({
        title: "Added to cart!",
        description: `1 × ${relatedProduct.name} added to your cart.`,
        duration: 2000,
      });
    }
  };

  const toggleWishlist = () => {
    setIsWishlisted((prev) => !prev);
    toast({
      title: isWishlisted ? "Removed from wishlist" : "Added to wishlist!",
      description: isWishlisted
        ? `${product?.name} has been removed from your wishlist.`
        : `${product?.name} has been added to your wishlist.`,
      duration: 2000,
    });
  };

  const handleShareClick = () => {
    // Copy to clipboard functionality
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Product link copied to clipboard.",
      duration: 2000,
    });
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Updated handleInventoryNotification function in ProductDetail component
  const handleInventoryNotification = async (e) => {
    e.preventDefault();

    // Form validation
    if (!emailForNotification || emailForNotification.trim() === "") {
      toast({
        title: "Error",
        description: "Please enter your email or phone number",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    setIsSubmitting(true);
    const apiURL = "https://sisira-auto-cart-production.up.railway.app";

    try {
      // Call the backend API
      const response = await fetch(`${apiURL}/api/inventory-notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contact: emailForNotification,
          productId: id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to register notification");
      }

      // Update UI state
      setHasInventoryNotification(true);
      setEmailForNotification("");

      // Show success toast
      toast({
        title: "Notification set!",
        description:
          data.message || "We'll email you when this item is back in stock.",
        duration: 2000,
      });
    } catch (error) {
      // Show error toast
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estimate delivery based on current date
  const estimatedDelivery = (() => {
    const today = new Date();
    const deliveryDate = new Date(today);

    // Add 3 business days
    let businessDaysToAdd = 3;
    let daysAdded = 0;

    while (businessDaysToAdd > 0) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      daysAdded++;

      // Check if it's a weekday (0 = Sunday, 6 = Saturday)
      const dayOfWeek = deliveryDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDaysToAdd--;
      }
    }

    // Format as "Month Day" (e.g., "Apr 19")
    return deliveryDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  })();

  const estimatedDelivery2 = (() => {
    const today = new Date();
    const deliveryDate = new Date(today);

    // Add 5 business days
    let businessDaysToAdd = 5;
    let daysAdded = 0;

    while (businessDaysToAdd > 0) {
      deliveryDate.setDate(deliveryDate.getDate() + 1);
      daysAdded++;

      // Check if it's a weekday (0 = Sunday, 6 = Saturday)
      const dayOfWeek = deliveryDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        businessDaysToAdd--;
      }
    }

    // Format as "Month Day" (e.g., "Apr 19")
    return deliveryDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  })();

  // Loading Skeleton Component
  const ProductLoadingSkeleton = () => (
    <MainLayout>
      <div className="container px-4 py-6 max-w-6xl mx-auto">
        {/* Back button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            className="flex items-center text-green-700 hover:text-green-800 hover:bg-green-50"
            onClick={() => navigate("/products")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Products
          </Button>
        </div>

        {/* Breadcrumbs skeleton */}
        <div className="mb-4 overflow-x-auto whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <span className="text-gray-300">/</span>
            <Skeleton className="h-4 w-24" />
            <span className="text-gray-300">/</span>
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Main product section skeleton */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-4 md:p-6">
            {/* Product Image Gallery Skeleton */}
            <div>
              {/* Main Product Image */}
              <Skeleton className="aspect-square w-full rounded-lg mb-4" />

              {/* Thumbnail gallery */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-md flex-shrink-0" />
                <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-md flex-shrink-0" />
                <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-md flex-shrink-0" />
                <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-md flex-shrink-0" />
              </div>
            </div>

            {/* Product Details Skeleton */}
            <div className="space-y-4">
              {/* Category, brand, and rating */}
              <div className="flex flex-wrap gap-2 items-center">
                <Skeleton className="h-6 w-16 rounded" />
                <Skeleton className="h-6 w-14 rounded" />
                <div className="ml-auto flex items-center gap-1">
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
              </div>

              {/* Product title */}
              <Skeleton className="h-8 w-full rounded" />

              {/* Price */}
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-24 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>

              {/* Part Number */}
              <Skeleton className="h-4 w-36 rounded" />

              {/* Stock status indicator */}
              <Skeleton className="h-12 w-full rounded-md" />

              {/* Add to cart section */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <Skeleton className="h-10 w-1/4 rounded" />
                  <Skeleton className="h-10 w-3/4 rounded" />
                </div>

                <div className="flex gap-2">
                  <Skeleton className="h-10 w-1/2 rounded" />
                  <Skeleton className="h-10 w-1/2 rounded" />
                </div>

                {/* Estimated delivery */}
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>
          </div>

          {/* Product Info Tabs Skeleton */}
          <div className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="mt-4 sm:mt-6">
              {/* Tabs skeleton */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1 mb-4">
                <Skeleton className="h-8 rounded" />
                <Skeleton className="h-8 rounded" />
              </div>
              <Skeleton className="h-48 w-full rounded-md" />
            </div>
          </div>
        </div>

        {/* Related Products Skeleton */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-24" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-3 rounded-lg shadow-sm">
                <Skeleton className="aspect-square w-full rounded-md mb-2" />
                <Skeleton className="h-4 w-3/4 mb-1" />
                <Skeleton className="h-6 w-1/2 mb-2" />
                <Skeleton className="h-8 w-full rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </MainLayout>
  );

  // Product Not Found Component
  const ProductNotFoundComponent = () => (
    <MainLayout>
      <div className="container py-8 md:py-16 text-center">
        <Button
          variant="ghost"
          className="flex items-center text-green-700 hover:text-green-800 hover:bg-green-50 mb-6"
          onClick={handleGoBack}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Go Back
        </Button>

        <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-green-700">
          Product Not Found
        </h1>
        <p className="mb-6 md:mb-8 text-red-600">
          The product you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild className="bg-green-600 hover:bg-green-700">
          <Link to="/products">
            <MoveLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>
    </MainLayout>
  );

  // Decide what to render based on various states
  if (loading) {
    return <ProductLoadingSkeleton />;
  }

  if (productNotFound) {
    return <ProductNotFoundComponent />;
  }

  if (!product) {
    return <ProductLoadingSkeleton />;
  }

  const isInStock = product.stockQuantity > 0;

  return (
    <MainLayout>
      <div className="container px-4 py-6 max-w-6xl mx-auto">
        {/* Go Back Button */}
        <div className="mb-4">
          <Button
            variant="ghost"
            className="flex items-center text-green-700 hover:text-green-800 hover:bg-green-50"
            onClick={handleGoBack}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Go Back
          </Button>
        </div>

        {/* Breadcrumbs */}
        <div className="mb-4 overflow-x-auto whitespace-nowrap">
          <ProductBreadcrumbs
            productName={product.name}
            category={product.category}
          />
        </div>

        {/* Main product section */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 p-4 md:p-6">
            {/* Product Image Gallery Section */}
            <div>
              {/* Main Product Image with Zoom */}
              <Carousel
                className="mb-4 w-full"
                opts={{
                  startIndex: activeImageIndex,
                }}
                onApi={(api) => {
                  carouselApiRef.current = api;
                }}
                onSelect={(index) => {
                  setActiveImageIndex(index);
                }}
              >
                <CarouselContent>
                  {productImages.map((img, idx) => (
                    <CarouselItem key={idx}>
                      <div className="relative aspect-square flex items-center justify-center bg-white rounded-lg overflow-hidden">
                        <img
                          src={img || "/logo.png"}
                          alt={`${product.name} view ${idx + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />

                        {/* Product badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {product.price > 100 && (
                            <Badge className="bg-blue-500 text-white">
                              Premium
                            </Badge>
                          )}
                          {product.stockQuantity <= 5 &&
                            product.stockQuantity > 0 && (
                              <Badge className="bg-amber-500 text-white">
                                Low Stock
                              </Badge>
                            )}
                          {product.brand === "OEM" && (
                            <Badge className="bg-purple-500 text-white">
                              OEM Quality
                            </Badge>
                          )}
                        </div>

                        {/* Action buttons */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="absolute bottom-2 right-2"
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[95vw] max-w-4xl mx-auto">
                            <DialogHeader>
                              <DialogTitle className="text-base sm:text-lg">
                                {product.name}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="aspect-video flex items-center justify-center">
                              <img
                                src={img || "/logo.png"}
                                alt={product.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious
                  className="hidden sm:flex"
                  onClick={() => {
                    // Update the active image index when navigating
                    setActiveImageIndex((prev) =>
                      prev === 0 ? productImages.length - 1 : prev - 1
                    );
                  }}
                />
                <CarouselNext
                  className="hidden sm:flex"
                  onClick={() => {
                    // Update the active image index when navigating
                    setActiveImageIndex((prev) =>
                      prev === productImages.length - 1 ? 0 : prev + 1
                    );
                  }}
                />
              </Carousel>

              {/* Thumbnail gallery - Improved for mobile with scroll snap */}
              <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-green-200 scrollbar-track-gray-100">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    className={`h-14 w-14 sm:h-16 sm:w-16 border-2 rounded-md overflow-hidden flex-shrink-0 snap-center ${
                      idx === activeImageIndex
                        ? "border-green-500"
                        : "border-gray-200"
                    }`}
                    onClick={() => handleThumbnailClick(idx)}
                  >
                    <img
                      src={img || "/logo.png"}
                      alt={`View ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Details Section */}
            <div className="space-y-3 sm:space-y-4">
              {/* Category, brand, and rating */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs sm:text-sm font-medium bg-green-100 text-green-700 px-2 py-1 rounded">
                  {product.category}
                </span>
                <span className="text-xs sm:text-sm font-medium bg-red-100 text-red-700 px-2 py-1 rounded">
                  {product.brand}
                </span>

                {/* Rating summary */}
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex items-center">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-amber-500 text-amber-500" />
                    <span className="ml-1 font-medium text-xs sm:text-sm">
                      {reviewStats.average}
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs sm:text-sm">
                    ({reviewStats.total})
                  </span>
                </div>
              </div>

              {/* Product title */}
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
                {product.name}
              </h1>

              {/* Price */}
              <div className="flex flex-wrap items-center gap-2">
                {product.discountPercentage > 0 ? (
                  <>
                    <PriceFormatter
                      price={
                        product.price * (1 - product.discountPercentage / 100)
                      }
                      className="text-xl sm:text-2xl font-bold text-red-600"
                    />
                    <div className="flex items-center gap-1">
                      <PriceFormatter
                        price={product.price}
                        className="text-sm text-gray-500 line-through"
                      />
                      <span className="text-sm font-medium bg-red-100 text-red-700 px-1.5 rounded">
                        -{product.discountPercentage}% Discount
                      </span>
                    </div>
                  </>
                ) : (
                  <PriceFormatter
                    price={product.price}
                    className="text-xl sm:text-2xl font-bold text-red-600"
                  />
                )}
              </div>

              {/* Stock status indicator */}
              <div
                className={`flex items-center gap-2 p-2 sm:p-3 rounded-md ${
                  isInStock
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <div
                  className={`h-2 w-2 sm:h-3 sm:w-3 rounded-full ${
                    isInStock ? "bg-green-500" : "bg-red-500"
                  }`}
                ></div>
                <p
                  className={`text-xs sm:text-sm font-medium ${
                    isInStock ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {isInStock ? `In Stock` : "Out of Stock"}
                </p>
              </div>

              {/* Add to cart section */}
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <ProductQuantitySelector
                    quantity={quantity}
                    onIncrement={incrementQuantity}
                    onDecrement={decrementQuantity}
                    disabled={!isInStock}
                    maxQuantity={product.stockQuantity}
                  />

                  <Button
                    ref={addToCartButtonRef}
                    className={`flex-1 py-2 h-auto ${
                      isInStock
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                    onClick={addToCart}
                    disabled={!isInStock}
                  >
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                    <span className="text-xs sm:text-sm">
                      {isInStock ? "Add to Cart" : "Out of Stock"}
                    </span>
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 py-2 h-auto text-xs sm:text-sm"
                    onClick={toggleWishlist}
                  >
                    <Heart
                      className={`h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 ${
                        isWishlisted ? "fill-red-500 text-red-500" : ""
                      }`}
                    />
                    {isWishlisted ? "Wishlisted" : "Add to Wishlist"}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 py-2 h-auto text-xs sm:text-sm"
                    onClick={() => {
                      // Prepare the WhatsApp message with product details
                      const message = `Hi, I'm interested in ${product.name} (Part #${product.partNumber}) and have a question.`;
                      const encodedMessage = encodeURIComponent(message);
                      // Open WhatsApp with pre-filled message
                      window.open(
                        `https://wa.me/94772091359?text=${encodedMessage}`,
                        "_blank"
                      );
                    }}
                  >
                    {/* WhatsApp icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2 text-green-600"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Ask via WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 py-2 h-auto text-xs sm:text-sm"
                    onClick={handleShareClick}
                  >
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                    Share
                  </Button>
                </div>

                {/* Estimated delivery */}
                {isInStock && (
                  <div className="flex items-center gap-2 p-2 sm:p-3 bg-blue-50 rounded-md text-blue-700 border border-blue-100">
                    <Truck className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <div className="text-xs sm:text-sm">
                      <span className="font-medium">
                        Free delivery between{" "}
                        {(() => {
                          // Parse the date strings to extract the day number
                          const date1 = new Date(estimatedDelivery);
                          const date2 = new Date(estimatedDelivery2);

                          const day1 = date1.getDate();
                          const day2 = date2.getDate();

                          // Get proper ordinal suffix for day1
                          const getOrdinalSuffix = (day) => {
                            if (day > 3 && day < 21) return "th";
                            switch (day % 10) {
                              case 1:
                                return "st";
                              case 2:
                                return "nd";
                              case 3:
                                return "rd";
                              default:
                                return "th";
                            }
                          };

                          const suffix1 = getOrdinalSuffix(day1);
                          const suffix2 = getOrdinalSuffix(day2);

                          // Format date with proper suffix
                          const formatDate = (date, suffix) => {
                            return (
                              date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              }) + suffix
                            );
                          };

                          return `${formatDate(date1, suffix1)} - ${formatDate(
                            date2,
                            suffix2
                          )} (3-5 working days)`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Out of stock notification form */}
              {!isInStock && !hasInventoryNotification && (
                <div className="p-3 sm:p-4 border border-red-300 bg-red-50 rounded-lg text-red-700">
                  <h4 className="font-medium mb-2 flex items-center gap-2 text-sm sm:text-base">
                    <AlertCircle className="h-4 w-4" />
                    Get notified when back in stock
                  </h4>
                  <form
                    onSubmit={handleInventoryNotification}
                    className="flex flex-col gap-2"
                  >
                    <input
                      type="text"
                      className="rounded border-gray-300 p-2 text-sm"
                      placeholder="Your email address or mobile number"
                      value={emailForNotification}
                      onChange={(e) => setEmailForNotification(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                    <Button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm py-2 h-auto"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Notify Me"
                      )}
                    </Button>
                    <p className="text-xs text-gray-600 mt-1">
                      We'll notify you once this item is back in stock. No spam.
                    </p>
                  </form>
                </div>
              )}

              {/* Success notification state */}
              {!isInStock && hasInventoryNotification && (
                <div className="p-3 sm:p-4 border border-green-300 bg-green-50 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-green-600" />
                  <div>
                    <p className="text-xs sm:text-sm text-green-700 font-medium">
                      You'll be notified when this item is back in stock
                    </p>
                    <button
                      onClick={() => setHasInventoryNotification(false)}
                      className="text-xs text-green-600 underline mt-1"
                    >
                      Use another email/phone
                    </button>
                  </div>
                </div>
              )}

              {/* {hasInventoryNotification && (
                <div className="p-2 sm:p-3 border border-green-300 bg-green-50 rounded-lg text-green-700 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <p className="text-xs sm:text-sm">
                    You'll be notified when this item is back in stock
                  </p>
                </div>
              )} */}
            </div>
          </div>

          {/* Product Info Tabs - Enhanced for Mobile */}
          <div className="px-3 sm:px-6 pb-4 sm:pb-6">
            <Tabs
              defaultValue="description"
              className="mt-4 sm:mt-6 flex flex-col w-full"
            >
              {/* Mobile-optimized tabs that stack in a 2x2 grid on mobile */}
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 gap-1">
                <TabsTrigger
                  value="description"
                  className="text-xs sm:text-sm py-1.5 sm:py-2 px-1 sm:px-2 h-auto"
                >
                  <b>Description</b>
                </TabsTrigger>
                <TabsTrigger
                  value="specs"
                  className="text-xs sm:text-sm py-1.5 sm:py-2 px-1 sm:px-2 h-auto"
                >
                  <b>Specifications</b>
                </TabsTrigger>
              </TabsList>

              {/* Description Tab */}
              <TabsContent
                value="description"
                className="p-3 sm:p-4 bg-white rounded-b-md border border-t-0"
              >
                <p className="mb-4 text-xs sm:text-sm md:text-base">
                  <b>{product.description}</b>
                </p>
                <ProductFeatures />
              </TabsContent>

              {/* Specifications Tab */}
              <TabsContent
                value="specs"
                className="p-3 sm:p-4 bg-white rounded-b-md border border-t-0"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <div className="space-y-2">
                    {/* <div className="flex justify-between p-1.5 sm:p-2 bg-gray-50 rounded text-xs sm:text-sm">
                      <span className="font-medium">Part Number</span>
                      <span className="font-bold">{product.partNumber}</span>
                    </div> */}
                    <div className="flex justify-between p-1.5 sm:p-2 bg-gray-50 rounded text-xs sm:text-sm">
                      <span className="font-medium">Brand</span>
                      <span className="font-bold">{product.brand}</span>
                    </div>
                    <div className="flex justify-between p-1.5 sm:p-2 bg-gray-50 rounded text-xs sm:text-sm">
                      <span className="font-medium">Material</span>
                      <span className="font-bold">High-grade aluminum</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between p-1.5 sm:p-2 bg-gray-50 rounded text-xs sm:text-sm">
                      <span className="font-medium">Weight</span>
                      <span className="font-bold">1.2 lbs</span>
                    </div>
                    <div className="flex justify-between p-1.5 sm:p-2 bg-gray-50 rounded text-xs sm:text-sm">
                      <span className="font-medium">Dimensions</span>
                      <span className="font-bold">6" × 4" × 2"</span>
                    </div>
                    <div className="flex justify-between p-1.5 sm:p-2 bg-gray-50 rounded text-xs sm:text-sm">
                      <span className="font-medium">Warranty</span>
                      <span className="font-bold">2 Years</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Compatibility Tab */}
              <TabsContent
                value="compatibility"
                className="p-3 sm:p-4 bg-white rounded-b-md border border-t-0"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
                  {compatibleVehicles.map((make, idx) => (
                    <div
                      key={idx}
                      className="bg-green-50 p-2 sm:p-3 rounded-md border border-green-100"
                    >
                      <h4 className="font-medium text-green-700 mb-1 text-xs sm:text-sm">
                        {make.make}
                      </h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                        {make.models.map((model, i) => (
                          <li key={i}>{model}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 sm:mt-4 text-green-700 border-green-300 w-full text-xs py-1.5 h-auto"
                  onClick={() => setShowComparisonTable(!showComparisonTable)}
                >
                  {showComparisonTable
                    ? "Hide Full Compatibility Chart"
                    : "View Full Compatibility Chart"}
                </Button>

                {showComparisonTable && (
                  <div className="mt-3 sm:mt-4 border border-green-200 rounded-lg overflow-hidden">
                    <div className="max-w-full overflow-x-auto">
                      <table className="min-w-full divide-y divide-green-200">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-green-700 font-medium text-xs">
                              Make
                            </th>
                            <th className="px-2 py-1.5 text-left text-green-700 font-medium text-xs">
                              Model
                            </th>
                            <th className="px-2 py-1.5 text-left text-green-700 font-medium text-xs">
                              Year
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {compatibleVehicles
                            .flatMap((vehicle) =>
                              vehicle.models.map((model) => ({
                                make: vehicle.make,
                                model,
                                year: "2018-2023",
                              }))
                            )
                            .map((row, idx) => (
                              <tr
                                key={idx}
                                className={
                                  idx % 2 === 0 ? "bg-green-50/30" : ""
                                }
                              >
                                <td className="px-2 py-1.5 text-xs">
                                  {row.make}
                                </td>
                                <td className="px-2 py-1.5 text-xs">
                                  {row.model}
                                </td>
                                <td className="px-2 py-1.5 text-xs">
                                  {row.year}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Warranty Tab */}
              <TabsContent
                value="warranty"
                className="p-3 sm:p-4 bg-white rounded-b-md border border-t-0"
              >
                <div className="flex items-start gap-2 mb-3">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-green-700 font-semibold text-sm sm:text-base mb-1">
                      2-Year Limited Warranty
                    </h4>
                    <p className="mb-2 text-xs sm:text-sm">
                      This product is covered by a 2-year limited warranty from
                      the date of purchase. The warranty covers manufacturing
                      defects and premature failure under normal use conditions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="font-medium mb-1 text-sm sm:text-base">
                      How to claim your warranty:
                    </h5>
                    <ol className="list-decimal ml-4 sm:ml-5 space-y-1 text-sm sm:text-base">
                      <li>Keep your proof of purchase</li>
                      <li>
                        Contact our support team at support@sisiraautoparts.com
                      </li>
                      <li>
                        Include your order number and description of the issue
                      </li>
                      <li>We'll guide you through the next steps</li>
                    </ol>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-green-700">
                Related Products
              </h2>

              <Button variant="ghost" className="text-green-700">
                View All <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            <ProductGrid products={relatedProducts} />
          </div>
        )}

        {/* Recently Viewed Products */}
        {/* {recentlyViewedProducts.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-blue-700">
                Recently Viewed
              </h2>
            </div>

            <ProductGrid products={recentlyViewedProducts} />
          </div>
        )} */}
      </div>
    </MainLayout>
  );
}
