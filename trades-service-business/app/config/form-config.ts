// src/config/form-config.ts
import { BUSINESS_CONFIG } from "./business-config";

export type FormFieldType = 
  | 'text'
  | 'email'
  | 'phone'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'date';

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    message?: string;
  };
}

// Base fields for all businesses
const BASE_FIELDS: FormField[] = [
  {
    id: 'name',
    name: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    placeholder: 'John Smith'
  },
  {
    id: 'phone',
    name: 'phone',
    label: 'Phone Number',
    type: 'phone',
    required: true,
    placeholder: '(555) 123-4567'
  },
  {
    id: 'email',
    name: 'email',
    label: 'Email Address',
    type: 'email',
    required: false,
    placeholder: 'john@example.com'
  },
  {
    id: 'address',
    name: 'address',
    label: 'Service Address',
    type: 'text',
    required: true,
    placeholder: '123 Main St, Anytown'
  }
];

// Service-specific fields
const SERVICE_FIELDS: Record<string, FormField[]> = {
  plumbing: [
    {
      id: 'issue',
      name: 'issue',
      label: 'What plumbing issue are you experiencing?',
      type: 'select',
      required: true,
      options: [
        { value: 'leak', label: 'Leaky faucet or pipe' },
        { value: 'clog', label: 'Clogged drain or toilet' },
        { value: 'install', label: 'New fixture installation' },
        { value: 'water-heater', label: 'Water heater issue' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'urgency',
      name: 'urgency',
      label: 'How urgent is this issue?',
      type: 'radio',
      required: true,
      options: [
        { value: 'emergency', label: 'Emergency - Need help today!' },
        { value: 'soon', label: 'Within the next few days' },
        { value: 'flexible', label: 'Flexible timing' }
      ]
    }
  ],
  electrical: [
    {
      id: 'issue',
      name: 'issue',
      label: 'What electrical issue are you experiencing?',
      type: 'select',
      required: true,
      options: [
        { value: 'outlet', label: 'Non-working outlet or switch' },
        { value: 'panel', label: 'Electrical panel issue' },
        { value: 'lighting', label: 'Lighting installation/repair' },
        { value: 'wiring', label: 'Wiring problem' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'safety',
      name: 'safety',
      label: 'Is this a safety concern?',
      type: 'checkbox',
      required: false
    }
  ],
  hvac: [
    {
      id: 'system-type',
      name: 'system-type',
      label: 'What type of HVAC system do you have?',
      type: 'select',
      required: true,
      options: [
        { value: 'central-ac', label: 'Central Air Conditioning' },
        { value: 'furnace', label: 'Furnace' },
        { value: 'heat-pump', label: 'Heat Pump' },
        { value: 'mini-split', label: 'Ductless Mini-Split' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'issue',
      name: 'issue',
      label: 'What issue are you experiencing?',
      type: 'select',
      required: true,
      options: [
        { value: 'not-cooling', label: 'Not cooling properly' },
        { value: 'not-heating', label: 'Not heating properly' },
        { value: 'strange-noise', label: 'Strange noises' },
        { value: 'high-bills', label: 'Unusually high energy bills' },
        { value: 'maintenance', label: 'Routine maintenance' },
        { value: 'other', label: 'Other' }
      ]
    }
  ],
  roofing: [
    {
      id: 'roof-type',
      name: 'roof-type',
      label: 'What type of roof do you have?',
      type: 'select',
      required: true,
      options: [
        { value: 'asphalt', label: 'Asphalt Shingles' },
        { value: 'metal', label: 'Metal Roof' },
        { value: 'tile', label: 'Tile Roof' },
        { value: 'flat', label: 'Flat Roof' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      id: 'issue',
      name: 'issue',
      label: 'What roofing issue are you experiencing?',
      type: 'select',
      required: true,
      options: [
        { value: 'leak', label: 'Roof leak' },
        { value: 'damage', label: 'Storm damage' },
        { value: 'age', label: 'Old roof needs replacement' },
        { value: 'inspection', label: 'Need inspection' },
        { value: 'other', label: 'Other' }
      ]
    }
  ]
};

// Combine base fields with service-specific fields
export const getFormFields = (): FormField[] => {
  const serviceFields = SERVICE_FIELDS[BUSINESS_CONFIG.type] || [];
  return [...BASE_FIELDS, ...serviceFields];
};