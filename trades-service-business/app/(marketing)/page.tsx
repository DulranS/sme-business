// src/app/(marketing)/page.tsx
import { BUSINESS_CONFIG } from '../config/business-config';
import BusinessHeader from '../components/BusinessHeader';
import ContactForm from '../components/ContactForm';
import TrustIndicators from '../components/TrustIndicators';

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <BusinessHeader />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-12">
        <div>
          <h1 className="text-4xl font-bold mb-6">
            Get Your Free {BUSINESS_CONFIG.type.charAt(0).toUpperCase() + BUSINESS_CONFIG.type.slice(1)} Quote Today!
          </h1>
          <p className="text-lg text-gray-700 mb-6">
            {BUSINESS_CONFIG.tagline}
          </p>
          
          <div className="bg-blue-50 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-3">Why Choose Us?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Licensed and insured professionals</li>
              <li>{BUSINESS_CONFIG.yearsInBusiness}+ years of experience</li>
              <li>Upfront pricing - no hidden fees</li>
              <li>On-time guarantee</li>
              <li>100% satisfaction guarantee</li>
            </ul>
          </div>
          
          <TrustIndicators />
        </div>
        
        <div>
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
            <h2 className="text-2xl font-bold mb-4">Request a Free Quote</h2>
            <p className="text-gray-600 mb-6">
              Fill out the form below and we'll contact you within 1 hour to schedule your service.
            </p>
            <ContactForm />
          </div>
        </div>
      </div>
      
      <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-600">
        <p>© {new Date().getFullYear()} {BUSINESS_CONFIG.name}. All rights reserved.</p>
        <p className="mt-2">{BUSINESS_CONFIG.serviceArea}</p>
      </footer>
    </div>
  );
}