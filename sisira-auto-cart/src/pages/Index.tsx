import { MainLayout } from "@/components/layout/main-layout";
import { HeroSection } from "@/components/home/hero-section";
import { FeaturedProducts } from "@/components/home/featured-products";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Award,
  Truck,
  Shield,
  ThumbsUp,
  Check,
  MapPin,
  Phone,
  Clock,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function Index() {
  // State for store open status
  const [isOpen, setIsOpen] = useState(false);
  const [nextOpenTime, setNextOpenTime] = useState("");

  // WhatsApp click handler
  const handleWhatsAppCall = () => {
    window.open("https://wa.me/94772091359", "_blank");
  };

  // Check if store is currently open
  useEffect(() => {
    const checkStoreOpen = () => {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday, 1 is Monday, etc.
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours + minutes / 60; // Convert to decimal time (e.g., 8:30 = 8.5)

      // Define business hours
      const businessHours = {
        0: { open: null, close: null }, // Sunday - Closed
        1: { open: 8.5, close: 18 },   // Monday 8:30 AM - 6:00 PM
        2: { open: 8.5, close: 18 },   // Tuesday
        3: { open: 8.5, close: 18 },   // Wednesday
        4: { open: 8.5, close: 18 },   // Thursday
        5: { open: 8.5, close: 18 },   // Friday
        6: { open: 9, close: 17 }      // Saturday 9:00 AM - 5:00 PM
      };

      // Check if currently open
      const todayHours = businessHours[day];
      const storeOpen = todayHours.open !== null && 
                        currentTime >= todayHours.open && 
                        currentTime < todayHours.close;
      
      setIsOpen(storeOpen);

      // Calculate next open time if closed
      if (!storeOpen) {
        let nextOpenDay = day;
        let foundNextDay = false;
        let daysChecked = 0;
        
        // Find the next open day (checking up to 7 days)
        while (!foundNextDay && daysChecked < 7) {
          nextOpenDay = (nextOpenDay + 1) % 7;
          if (businessHours[nextOpenDay].open !== null) {
            foundNextDay = true;
          }
          daysChecked++;
        }

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        // Same day but later
        if (day !== 0 && nextOpenDay === day && currentTime < todayHours.open) {
          setNextOpenTime(`Opens today at ${formatTime(todayHours.open)}`);
        } 
        // Tomorrow
        else if ((day + 1) % 7 === nextOpenDay) {
          setNextOpenTime(`Opens tomorrow at ${formatTime(businessHours[nextOpenDay].open)}`);
        } 
        // Some other day
        else {
          setNextOpenTime(`Opens ${dayNames[nextOpenDay]} at ${formatTime(businessHours[nextOpenDay].open)}`);
        }
      } else {
        setNextOpenTime(`Closes today at ${formatTime(todayHours.close)}`);
      }
    };

    // Format time from decimal to AM/PM
    const formatTime = (decimalTime) => {
      const hours = Math.floor(decimalTime);
      const minutes = Math.round((decimalTime - hours) * 60);
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
    };

    // Initial check
    checkStoreOpen();

    // Set up interval to check every minute
    const interval = setInterval(checkStoreOpen, 60000);

    // Clean up interval
    return () => clearInterval(interval);
  }, []);

  return (
    <MainLayout>
      {/* Hero Section */}
      <HeroSection />

      {/* Trust indicators */}
      <section className="py-8 bg-background border-b">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: <Truck className="h-5 w-5" />,
                text: "Island-wide Delivery",
              },
              { icon: <Check className="h-5 w-5" />, text: "Genuine Parts" },
              {
                icon: <Shield className="h-5 w-5" />,
                text: "Warranty Included",
              },
              {
                icon: <ThumbsUp className="h-5 w-5" />,
                text: "Expert Support",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 justify-center sm:justify-start"
              >
                <div className="flex-shrink-0 bg-primary/10 p-2 rounded-full text-primary">
                  {item.icon}
                </div>
                <p className="font-medium text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10">
            <div>
              <Badge variant="outline" className="mb-2">
                Browse Our Collection
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">
                Shop By Category
              </h2>
            </div>
          </div>
          <CategoryShowcase />
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="py-8 bg-muted/20">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10">
            <div>
              <Badge variant="outline" className="mb-2">
                Top Choices
              </Badge>
              <h2 className="text-3xl font-bold text-foreground">
                Featured Products
              </h2>
            </div>
          </div>
          <FeaturedProducts />
        </div>
      </section>

      {/* About Section with Stats */}
      <section className="">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="mb-2">
                Our Story
              </Badge>
              <h2 className="text-4xl font-bold mb-6 text-foreground">
                About Sisira Auto Parts
              </h2>
              <p className="text-lg text-muted-foreground mb-4">
                Established in 2005, Sisira Auto Parts has become a trusted name
                in providing high-quality automotive parts throughout Sri Lanka.
              </p>
              <p className="text-muted-foreground mb-6">
                We pride ourselves on offering genuine parts for a wide range of
                vehicle makes and models, ensuring that your vehicle performs at
                its best with reliable components.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span>Genuine Parts</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span>Expert Advice</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span>Warranty Support</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-primary" />
                  <span>Competitive Pricing</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
                <div className="inline-flex justify-center items-center mb-4 bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                  <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                  15+
                </div>
                <p className="text-sm text-muted-foreground">
                  Years of Experience
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
                <div className="inline-flex justify-center items-center mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                  <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-4xl font-bold text-red-600 dark:text-red-400 mb-2">
                  1000+
                </div>
                <p className="text-sm text-muted-foreground">
                  Products Available
                </p>
              </Card>

              <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
                <div className="inline-flex justify-center items-center mb-4 bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                  <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                  50+
                </div>
                <p className="text-sm text-muted-foreground">Vehicle Brands</p>
              </Card>

              <Card className="p-6 text-center hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background">
                <div className="inline-flex justify-center items-center mb-4 bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                  <ThumbsUp className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="text-4xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                  5000+
                </div>
                <p className="text-sm text-muted-foreground">Happy Customers</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-16 bg-muted/30" >
        <div className="container" id="contact">
          <div className="mb-10 text-center">
            <Badge variant="outline" className="mb-2" >
              Get In Touch
            </Badge>
            <h2 className="text-3xl font-bold text-foreground" >
              Visit Our Store
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 hover:shadow-lg transition-shadow flex flex-col items-center text-center h-full">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-2">Our Location</h3>
              <p className="text-muted-foreground">
                No 568A Highlevel Road Gangodawila, Nugegoda
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => window.open("https://maps.google.com/?q=No+568A+Highlevel+Road+Gangodawila+Nugegoda", "_blank")}
              >
                <MapPin className="h-4 w-4 mr-2" />
                View On Google Maps
              </Button>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow flex flex-col items-center text-center h-full">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-2">Contact Us</h3>
              <p className="text-muted-foreground">0772091359</p>
              <p className="text-muted-foreground">
                sisiraautopartsofficial@gmail.com
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full justify-center">
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                  onClick={handleWhatsAppCall}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Chat
                </Button>
                <Button 
                  variant="outline" 
                  className="flex items-center justify-center gap-2"
                  onClick={() => window.open("tel:+94772091359")}
                >
                  <Phone className="h-4 w-4" />
                  Call Direct
                </Button>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow flex flex-col items-center text-center h-full">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium text-lg mb-2">Business Hours</h3>
              <div className="flex flex-col space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="font-medium text-left">Monday - Friday:</p>
                  <p className="text-muted-foreground text-right">8:30 AM - 6:00 PM</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="font-medium text-left">Saturday:</p>
                  <p className="text-muted-foreground text-right">9:00 AM - 5:00 PM</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="font-medium text-left">Sunday:</p>
                  <p className="text-muted-foreground text-right">Closed</p>
                </div>
              </div>
              {/* Dynamic Open/Closed Status */}
              <div className={`mt-6 p-3 rounded-lg w-full ${isOpen ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <p className={`text-sm font-medium ${isOpen ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {isOpen ? 'Open Now' : 'Closed Now'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {nextOpenTime}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-primary/5">
        <div className="container text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Need Help Finding the Right Auto Parts?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Our team of experts is ready to assist you. Reach out to us with your vehicle details, and we'll help you find the perfect parts.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button className="bg-green-600 hover:bg-green-700 text-white" size="lg" onClick={handleWhatsAppCall}>
              <MessageCircle className="mr-2 h-5 w-5" />
              Contact Us on WhatsApp
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' })}
              className="flex items-center"
            >
              <Clock className="mr-2 h-5 w-5" />
              {isOpen ? 'Visit Us Today' : 'Check Our Hours'}
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}