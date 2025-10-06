import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Mail, Globe } from "lucide-react";

const Footer = () => {
  const quickLinks = [
    { name: "About Us", href: "#about" },
    { name: "Our Products", href: "#products" },
    { name: "Export Services", href: "#services" },
    { name: "Quality Certificates", href: "#certifications" },
    { name: "Contact", href: "#contact" }
  ];

  const products = [
    { name: "Ceylon Tea Leaves", href: "#tea" },
    { name: "Raw Cinnamon", href: "#cinnamon" },
    { name: "King Coconuts", href: "#coconuts" },
    { name: "Custom Orders", href: "#custom" },
    { name: "Bulk Export", href: "#bulk" }
  ];

  const certifications = [
    "ISO 22000:2018",
    "HACCP Certified",
    "Organic Ceylon",
    "Fair Trade",
    "EU Organic"
  ];

  return (
    <footer className="bg-gradient-to-r from-cinnamon/5 to-golden/5 border-t border-border/50">
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-3 mb-6">
              <img 
                src="/lovable-uploads/152adbbf-1d44-47d8-a035-a28d38bdd57e.png" 
                alt="Cinnara Origins Logo" 
                className="h-12 w-auto"
              />
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Premium Ceylon exports since 1995. We bring you the authentic taste 
              of Sri Lankan tea, cinnamon, and coconuts with guaranteed quality 
              and sustainable practices.
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                <MapPin size={16} className="text-cinnamon" />
                <span>123 Export Avenue, Colombo 03, Sri Lanka</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                <Phone size={16} className="text-golden" />
                <span>+94 11 234 5678</span>
              </div>
              <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                <Mail size={16} className="text-natural" />
                <span>exports@cinnaraorigins.com</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-6">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href}
                    className="text-muted-foreground hover:text-cinnamon transition-colors duration-300"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-6">Our Products</h3>
            <ul className="space-y-3">
              {products.map((product, index) => (
                <li key={index}>
                  <a 
                    href={product.href}
                    className="text-muted-foreground hover:text-cinnamon transition-colors duration-300"
                  >
                    {product.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Certifications */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-6">Certifications</h3>
            <div className="space-y-3 mb-6">
              {certifications.map((cert, index) => (
                <Badge key={index} variant="outline" className="block text-center py-2">
                  {cert}
                </Badge>
              ))}
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Globe size={16} className="text-cinnamon" />
              <span>Exporting to 25+ countries</span>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            © 2024 Cinnara Origins. All rights reserved. | Proudly Sri Lankan Export Company
          </div>
          <div className="flex space-x-6 text-sm text-muted-foreground">
            <a href="#privacy" className="hover:text-cinnamon transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="hover:text-cinnamon transition-colors">
              Terms of Service
            </a>
            <a href="#shipping" className="hover:text-cinnamon transition-colors">
              Shipping Policy
            </a>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            🇱🇰 Authentic Ceylon Products • Fair Trade Certified • Sustainable Farming
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;