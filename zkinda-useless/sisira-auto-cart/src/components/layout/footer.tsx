import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, Facebook, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-green-700 text-white pt-12 pb-8">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">
              <span className="text-white">Sisira</span>
              <span className="text-red-300"> Auto Parts</span>
            </h3>
            <p className="mb-4">
              Your trusted auto parts supplier in Nugegoda, Sri Lanka. Providing
              quality parts since 2005.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://www.facebook.com/profile.php?id=61574994975673"
                className="hover:text-red-300"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://www.instagram.com/sisiraautoparts/"
                className="hover:text-red-300"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.tiktok.com/@sisiraautoparts"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-300 hover:text-black transition duration-300"
                aria-label="Visit our TikTok page"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.93 9.36c-.56-.1-1.08-.3-1.54-.56-.46-.26-.87-.6-1.22-1.02v5.1c0 1.12-.4 2.08-1.2 2.88-.8.8-1.76 1.2-2.88 1.2-1.12 0-2.08-.4-2.88-1.2-.8-.8-1.2-1.76-1.2-2.88s.4-2.08 1.2-2.88c.8-.8 1.76-1.2 2.88-1.2.28 0 .56.03.84.08v2.08c-.28-.08-.56-.12-.84-.12-.64 0-1.2.24-1.68.72-.48.48-.72 1.04-.72 1.68s.24 1.2.72 1.68c.48.48 1.04.72 1.68.72.64 0 1.2-.24 1.68-.72.48-.48.72-1.04.72-1.68V7.5h2.04c.2.8.6 1.48 1.2 2.04.6.56 1.28.92 2.04 1.08v2.04z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 text-red-300">
              Contact Us
            </h3>
            <div className="space-y-2">
              <p className="flex items-center">
                <MapPin className="h-5 w-5 mr-2 text-red-300" />
                No 568A Highlevel Road Gangodawila Nugegoda, Sri Lanka
              </p>
              <p className="flex items-center">
                <Phone className="h-5 w-5 mr-2 text-red-300" />
                0777631688
              </p>
              <p className="flex items-center">
                <Mail className="h-5 w-5 mr-2 text-red-300" />
                sisiraautopartsofficial@gmail.com
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4 text-red-300">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="hover:text-red-300">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-red-300">
                  Products
                </Link>
              </li>
              {/* <li>
                <Link to="/admin" className="hover:text-red-300">Admin</Link>
              </li> */}
              {/* <li>
                <Link to="/cart" className="hover:text-red-300">Cart</Link>
              </li> */}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 mt-8 pt-8 text-center">
          <p>
            © {new Date().getFullYear()} Sisira Auto Parts. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
