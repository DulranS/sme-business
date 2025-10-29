// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { BUSINESS_CONFIG } from './config/business-config';
import BusinessHeader from './components/BusinessHeader';
import ContactForm from './components/ContactForm';
import TrustIndicators from './components/TrustIndicators';

const updateDocumentHead = () => {
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', BUSINESS_CONFIG.primaryColor);
  } else {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = BUSINESS_CONFIG.primaryColor;
    document.head.appendChild(meta);
  }
};

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    updateDocumentHead();
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-xl text-gray-600">
          Loading {BUSINESS_CONFIG.name}...
        </div>
      </div>
    );
  }

  const formattedBusinessType = 
    BUSINESS_CONFIG.type.charAt(0).toUpperCase() + 
    BUSINESS_CONFIG.type.slice(1);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <BusinessHeader />

        <div className="text-center mb-12 mt-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Get Your Free {formattedBusinessType} Quote Today!
          </h1>
          <p className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto">
            {BUSINESS_CONFIG.tagline}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Choose Us?</h2>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Licensed & insured professionals</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{BUSINESS_CONFIG.yearsInBusiness}+ years of experience</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">Upfront pricing — no hidden fees</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">On-time guarantee</span>
                </li>
                <li className="flex items-start">
                  <svg className="h-6 w-6 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">100% satisfaction guarantee</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="font-semibold text-lg text-blue-800 mb-2">Service Area</h3>
              <p className="text-blue-700">{BUSINESS_CONFIG.serviceArea}</p>
            </div>

            <TrustIndicators />
          </div>

          <div className="lg:sticky lg:top-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div 
                className="bg-primary px-6 py-5"
                style={{ backgroundColor: BUSINESS_CONFIG.primaryColor }}
              >
                <h2 className="text-2xl font-bold text-white">Request a Free Quote</h2>
                <p className="text-blue-100 mt-1">
                  We'll contact you within 1 hour
                </p>
              </div>
              <div className="p-6">
                <ContactForm />
              </div>
            </div>

            {['plumbing', 'electrical', 'hvac'].includes(BUSINESS_CONFIG.type) && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
                <h3 className="font-bold text-red-800 mb-2">Emergency Service?</h3>
                <p className="text-red-700 mb-3">
                  Call us directly for immediate assistance:
                </p>
                <a 
                  href={`tel:${BUSINESS_CONFIG.phone.replace(/\D/g, '')}`}
                  className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-full transition-colors"
                >
                  {BUSINESS_CONFIG.phone}
                </a>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-600">
          <p className="mb-1">
            © {new Date().getFullYear()} {BUSINESS_CONFIG.name}. All rights reserved.
          </p>
          <p className="text-sm">{BUSINESS_CONFIG.address} • {BUSINESS_CONFIG.serviceArea}</p>
          {BUSINESS_CONFIG.licenses.length > 0 && (
            <p className="text-sm mt-2">
              Licenses: {BUSINESS_CONFIG.licenses.join(', ')}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}