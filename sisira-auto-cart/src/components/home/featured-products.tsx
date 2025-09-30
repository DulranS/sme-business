import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriceFormatter } from "@/components/ui/price-formatter";
import { useCart } from "@/lib/cart";
import { fetchFeaturedProducts } from "@/lib/product-service";
import { ShoppingCart, ExternalLink, Star, Check, Package } from "lucide-react";

// Import the Product type from the shared types file
import { Product } from "@/types";

// Add shuffle function to randomize product order
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function FeaturedProducts() {
  const [products, setProducts] = useState<Product[]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();

  useEffect(() => {
    async function loadFeaturedProducts() {
      try {
        setLoading(true);
        const data = await fetchFeaturedProducts(1, 4);
        // Apply shuffle to randomize products order
        setProducts(shuffleArray(data.products));
        setError(null);
      } catch (err) {
        setError("Failed to load featured products. Please try again later.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadFeaturedProducts();
  }, []);

  if (loading) {
    return (
      <section className="py-8 md:py-16 bg-gradient-to-b from-green-50 to-white">
        <div className="container px-4 mx-auto text-center">
          <p>Loading featured products...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8 md:py-16 bg-gradient-to-b from-green-50 to-white">
        <div className="container px-4 mx-auto text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-16 bg-gradient-to-b from-green-50 to-white">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-8 border-b border-green-200 pb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-green-800 flex items-center mb-4 sm:mb-0">
            <Star className="h-5 w-5 md:h-6 md:w-6 text-yellow-500 mr-2 fill-yellow-400" />
            Featured Parts
          </h2>
          <Link
            to="/products"
            className="text-white hover:text-green-800 flex items-center bg-green-800 hover:bg-green-700 px-3 py-1 md:px-4 md:py-2 rounded-full transition-all duration-200 text-sm font-medium"
          >
            View All Products
            <ExternalLink className="ml-1 h-3 w-3 md:h-4 md:w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {products.length ? (
            products.map(
              (product) =>
                product.stockQuantity > 0 && (
                  <Card
                    key={product.id}
                    className="product-card overflow-hidden border border-gray-200 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl flex flex-col h-full"
                  >
                    <Link
                      to={`/products/${product.id}`}
                      className="block relative"
                    >
                      <div className="absolute top-2 right-2 z-10">
                        {product.stockQuantity > 0 && (
                          <div className="flex items-center bg-green-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                            <Check className="h-3 w-3 mr-1" /> In Stock
                          </div>
                        )}
                      </div>
                      <div className="aspect-square overflow-hidden bg-white">
                        <img
                          src={product.images[0] || "/logo.png"}
                          alt={product.name}
                          className="h-full w-full object-contain p-4 transition-transform hover:scale-110"
                        />
                      </div>
                      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/60 to-transparent h-16 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    </Link>

                    <CardHeader className="p-3 md:p-4 pb-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <div className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          {product.category}
                        </div>
                        <div className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          {product.brand}
                        </div>
                      </div>
                      <CardTitle className="text-base md:text-lg font-bold line-clamp-2 min-h-12">
                        <Link
                          to={`/products/${product.id}`}
                          className="hover:text-green-700 transition-colors"
                        >
                          {product.name}
                        </Link>
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="p-3 md:p-4 pt-2 flex-grow">
                      <p className="text-xs md:text-sm text-gray-600 mb-3 line-clamp-2 min-h-10">
                        {product.description}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <Package className="h-3 w-3 mr-1" />
                        Part #:{" "}
                        <span className="font-mono ml-1">
                          {product.partNumber}
                        </span>
                      </div>
                    </CardContent>

                    <CardFooter className="p-3 md:p-4 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                      <PriceFormatter
                        price={product.price}
                        className="font-bold text-base md:text-lg text-green-700"
                      />
                      <Button
                        size="sm"
                        onClick={() => cart.addItem(product)}
                        className="gap-1 bg-green-700 hover:bg-green-800 w-full sm:w-auto rounded-full px-3 md:px-4 text-xs md:text-sm"
                      >
                        <ShoppingCart className="h-3 w-3 md:h-4 md:w-4" />
                        Add to Cart
                      </Button>
                    </CardFooter>

                    {product.discountPercentage > 0 && (
                      <div className="absolute top-3 left-3 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                        {product.discountPercentage}% OFF
                      </div>
                    )}
                  </Card>
                )
            )
          ) : (
            <p className="col-span-full text-center text-gray-500">
              No featured products found
            </p>
          )}
        </div>
      </div>
    </section>
  );
}