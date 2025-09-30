import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/main-layout';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/components/cart/cart-item';
import { CartSummary } from '@/components/cart/cart-summary';
import { useCart } from '@/lib/cart';
import { ShoppingCart, MoveLeft } from 'lucide-react';

export default function CartPage() {
  const cart = useCart();
  const items = cart.items;
  
  return (
    <MainLayout>
      <div className="container px-4 sm:px-6 py-6 sm:py-8 max-w-7xl mx-auto">
        <Breadcrumb className="mb-4 sm:mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" className="text-green-600 hover:text-green-800 transition-colors">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Shopping Cart</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Your Shopping Cart</h1>
        
        {items.length === 0 ? (
          <div className="text-center py-12 sm:py-16 bg-gradient-to-b from-gray-50 to-muted/30 rounded-xl shadow-sm border">
            <div className="flex justify-center">
              <ShoppingCart className="h-16 w-16 sm:h-20 sm:w-20 text-red-600 mb-4 animate-pulse" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto px-4">
              Browse our products and add some items to your cart.
            </p>
            <Button asChild size="lg" className="bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all">
              <Link to="/products" className="flex items-center">
                <MoveLeft className="mr-2 h-4 w-4" />
                Browse Products
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6 mb-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-2 border-b">
                  <h3 className="font-bold text-lg">Items ({cart.totalItems()})</h3>
                  <Button 
                    variant="ghost" 
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 transition-colors self-start sm:self-auto" 
                    onClick={() => cart.clearCart()}
                  >
                    Clear Cart
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {items.map((item) => (
                    <CartItem key={item.product.id} item={item} />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2 ml-1 mb-6 lg:mb-0">
                <MoveLeft className="h-4 w-4 text-green-600" />
                <Link to="/products" className="text-green-600 hover:text-green-800 hover:underline transition-colors font-medium">
                  Continue Shopping
                </Link>
              </div>
            </div>
            
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <CartSummary />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}