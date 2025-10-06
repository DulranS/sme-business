import { useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Menu, X, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const cart = useCart();
  const totalItems = cart.totalItems();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container flex h-20 items-center">
        <div className="flex items-center gap-4 md:w-1/3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] sm:w-[300px]">
              <div className="flex justify-center mb-6 mt-4">
                <Link to="/" onClick={() => setIsMenuOpen(false)}>
                  <img
                    src="/logo.png"
                    alt="Sisira Auto Parts"
                    className="h-16 w-auto"
                  />
                </Link>
              </div>
              <nav className="flex flex-col gap-4">
                <Link
                  to="/"
                  className="text-lg font-semibold hover:text-green-600"
                >
                  Home
                </Link>
                <Link
                  to="/products"
                  className="text-lg font-semibold hover:text-green-600"
                >
                  Products
                </Link>
                <Link
                  to="/admin"
                  className="text-lg font-semibold hover:text-green-600"
                >
                  Admin
                </Link>
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center">
            <div className="overflow-hidden">
              <img
                src="/logo.png"
                alt="Sisira Auto Parts"
                className="h-10 sm:h-12 md:h-14 w-auto object-contain max-w-[150px] sm:max-w-[180px] transition-all duration-300"
              />
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 ml-6">
            <Link to="/" className="text-sm font-medium hover:text-green-600">
              Home
            </Link>
            <Link
              to="/products"
              className="text-sm font-medium hover:text-green-600"
            >
              Products
            </Link>
            {/* <Link
              to="/admin"
              className="text-sm font-medium hover:text-green-600"
            >
              Admin
            </Link> */}
          </nav>
        </div>

        {/* Central Text */}
        <div className="flex-1 flex justify-center">
          <Link to="/">
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-green-600 sm:px-4 py-1 rounded-lg text-center whitespace-nowrap">
              <b>Sisira Auto Parts</b>
            </h1>
          </Link>
        </div>

        <div className="flex items-center gap-2 justify-end md:w-1/3">
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5 text-green-600" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Button>
          </Link>

          {/* <Link to="/admin">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5 text-red-600" />
            </Button>
          </Link> */}
        </div>
      </div>
    </header>
  );
}
