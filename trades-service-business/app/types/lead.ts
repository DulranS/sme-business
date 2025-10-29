// src/types/lead.ts
export type Lead = {
  id?: string;
  business_type: string;
  name: string;
  phone: string;
  email: string | null;
  address: string;
  issue: string | null;
  urgency: string | null;
  safety: boolean | null;
  system_type: string | null;
  roof_type: string | null;
  created_at?: string;
};