import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Facebook as FacebookIcon, Instagram as InstagramIcon } from "lucide-react";

export function HeroSection() {
  // Add function to handle smooth scrolling to the contact section
  const scrollToContact = (e) => {
    e.preventDefault();
    const contactElement = document.getElementById("contact");
    if (contactElement) {
      contactElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="/brz.jpeg"
          alt="Mechanic working on a car engine in an auto repair shop"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-transparent"></div>
      </div>

      {/* Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-24 lg:py-32">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Text Content */}
          <div className="text-white space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Quality Auto Parts for Every Japanese Vehicle
            </h1>
            <div aria-label="Company description">
              <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl">
                Sisira Auto Parts provides genuine and high-quality automotive
                parts for all major Japanese brands at competitive prices in Nugegoda, Sri
                Lanka.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-4 sm:pt-6">
              <Link to="/products" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 text-white px-4 sm:px-6 md:px-8 py-3 md:py-4 text-base md:text-lg rounded-lg shadow-lg flex items-center justify-center gap-2 md:gap-3 transition duration-300 transform hover:scale-105">
                  Browse Parts
                  <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
                </Button>
              </Link>
              <Button 
                onClick={scrollToContact}
                className="w-full sm:w-auto bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white px-4 sm:px-6 md:px-8 py-3 md:py-4 text-base md:text-lg rounded-lg shadow-lg flex items-center justify-center gap-2 md:gap-3 transition duration-300 transform hover:scale-105"
              >
                Contact Us
                <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </div>

            {/* Find Us On Section */}
            <div className="pt-6 sm:pt-8">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">Find Us On</h2>
              <div className="flex flex-col sm:flex-row gap-4 sm:space-x-6">
                <a
                  href="https://www.facebook.com/profile.php?id=61574994975673"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-300 hover:text-blue-400 transition duration-300"
                  aria-label="Visit our Facebook page"
                >
                  <FacebookIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="font-medium text-sm sm:text-base">Sisira Parts</span>
                </a>
                <a
                  href="https://www.instagram.com/sisiraautoparts/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-300 hover:text-pink-400 transition duration-300"
                  aria-label="Visit our Instagram page"
                >
                  <InstagramIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="font-medium text-sm sm:text-base">@sisiraautoparts</span>
                </a>
                <a
                  href="https://www.tiktok.com/@sisiraautoparts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-gray-300 hover:text-pink-400 transition duration-300"
                  aria-label="Visit our TikTok page"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 sm:h-6 sm:w-6"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.93 9.36c-.56-.1-1.08-.3-1.54-.56-.46-.26-.87-.6-1.22-1.02v5.1c0 1.12-.4 2.08-1.2 2.88-.8.8-1.76 1.2-2.88 1.2-1.12 0-2.08-.4-2.88-1.2-.8-.8-1.2-1.76-1.2-2.88s.4-2.08 1.2-2.88c.8-.8 1.76-1.2 2.88-1.2.28 0 .56.03.84.08v2.08c-.28-.08-.56-.12-.84-.12-.64 0-1.2.24-1.68.72-.48.48-.72 1.04-.72 1.68s.24 1.2.72 1.68c.48.48 1.04.72 1.68.72.64 0 1.2-.24 1.68-.72.48-.48.72-1.04.72-1.68V7.5h2.04c.2.8.6 1.48 1.2 2.04.6.56 1.28.92 2.04 1.08v2.04z" />
                  </svg>
                  <span className="font-medium text-sm sm:text-base">@sisiraautoparts</span>
                </a>
              </div>
            </div>
          </div>

          {/* Features Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-gray-100/20 shadow-2xl hover:shadow-3xl transition duration-300 transform hover:scale-105 mt-4 md:mt-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6 sm:mb-8">
              Why Choose Us?
            </h2>

            <ul className="space-y-4 sm:space-y-6">
              {[
                "Genuine and certified auto parts",
                "Wide range of products for all vehicle types",
                "Expert advice on part selection",
                "Competitive pricing with warranty",
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-3 sm:gap-4">
                  <div
                    className={`rounded-full p-2 sm:p-3 ${
                      index % 2 === 0 ? "bg-red-600" : "bg-green-600"
                    } shadow-lg`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 sm:h-6 sm:w-6 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <span className="text-gray-100 text-base sm:text-lg">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}