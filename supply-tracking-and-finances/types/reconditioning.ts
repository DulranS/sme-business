// ==============================
// RECONDITIONING & WARRANTY TYPES
// ==============================

export interface ReconditioningProject {
  id: string;
  orderId: number;
  itemId?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'mechanical' | 'cosmetic' | 'electrical' | 'structural' | 'comprehensive';
  estimatedCost: number;
  actualCost?: number;
  estimatedHours: number;
  actualHours?: number;
  assignedTo?: string;
  startDate?: string;
  targetDate?: string;
  completionDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReconditioningTask {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: string;
  estimatedCost: number;
  actualCost?: number;
  estimatedHours: number;
  actualHours?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  assignedTo?: string;
  parts?: ReconditioningPart[];
  labor?: ReconditioningLabor[];
  startDate?: string;
  completionDate?: string;
  notes?: string;
}

export interface ReconditioningPart {
  id: string;
  name: string;
  partNumber?: string;
  supplier?: string;
  cost: number;
  quantity: number;
  source: 'inventory' | 'ordered' | 'salvage';
}

export interface ReconditioningLabor {
  id: string;
  technician: string;
  hours: number;
  rate: number;
  total: number;
  description: string;
}

export interface WarrantyClaim {
  id: string;
  orderId: number;
  itemId?: string;
  claimType: 'defect' | 'failure' | 'damage' | 'performance';
  description: string;
  status: 'submitted' | 'investigating' | 'approved' | 'denied' | 'in-progress' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  reportedDate: string;
  resolvedDate?: string;
  resolution?: string;
  cost?: number;
  assignedTo?: string;
  notes?: string;
  evidence?: string[];
}

export interface WarrantyPolicy {
  id: string;
  name: string;
  type: 'manufacturer' | 'dealer' | 'extended' | 'aftermarket';
  coverage: string[];
  duration: number;
  durationUnit: 'days' | 'months' | 'years' | 'miles';
  deductible: number;
  terms: string;
  exclusions: string[];
  isActive: boolean;
}

export interface ReturnRequest {
  id: string;
  orderId: number;
  itemId?: string;
  reason: string;
  status: 'requested' | 'approved' | 'denied' | 'in-transit' | 'received' | 'refunded' | 'rejected';
  requestDate: string;
  approvedDate?: string;
  receivedDate?: string;
  refundAmount?: number;
  refundMethod?: string;
  restockFee?: number;
  condition: 'new' | 'used' | 'damaged' | 'defective';
  notes?: string;
}
