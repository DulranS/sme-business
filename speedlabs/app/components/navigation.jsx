import { MenuIcon, XIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Transition } from "../components/ui/transition";
import Link from "next/link";
import Image from "next/image";

export const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.pageYOffset > 0);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`bg-red-600 text-white shadow-md fixed w-full z-50 top-0 left-0 transition-all duration-300 ${
        isScrolled ? "py-3 bg-opacity-95 shadow-lg" : "py-4 bg-opacity-100 shadow-md"
      }`}
    >
      <div className="container mx-auto flex justify-between items-center px-6 sm:px-8 lg:px-10">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src={"https://res.cloudinary.com/dsto9mmt0/image/upload/v1731627792/ax3lomhcoldgrym71jra.png"}
            alt="Brand Logo"
            width={90}
            height={90}
            priority
          />
        </Link>

        {/* Desktop Menu */}
        <ul className="hidden md:flex space-x-8 text-lg font-semibold">
          <li>
            <Link href="#services" className="hover:text-red-200 transition-colors duration-300 relative">
              Services
              <div className={`absolute w-0 h-0.5 bg-white left-0 bottom-0 transition-all duration-300 ${isScrolled ? "w-full" : "w-0"}`}></div>
            </Link>
          </li>
          <li>
            <Link href="#gallery" className="hover:text-red-200 transition-colors duration-300 relative">
              Gallery
              <div className={`absolute w-0 h-0.5 bg-white left-0 bottom-0 transition-all duration-300 ${isScrolled ? "w-full" : "w-0"}`}></div>
            </Link>
          </li>
          <li>
            <Link href="#contact" className="hover:text-red-200 transition-colors duration-300 relative">
              Contact
              <div className={`absolute w-0 h-0.5 bg-white left-0 bottom-0 transition-all duration-300 ${isScrolled ? "w-full" : "w-0"}`}></div>
            </Link>
          </li>
        </ul>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden focus:outline-none text-white hover:text-red-200 transition duration-300"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <XIcon className="h-8 w-8" /> : <MenuIcon className="h-8 w-8" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <Transition
        show={isMenuOpen}
        enter="transition ease-out duration-300 transform"
        enterFrom="-translate-y-full"
        enterTo="translate-y-0"
        leave="transition ease-in duration-300 transform"
        leaveFrom="translate-y-0"
        leaveTo="-translate-y-full"
      >
        <div className="fixed top-0 left-0 right-0 bg-red-700 bg-opacity-95 p-6 md:hidden transition-transform transform translate-x-0 ease-in-out duration-300 z-40">
          <ul className="space-y-6 text-center text-xl font-semibold text-white">
            <li>
              <Link href="#services" className="block py-3 hover:text-red-200 transition-colors duration-300" onClick={() => setIsMenuOpen(false)}>
                Services
              </Link>
            </li>
            <li>
              <Link href="#gallery" className="block py-3 hover:text-red-200 transition-colors duration-300" onClick={() => setIsMenuOpen(false)}>
                Gallery
              </Link>
            </li>
            <li>
              <Link href="#contact" className="block py-3 hover:text-red-200 transition-colors duration-300" onClick={() => setIsMenuOpen(false)}>
                Contact
              </Link>
            </li>
          </ul>
        </div>
      </Transition>
    </nav>
  );
};