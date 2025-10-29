// src/components/TrustIndicators.tsx
import { BUSINESS_CONFIG } from "../config/business-config";
export default function TrustIndicators() {
  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Why Customers Trust Us</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-white rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-primary">{BUSINESS_CONFIG.yearsInBusiness}+</div>
          <div className="text-sm text-gray-600">Years Experience</div>
        </div>
        <div className="text-center p-4 bg-white rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-primary">100%</div>
          <div className="text-sm text-gray-600">Satisfaction Guarantee</div>
        </div>
        <div className="text-center p-4 bg-white rounded-lg shadow-sm">
          <div className="text-2xl font-bold text-primary">Licensed</div>
          <div className="text-sm text-gray-600">Professionals</div>
        </div>
        {BUSINESS_CONFIG.insurance && (
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-primary">Insured</div>
            <div className="text-sm text-gray-600">For Your Protection</div>
          </div>
        )}
      </div>
    </div>
  );
}