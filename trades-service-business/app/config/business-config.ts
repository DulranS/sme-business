// src/config/business-config.ts
export type BusinessType = 
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'roofing'
  | 'landscaping'
  | 'painting'
  | 'custom';

export interface BusinessConfig {
  name: string;
  type: BusinessType;
  primaryColor: string;
  secondaryColor: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  serviceArea: string;
  tagline: string;
  metaDescription: string;
  socialLinks: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  // Trust indicators
  yearsInBusiness: number;
  licenses: string[];
  insurance: boolean;
  guarantees: string[];
}

// Default configuration - customize per business
const DEFAULT_CONFIG: BusinessConfig = {
  name: "Your Trade Business",
  type: "custom",
  primaryColor: "#3b82f6", // blue-500
  secondaryColor: "#1e40af", // blue-800
  logo: "/logos/default-logo.svg",
  phone: "(555) 123-4567",
  email: "contact@yourbusiness.com",
  address: "123 Main St, Anytown, USA",
  serviceArea: "Serving the Greater Metro Area",
  tagline: "Professional, Reliable, and Affordable Service",
  metaDescription: "Get a free quote for your next project. Licensed and insured professionals with 10+ years of experience.",
  socialLinks: {
    facebook: "https://facebook.com/yourbusiness",
    instagram: "https://instagram.com/yourbusiness"
  },
  yearsInBusiness: 10,
  licenses: ["State License #12345"],
  insurance: true,
  guarantees: ["100% Satisfaction Guarantee", "On-Time Guarantee"]
};

// Override with environment variables if available
export const BUSINESS_CONFIG: BusinessConfig = {
  ...DEFAULT_CONFIG,
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || DEFAULT_CONFIG.name,
  type: (process.env.NEXT_PUBLIC_BUSINESS_TYPE as BusinessType) || DEFAULT_CONFIG.type,
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || DEFAULT_CONFIG.primaryColor,
  secondaryColor: process.env.NEXT_PUBLIC_SECONDARY_COLOR || DEFAULT_CONFIG.secondaryColor,
  logo: process.env.NEXT_PUBLIC_LOGO_PATH || DEFAULT_CONFIG.logo,
  phone: process.env.NEXT_PUBLIC_PHONE || DEFAULT_CONFIG.phone,
  email: process.env.NEXT_PUBLIC_EMAIL || DEFAULT_CONFIG.email,
  address: process.env.NEXT_PUBLIC_ADDRESS || DEFAULT_CONFIG.address,
  serviceArea: process.env.NEXT_PUBLIC_SERVICE_AREA || DEFAULT_CONFIG.serviceArea,
  tagline: process.env.NEXT_PUBLIC_TAGLINE || DEFAULT_CONFIG.tagline,
  metaDescription: process.env.NEXT_PUBLIC_META_DESCRIPTION || DEFAULT_CONFIG.metaDescription,
};