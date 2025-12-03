'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';

// Types
interface FormData {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
}

interface BusinessConfig {
  name: string;
  type: string;
  tagline: string;
  primaryColor: string;
  phone: string;
  email: string;
  address: string;
  serviceArea: string;
  yearsInBusiness: number;
  licenses: string[];
}

// Configuration
const BUSINESS_CONFIG: BusinessConfig = {
  name: "Premium Home Services",
  type: "plumbing",
  tagline: "Professional service you can trust, delivered with care and expertise",
  primaryColor: "#2563eb",
  phone: "(555) 123-4567",
  email: "contact@premiumhome.com",
  address: "123 Main Street, Your City",
  serviceArea: "Greater Metropolitan Area & Surrounding Counties",
  yearsInBusiness: 15,
  licenses: ["License #12345", "Certified Professional"]
};

const BusinessHeader = () => (
  <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-gray-200/50 shadow-sm">
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div 
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: BUSINESS_CONFIG.primaryColor }}
          >
            {BUSINESS_CONFIG.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-900 leading-tight">
              {BUSINESS_CONFIG.name}
            </h1>
            <p className="text-xs text-gray-600 hidden sm:block">
              {BUSINESS_CONFIG.yearsInBusiness}+ Years Excellence
            </p>
          </div>
        </div>
        <a 
          href={`tel:${BUSINESS_CONFIG.phone.replace(/\D/g, '')}`}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 md:px-6 py-2 md:py-3 rounded-full font-semibold transition-all shadow-md hover:shadow-lg text-xs md:text-base whitespace-nowrap"
        >
          <span className="hidden sm:inline">📞 </span>
          {BUSINESS_CONFIG.phone}
        </a>
      </div>
    </div>
  </header>
);

const TrustIndicators = () => (
  <div className="grid grid-cols-3 gap-3 md:gap-4">
    {[
      { icon: "⭐", value: "4.9", label: "Rating", color: "blue" },
      { icon: "✓", value: "500+", label: "Projects", color: "green" },
      { icon: "🏆", value: "100%", label: "Satisfied", color: "purple" }
    ].map((item, idx) => (
      <div 
        key={idx}
        className={`bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 rounded-xl md:rounded-2xl p-3 md:p-4 text-center border border-${item.color}-200 hover:shadow-lg transition-all hover:-translate-y-1 cursor-default`}
      >
        <div className="text-2xl md:text-3xl mb-1 md:mb-2">{item.icon}</div>
        <div className="text-xl md:text-2xl font-bold text-gray-900">{item.value}</div>
        <div className="text-xs md:text-sm text-gray-700 font-medium">{item.label}</div>
      </div>
    ))}
  </div>
);

const ContactForm = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    service: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (submitted) {
    return (
      <div className="text-center py-8 md:py-12">
        <div className="text-5xl md:text-6xl mb-4 animate-bounce">✅</div>
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
        <p className="text-gray-600">We'll contact you within 1 hour.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
        <input
          type="text"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
          placeholder="John Doe"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            placeholder="john@example.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Phone *</label>
          <input
            type="tel"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Service Needed *</label>
        <select
          name="service"
          required
          value={formData.service}
          onChange={handleChange}
          className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none bg-white"
        >
          <option value="">Select a service...</option>
          <option value="repair">Repair</option>
          <option value="installation">Installation</option>
          <option value="maintenance">Maintenance</option>
          <option value="emergency">Emergency Service</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Project Details</label>
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={4}
          className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none outline-none"
          placeholder="Tell us about your project..."
        />
      </div>

      <button
        onClick={handleSubmit}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 md:py-4 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
      >
        Get My Free Quote →
      </button>
      
      <p className="text-xs text-gray-500 text-center leading-relaxed">
        By submitting, you agree to receive communication from us. We respect your privacy.
      </p>
    </div>
  );
};

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl md:text-5xl mb-4">⚡</div>
          <div className="text-lg md:text-xl text-gray-600 font-medium px-4">
            Loading {BUSINESS_CONFIG.name}...
          </div>
        </div>
      </div>
    );
  }

  const formattedBusinessType = 
    BUSINESS_CONFIG.type.charAt(0).toUpperCase() + 
    BUSINESS_CONFIG.type.slice(1);

  return (
    <div className="min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Background Image with Heavy Overlay for Professional Look */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="relative w-full h-full">
          <Image 
            src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1920&q=80"
            alt="Background"
            fill
            priority
            quality={85}
            sizes="100vw"
            style={{ objectFit: 'cover' }}
          />
        </div>
        {/* Multi-layer overlay for optimal transparency and professionalism */}
        <div className="absolute inset-0 bg-white/75" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-blue-50/85 to-purple-50/90" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
      </div>
      
      {/* Subtle Pattern Overlay - Barely Visible */}
      <div 
        className="fixed inset-0 z-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10">
        <BusinessHeader />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 lg:py-12 max-w-7xl">
          {/* Hero Section */}
          <div className="text-center mb-8 md:mb-12 lg:mb-16">
            <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-xs md:text-sm font-semibold mb-4 animate-pulse shadow-sm">
              🎉 Limited Time: Free Consultation Worth $150
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-3 md:mb-6 leading-tight px-4">
              Get Your Free{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {formattedBusinessType}
              </span>{' '}
              Quote Today!
            </h2>
            <p className="text-base md:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed px-4">
              {BUSINESS_CONFIG.tagline}
            </p>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 lg:gap-10">
            {/* Left Column - Info */}
            <div className="lg:col-span-3 space-y-6">
              {/* Why Choose Us */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl shadow-xl border border-gray-100/50 p-5 md:p-8 hover:shadow-2xl transition-all">
                <div className="flex items-center mb-5 md:mb-6">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center mr-3 md:mr-4 shadow-md flex-shrink-0">
                    <span className="text-xl md:text-2xl">⭐</span>
                  </div>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Why Choose Us?</h3>
                </div>
              
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {[
                    { icon: "🛡️", text: "Licensed & insured professionals" },
                    { icon: "📅", text: `${BUSINESS_CONFIG.yearsInBusiness}+ years of experience` },
                    { icon: "💰", text: "Upfront pricing — no hidden fees" },
                    { icon: "⏰", text: "On-time guarantee" },
                    { icon: "✨", text: "100% satisfaction guarantee" },
                    { icon: "🎯", text: "Same-day service available" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start bg-gradient-to-br from-gray-50 to-blue-50 p-3 md:p-4 rounded-xl hover:shadow-md transition-all">
                      <span className="text-xl md:text-2xl mr-2 md:mr-3 flex-shrink-0">{item.icon}</span>
                      <span className="text-sm md:text-base text-gray-800 font-medium leading-tight">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Area */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl md:rounded-3xl p-5 md:p-8 text-white shadow-xl hover:shadow-2xl transition-all">
                <div className="flex items-start">
                  <div className="bg-white/20 backdrop-blur-sm p-2.5 md:p-3 rounded-xl md:rounded-2xl mr-3 md:mr-4 flex-shrink-0">
                    <span className="text-2xl md:text-3xl">📍</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg md:text-xl lg:text-2xl mb-2">Service Area</h3>
                    <p className="text-blue-100 text-sm md:text-base lg:text-lg leading-relaxed">
                      {BUSINESS_CONFIG.serviceArea}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust Indicators */}
              <TrustIndicators />

              {/* Testimonial */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl p-5 md:p-8 border border-purple-100/50 shadow-lg hover:shadow-xl transition-all">
                <div className="flex items-center mb-4">
                  <div className="flex -space-x-2 mr-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white shadow-sm"></div>
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-white shadow-sm"></div>
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-white shadow-sm"></div>
                  </div>
                  <div className="text-yellow-500 text-lg md:text-xl">⭐⭐⭐⭐⭐</div>
                </div>
                <p className="text-sm md:text-base text-gray-700 italic mb-2 leading-relaxed">
                  "Exceptional service! Professional, punctual, and the quality of work exceeded our expectations."
                </p>
                <p className="text-xs md:text-sm text-gray-600 font-semibold">— Sarah M., Verified Customer</p>
              </div>
            </div>

            {/* Right Column - Form (Sticky on Desktop) */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Contact Form */}
                <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden transform hover:scale-[1.01] transition-transform">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 md:px-8 py-5 md:py-8">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2">
                      Request a Free Quote
                    </h3>
                    <div className="flex items-center text-blue-100 text-sm md:text-base">
                      <span className="text-lg md:text-xl mr-2">⚡</span>
                      <span className="font-medium">We'll contact you within 1 hour</span>
                    </div>
                  </div>
                  <div className="p-5 md:p-8">
                    <ContactForm />
                  </div>
                </div>

                {/* Emergency Service */}
                {['plumbing', 'electrical', 'hvac'].includes(BUSINESS_CONFIG.type) && (
                  <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl md:rounded-3xl p-5 md:p-8 text-white shadow-2xl text-center transform hover:scale-[1.01] transition-transform">
                    <div className="text-4xl md:text-5xl mb-3">🚨</div>
                    <h3 className="font-bold text-xl md:text-2xl mb-2">Emergency Service?</h3>
                    <p className="text-red-100 mb-4 text-sm md:text-base lg:text-lg">
                      24/7 immediate assistance available
                    </p>
                    <a 
                      href={`tel:${BUSINESS_CONFIG.phone.replace(/\D/g, '')}`}
                      className="inline-block bg-white text-red-600 hover:bg-red-50 font-bold py-3 md:py-4 px-6 md:px-8 rounded-xl md:rounded-2xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:translate-y-0 text-sm md:text-base lg:text-lg"
                    >
                      📞 {BUSINESS_CONFIG.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 md:mt-16 lg:mt-20 pt-8 border-t border-gray-200/50">
            <div className="text-center text-gray-600 space-y-2 px-4">
              <p className="text-base md:text-lg font-semibold text-gray-800">
                © {new Date().getFullYear()} {BUSINESS_CONFIG.name}. All rights reserved.
              </p>
              <p className="text-xs md:text-sm">
                {BUSINESS_CONFIG.address} • {BUSINESS_CONFIG.serviceArea}
              </p>
              {BUSINESS_CONFIG.licenses.length > 0 && (
                <p className="text-xs md:text-sm text-gray-500">
                  Licenses: {BUSINESS_CONFIG.licenses.join(', ')}
                </p>
              )}
              <div className="pt-4 flex flex-wrap justify-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500">
                <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
                <span className="hidden sm:inline">•</span>
                <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}