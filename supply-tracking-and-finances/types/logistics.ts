// ==============================
// LOGISTICS & FULFILLMENT TYPES
// ==============================

export interface Shipment {
  id: string;
  orderId: number;
  itemId?: string;
  status: 'pending' | 'scheduled' | 'in-transit' | 'delivered' | 'delayed' | 'cancelled';
  shipmentType: 'towing' | 'shipping' | 'delivery' | 'pickup';
  origin: Location;
  destination: Location;
  carrier?: string;
  trackingNumber?: string;
  estimatedPickup?: string;
  estimatedDelivery?: string;
  actualPickup?: string;
  actualDelivery?: string;
  cost: number;
  specialRequirements?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  contactName?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
}

export interface Carrier {
  id: string;
  name: string;
  type: 'towing' | 'shipping' | 'delivery' | 'logistics';
  contactEmail: string;
  contactPhone: string;
  rating: number;
  totalShipments: number;
  onTimeRate: number;
  averageCost: number;
  serviceAreas: string[];
  isActive: boolean;
}

export interface Warehouse {
  id: string;
  name: string;
  location: Location;
  capacity: number;
  currentOccupancy: number;
  type: 'storage' | 'fulfillment' | 'reconditioning';
  amenities: string[];
  hourlyRate?: number;
  monthlyRate?: number;
  isActive: boolean;
}

export interface FulfillmentWorkflow {
  id: string;
  orderId: number;
  steps: FulfillmentStep[];
  currentStep: number;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  assignedTo?: string;
  estimatedCompletion?: string;
  actualCompletion?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentStep {
  id: string;
  name: string;
  description: string;
  type: 'verification' | 'payment' | 'scheduling' | 'pickup' | 'transit' | 'delivery' | 'documentation';
  status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'failed';
  assignedTo?: string;
  estimatedCompletion?: string;
  actualCompletion?: string;
  dependencies?: string[];
  notes?: string;
}
