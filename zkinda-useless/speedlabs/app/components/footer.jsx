import React from "react";
import Link from "next/link";
import { Facebook, Instagram, Linkedin, MessageCircle } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-red-600 to-red-800 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center sm:text-left">
          {/* About Us */}
          <div className="backdrop-blur-sm bg-white/10 rounded-lg p-6 transform hover:scale-105 transition-all duration-300">
            <h3 className="text-xl font-bold mb-4 text-white">
              About Speed Labs
            </h3>
            <p className="text-white/90 leading-relaxed">
              Speed Labs specializes in making car sales seamless, with
              high-quality videography, photography, and strategic marketing
              tailored to your needs.
            </p>
          </div>

          {/* Quick Links */}
          <div className="backdrop-blur-sm bg-white/10 rounded-lg p-6 transform hover:scale-105 transition-all duration-300">
            <h3 className="text-xl font-bold mb-4 text-white">Quick Links</h3>
            <ul className="space-y-3">
              {["Services", "Gallery", "Contact Us", "FAQ"].map((item) => (
                <li key={item}>
                  <Link
                    href={`#${item.toLowerCase().replace(" ", "-")}`}
                    className="text-white/90 hover:text-white hover:translate-x-2 transition-all duration-300 flex items-center group"
                  >
                    <span className="transform group-hover:translate-x-2 transition-transform">
                      → {item}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Us */}
          <div
            className="backdrop-blur-sm bg-white/10 rounded-lg p-6 transform hover:scale-105 transition-all duration-300"
            id="footer"
          >
            <h3 className="text-xl font-bold mb-4 text-white">Contact Us</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="mailto:speedlabs.lk@gmail.com"
                  className="text-white/90 hover:text-white transition-colors flex items-center gap-2"
                >
                  ✉️ speedlabs.lk@gmail.com
                </Link>
              </li>
              <li className="flex items-center gap-2 text-white/90">
                📞 +076 753 1604
              </li>
              <li className="flex items-center gap-2 text-white/90">
                📱 +94777374686
              </li>
              <li className="flex items-center gap-2 text-white/90">
                📍 140, Caldera Gardens, Kohuwala
              </li>
            </ul>
          </div>

          {/* Follow Us */}
          <div className="backdrop-blur-sm bg-white/10 rounded-lg p-6 transform hover:scale-105 transition-all duration-300">
            <h3 className="text-xl font-bold mb-4 text-white">Follow Us</h3>
            <div className="flex justify-center sm:justify-start space-x-6">
              {[
                {
                  name: "Facebook",
                  url: "https://www.facebook.com/share/15eiqBLcmT/?mibextid=LQQJ4d",
                  icon: <Facebook className="w-6 h-6" />,
                },
                {
                  name: "Instagram",
                  url: "https://www.instagram.com/speedlabs.lk/",
                  icon: <Instagram className="w-6 h-6" />,
                },
                {
                  name: "TikTok",
                  url: "https://www.tiktok.com/@speedlabs.lk?is_from_webapp=1&sender_device=pc",
                  icon: (
                    <svg
                      className="w-6 h-6"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <Link
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="bg-white/20 p-3 rounded-full hover:bg-white/30 transform hover:scale-110 transition-all duration-300"
                >
                  {social.icon}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/20 my-8"></div>

        {/* Footer Bottom */}
        <div className="text-sm text-white/80 text-center">
          &copy; {new Date().getFullYear()} Speed Labs. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
