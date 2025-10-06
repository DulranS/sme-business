import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PriceFormatter } from "@/components/ui/price-formatter";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/lib/cart";
import { MessageCircle } from "lucide-react";
import { CheckCircle } from "lucide-react";

export function CartSummary() {
  const cart = useCart();
  const items = cart.items;
  const totalPrice = cart.totalPrice();
  const [showThankYou, setShowThankYou] = useState(false);

  const handleWhatsAppCheckout = () => {
    let message =
      "Hello Sisira Auto Parts, I would like to order the following items:\n\n";

    items.forEach((item, index) => {
      // Calculate the discounted price correctly
      const price =
        item.product.discountPercentage > 0
          ? item.product.price * (1 - item.product.discountPercentage / 100)
          : item.product.price;

      const totalItemPrice = price * item.quantity;

      message += `${index + 1}. ${item.product.name} : Part Number (${
        item.product.partNumber
      })\n`;
      message += `   Quantity: ${item.quantity}\n`;
      message += `   Price: Rs. ${price.toLocaleString()} x ${
        item.quantity
      } = Rs. ${totalItemPrice.toLocaleString()}\n\n`;
    });

    // Calculate the total price with correct discount application
    const discountedTotal = items.reduce((acc, item) => {
      const price =
        item.product.discountPercentage > 0
          ? item.product.price * (1 - item.product.discountPercentage / 100)
          : item.product.price;
      return acc + price * item.quantity;
    }, 0);

    message += `Total: Rs. ${discountedTotal.toLocaleString()}\n\n`;
    message += "Please let me know how to proceed with payment and delivery.";

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/+94772091359?text=${encodedMessage}`, "_blank");

    cart.clearCart();
    setShowThankYou(true);
  };

  // Thank you page component
  if (showThankYou) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-white rounded-lg shadow">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <h2 className="text-2xl font-bold text-center">
          Thank You for Your Order!
        </h2>
        <p className="text-center text-gray-600">
          Your order has been sent to Sisira Auto Parts via WhatsApp. They will
          contact you shortly to confirm your order and arrange payment and
          delivery.
        </p>
        <Button
          onClick={() => setShowThankYou(false)}
          variant="outline"
          className="mt-4"
        >
          Return to Shopping
        </Button>
      </div>
    );
  }

  // Regular cart summary component
  return (
    <div className="space-y-4 bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-bold">Order Summary</h2>
      <div className="flex justify-between">
        <span>Subtotal ({cart.totalItems()} items)</span>
        <PriceFormatter price={totalPrice} />
      </div>
      <div className="flex justify-between">
        <span>Delivery</span>
        <span>Calculated at checkout</span>
      </div>
      <Separator />
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <PriceFormatter price={totalPrice} />
      </div>
      <Button
        onClick={handleWhatsAppCheckout}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        <MessageCircle className="mr-2 h-5 w-5" />
        Buy via WhatsApp
      </Button>
      <p className="text-sm text-gray-500">
        By clicking "Buy via WhatsApp", you'll be redirected to WhatsApp to
        complete your order.
      </p>
    </div>
  );
}
