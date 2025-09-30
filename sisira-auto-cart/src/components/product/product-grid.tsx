import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceFormatter } from "@/components/ui/price-formatter";
import { Product } from "@/types";
import {
  Tag,
  ShoppingCart,
  Star,
  Eye,
  ArrowUpDown,
  CheckCircle2,
  SlidersHorizontal,
  Grid3X3,
  GridIcon,
  ChevronDown,
  Heart,
  RotateCw,
  Truck,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products: initialProducts }: ProductGridProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sortOption, setSortOption] = useState<string>("featured");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [inStockOnly, setInStockOnly] = useState<boolean>(false);

  // Update products when initialProducts changes
  useEffect(() => {
    let filteredProducts = [...initialProducts];

    // Apply in-stock filter if enabled
    if (inStockOnly) {
      filteredProducts = filteredProducts.filter((p) => p.stockQuantity > 0);
    }

    // Apply brand filter if any brands are selected
    if (selectedBrands.length > 0) {
      filteredProducts = filteredProducts.filter(
        (p) => p.brand && selectedBrands.includes(p.brand)
      );
    }

    // Apply sorting
    const sortedProducts = sortProducts(filteredProducts, sortOption);
    setProducts(sortedProducts);
  }, [initialProducts, sortOption, inStockOnly, selectedBrands]);

  // Get unique brands from products
  const allBrands = Array.from(
    new Set(
      initialProducts.map((p) => p.brand).filter((brand) => brand) as string[]
    )
  );

  // Sort products based on selected option
  const sortProducts = (
    productsToSort: Product[],
    option: string
  ): Product[] => {
    const productsCopy = [...productsToSort];

    switch (option) {
      case "price-low-high":
        return productsCopy.sort((a, b) => a.price - b.price);
      case "price-high-low":
        return productsCopy.sort((a, b) => b.price - a.price);
      case "newest":
        return productsCopy.sort((a, b) => {
          // Assuming there's a createdAt field, otherwise use id as fallback
          const dateA = a.createdAt
            ? new Date(a.createdAt).getTime()
            : parseInt(a.id);
          const dateB = b.createdAt
            ? new Date(b.createdAt).getTime()
            : parseInt(b.id);
          return dateB - dateA;
        });
      case "name-a-z":
        return productsCopy.sort((a, b) => a.name.localeCompare(b.name));
      case "name-z-a":
        return productsCopy.sort((a, b) => b.name.localeCompare(a.name));
      case "popularity":
        // Placeholder for popularity sorting - would need real data
        return productsCopy;
      case "featured":
      default:
        // Default to original order
        return productsCopy;
    }
  };

  // Toggle brand selection
  const toggleBrand = (brand: string) => {
    if (selectedBrands.includes(brand)) {
      setSelectedBrands(selectedBrands.filter((b) => b !== brand));
    } else {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-xl shadow-inner">
        <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <p className="text-xl text-gray-500 font-medium">No products found.</p>
        <p className="text-gray-400 mt-2">
          Try adjusting your filters or search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sort and View Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-gray-700"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
            <ChevronDown
              className={`h-4 w-4 ml-1 transform transition-transform ${
                showFilters ? "rotate-180" : ""
              }`}
            />
          </Button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={inStockOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInStockOnly(!inStockOnly)}
                  className={
                    inStockOnly
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "text-gray-700"
                  }
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  In Stock
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Show only in-stock products</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-gray-700">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort:{" "}
                {sortOption === "price-low-high"
                  ? "Price: Low to High"
                  : sortOption === "price-high-low"
                  ? "Price: High to Low"
                  : sortOption === "newest"
                  ? "Newest First"
                  : sortOption === "name-a-z"
                  ? "Name: A to Z"
                  : sortOption === "name-z-a"
                  ? "Name: Z to A"
                  : sortOption === "popularity"
                  ? "Most Popular"
                  : "Featured"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSortOption("featured")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "featured" ? "opacity-100" : "opacity-0"
                  }`}
                />
                Featured
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("price-low-high")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "price-low-high"
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                />
                Price: Low to High
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("price-high-low")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "price-high-low"
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                />
                Price: High to Low
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortOption("newest")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "newest" ? "opacity-100" : "opacity-0"
                  }`}
                />
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("name-a-z")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "name-a-z" ? "opacity-100" : "opacity-0"
                  }`}
                />
                Name: A to Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("name-z-a")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "name-z-a" ? "opacity-100" : "opacity-0"
                  }`}
                />
                Name: Z to A
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption("popularity")}>
                <CheckCircle2
                  className={`h-4 w-4 mr-2 ${
                    sortOption === "popularity" ? "opacity-100" : "opacity-0"
                  }`}
                />
                Most Popular
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className={`h-8 w-8 rounded-none ${
                viewMode === "grid" ? "bg-blue-600 hover:bg-blue-700" : ""
              }`}
              onClick={() => setViewMode("grid")}
            >
              <GridIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className={`h-8 w-8 rounded-none ${
                viewMode === "list" ? "bg-blue-600 hover:bg-blue-700" : ""
              }`}
              onClick={() => setViewMode("list")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Brand filters */}
      {showFilters && allBrands.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm transition-all duration-300">
          <h3 className="font-medium mb-3 text-gray-700">Filter by Brand</h3>
          <div className="flex flex-wrap gap-2">
            {allBrands.map((brand) => (
              <Button
                key={brand}
                variant={selectedBrands.includes(brand) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleBrand(brand)}
                className={
                  selectedBrands.includes(brand)
                    ? "bg-blue-600 hover:bg-blue-700"
                    : ""
                }
              >
                {brand}
                {selectedBrands.includes(brand) && (
                  <CheckCircle2 className="ml-2 h-3 w-3" />
                )}
              </Button>
            ))}
            {selectedBrands.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBrands([])}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Product Grid or List */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <Card
              key={product.id}
              className="product-card overflow-hidden group transition-all duration-300 hover:shadow-xl border border-gray-200 hover:border-blue-300 h-full flex flex-col bg-white relative"
            >
              <Link
                to={`/products/${product.id}`}
                className="flex flex-col h-full"
              >
                <div className="aspect-square overflow-hidden relative bg-gray-50">
                  <img
                    src={product.images?.[0] || "/logo.png"}
                    alt={product.name}
                    className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/logo.png"; // Fallback image
                    }}
                  />

                  {/* Top badges */}
                  <div className="absolute top-0 left-0 p-2 sm:p-3 z-10 w-full flex flex-wrap gap-1 sm:gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-black/70 text-white border-none backdrop-blur-sm font-medium text-xs sm:text-sm"
                    >
                      <Tag className="mr-1 h-3 w-3" />
                      {product.category}
                    </Badge>

                    {product.brand && (
                      <Badge
                        variant="outline"
                        className="bg-blue-600 text-white border-none backdrop-blur-sm font-medium text-xs sm:text-sm"
                      >
                        {product.brand}
                      </Badge>
                    )}
                  </div>

                  {/* Badges for stock status */}
                  <div className="absolute bottom-2 right-2 z-10">
                    {product.stockQuantity === 0 ? (
                      <Badge className="bg-red-500/90 backdrop-blur-sm text-white px-3 py-1 text-xs">
                        Out of Stock
                      </Badge>
                    ) : (
                      <Badge className="bg-green-500/90 backdrop-blur-sm text-white px-3 py-1 text-xs">
                        In Stock
                      </Badge>
                    )}
                  </div>

                  {/* Hover overlay with quick actions */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-white hover:bg-white/90 text-black font-medium"
                    >
                      <Eye className="mr-2 h-4 w-4" /> Quick View
                    </Button>
                    {/* <Button variant="secondary" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
                      <Truck className="mr-2 h-4 w-4" /> Check Delivery
                    </Button> */}
                  </div>
                </div>

                <div className="absolute top-2 right-2 z-20">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-white/80 hover:bg-white text-gray-700 hover:text-red-500"
                    onClick={(e) => {
                      e.preventDefault();
                      // Add to wishlist functionality would go here
                    }}
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>

                <CardHeader className="p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-sm sm:text-base md:text-lg font-semibold group-hover:text-blue-600 transition-colors line-clamp-2">
                    {product.name}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-3 sm:p-4 pt-1 flex-grow flex flex-col justify-between">
                  <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-3 line-clamp-2">
                    {product.description}
                  </p>

                  <div className="mt-auto space-y-2 sm:space-y-3">
                    {/* Rating stars */}
                    <div className="flex items-center">
                      <div className="flex text-amber-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">(5.0)</span>
                    </div>

                    {/* Price and inventory area */}
                    <div className="flex items-center justify-between">
                      {product.discountPercentage > 0 ? (
                        <div className="flex flex-col">
                          <PriceFormatter
                            price={product.price * (1 - product.discountPercentage / 100)}
                            className="font-bold text-base sm:text-lg text-blue-600"
                          />
                          <div className="flex items-center gap-2">
                            <PriceFormatter
                              price={product.price}
                              className="text-xs text-gray-500 line-through"
                            />
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-sm font-medium">
                              {product.discountPercentage}% OFF
                            </span>
                          </div>
                        </div>
                      ) : (
                        <PriceFormatter
                          price={product.price}
                          className="font-bold text-base sm:text-lg text-blue-600"
                        />
                      )}

                      {product.stockQuantity > 0 && product.stockQuantity <= 5 && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                          Only {product.stockQuantity} left
                        </span>
                      )}
                    </div>

                    {/* Tags area */}
                    <div className="flex flex-wrap gap-1 pt-1 sm:pt-2">
                      {product.subcategory && (
                        <span className="text-xs px-2 py-0.5 sm:py-1 bg-gray-100 rounded-full font-medium text-gray-700">
                          {product.subcategory}
                        </span>
                      )}
                      {/* {product.partNumber && (
                        <span className="text-xs px-2 py-0.5 sm:py-1 bg-gray-100 rounded-full font-medium text-gray-700">
                          Part #{product.partNumber}
                        </span>
                      )} */}
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        // List View
        <div className="space-y-4">
          {products.map((product) => (
            <Card
              key={product.id}
              className="product-card overflow-hidden group transition-all duration-300 hover:shadow-lg border border-gray-200 hover:border-blue-300 bg-white"
            >
              <Link
                to={`/products/${product.id}`}
                className="flex flex-col md:flex-row"
              >
                <div className="aspect-square md:aspect-auto md:w-48 md:h-48 overflow-hidden relative bg-gray-50 flex-shrink-0">
                  <img
                    src={product.images?.[0] || "/logo.png"}
                    alt={product.name}
                    className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "/logo.png"; // Fallback image
                    }}
                  />

                  {/* Badges */}
                  <div className="absolute top-2 left-2 z-10">
                    <Badge
                      variant="secondary"
                      className="bg-black/70 text-white border-none backdrop-blur-sm font-medium text-xs"
                    >
                      {product.category}
                    </Badge>
                  </div>

                  {/* Stock status */}
                  {product.stockQuantity === 0 && (
                    <div className="absolute bottom-2 left-2 z-10">
                      <Badge className="bg-red-500/90 backdrop-blur-sm text-white px-2 py-0.5 text-xs">
                        Out of Stock
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col flex-grow justify-between">
                  <div>
                    <h3 className="font-semibold text-lg mb-1 group-hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>

                    <div className="flex items-center text-xs mb-2">
                      <div className="flex text-amber-400 mr-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                      <span className="text-gray-500">(5.0)</span>
                      {product.brand && (
                        <>
                          <span className="mx-2 text-gray-300">|</span>
                          <span className="font-medium">{product.brand}</span>
                        </>
                      )}
                      {product.partNumber && (
                        <>
                          <span className="mx-2 text-gray-300">|</span>
                          <span>Part #{product.partNumber}</span>
                        </>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {product.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {product.subcategory && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full font-medium text-gray-700">
                          {product.subcategory}
                        </span>
                      )}
                      {product.stockQuantity > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 rounded-full font-medium text-green-700 flex items-center">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    {product.discountPercentage > 0 ? (
                      <div className="flex flex-col">
                        <PriceFormatter
                          price={product.price * (1 - product.discountPercentage / 100)}
                          className="font-bold text-lg text-blue-600"
                        />
                        <div className="flex items-center gap-2">
                          <PriceFormatter
                            price={product.price}
                            className="text-xs text-gray-500 line-through"
                          />
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-sm font-medium">
                            {product.discountPercentage}% OFF
                          </span>
                        </div>
                      </div>
                    ) : (
                      <PriceFormatter
                        price={product.price}
                        className="font-bold text-lg text-blue-600"
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-700 hidden sm:flex"
                        onClick={(e) => {
                          e.preventDefault();
                          // Add to wishlist functionality
                        }}
                      >
                        <Heart className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Products count and pagination */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <p className="text-sm text-gray-500">
          Showing <span className="font-medium">{products.length}</span> out of{" "}
          <span className="font-medium">{initialProducts.length}</span> products
        </p>

        <Button variant="outline" size="sm" className="text-gray-700">
          <RotateCw className="h-4 w-4 mr-2" />
          Load More
        </Button>
      </div>
    </div>
  );
}