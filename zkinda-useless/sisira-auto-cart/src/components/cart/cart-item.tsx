import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PriceFormatter } from "@/components/ui/price-formatter";
import { CartItem as CartItemType } from "@/types";
import { useCart } from "@/lib/cart";
import { Trash, Plus, Minus } from "lucide-react";

interface CartItemProps {
  item: CartItemType;
}

export function CartItem({ item }: CartItemProps) {
  const { product, quantity } = item;
  const cart = useCart();
  const [itemQuantity, setItemQuantity] = useState(quantity);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(e.target.value);
    if (
      isNaN(newQuantity) ||
      newQuantity < 1 ||
      newQuantity > product.stockQuantity
    )
      return;
    setItemQuantity(newQuantity);
    cart.updateQuantity(product.id, newQuantity);
  };

  const incrementQuantity = () => {
    if (itemQuantity >= product.stockQuantity) return;
    const newQuantity = itemQuantity + 1;
    setItemQuantity(newQuantity);
    cart.updateQuantity(product.id, newQuantity);
  };

  const decrementQuantity = () => {
    if (itemQuantity <= 1) return;
    const newQuantity = itemQuantity - 1;
    setItemQuantity(newQuantity);
    cart.updateQuantity(product.id, newQuantity);
  };

  // Apply discount to price
  const discountedPrice = product.discountPercentage > 0
    ? product.price * (1 - product.discountPercentage / 100)
    : product.price;

  // Calculate total price for this item
  const totalItemPrice = discountedPrice * itemQuantity;

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row">
          <div className="w-full sm:w-24 h-24 bg-muted/50 rounded overflow-hidden flex-shrink-0 mb-4 sm:mb-0">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 sm:ml-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
              <div>
                <h3 className="font-medium">
                  <Link
                    to={`/products/${product.id}`}
                    className="hover:text-primary"
                  >
                    {product.name}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {product.partNumber}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    {product.category}
                  </span>
                  <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded">
                    {product.brand}
                  </span>
                </div>
              </div>

              <div className="flex items-center mt-4 sm:mt-0">
                <PriceFormatter
                  price={discountedPrice}
                  className="font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4">
              <div className="flex items-center">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-r-none"
                  onClick={decrementQuantity}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={product.stockQuantity}
                  value={itemQuantity}
                  onChange={handleQuantityChange}
                  className="h-8 w-16 rounded-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-l-none"
                  onClick={incrementQuantity}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="flex items-center mt-4 sm:mt-0">
                <PriceFormatter
                  price={totalItemPrice}
                  className="font-bold ml-4"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 text-destructive hover:text-destructive/90"
                  onClick={() => cart.removeItem(product.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
