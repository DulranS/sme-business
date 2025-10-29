// src/components/BusinessHeader.tsx
import { BUSINESS_CONFIG } from '../config/business-config';
import Image from 'next/image';

export default function BusinessHeader() {
  return (
    <header className="flex flex-col items-center text-center mb-8">
      <div className="mb-4">
        <Image 
          src={BUSINESS_CONFIG.logo} 
          alt={BUSINESS_CONFIG.name} 
          width={200} 
          height={60}
          className="object-contain"
        />
      </div>
      
      <div className="flex flex-wrap justify-center gap-6 mb-4">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <span>{BUSINESS_CONFIG.address}</span>
        </div>
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
          </svg>
          <a href={`tel:${BUSINESS_CONFIG.phone}`} className="font-medium hover:text-blue-600 transition-colors">
            {BUSINESS_CONFIG.phone}
          </a>
        </div>
      </div>
      
      <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full inline-block">
        {BUSINESS_CONFIG.serviceArea}
      </div>
    </header>
  );
}