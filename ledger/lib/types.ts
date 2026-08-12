export type Recurrence = "weekly" | "monthly" | "yearly" | "none";

export type OfferingType = "product" | "service";

// A "Product" can be a physical item (wholesale-bought, held as inventory)
// or a service/labor offering (no physical stock — its "cost" is what it
// costs you to deliver one unit, logged the same way a purchase is logged
// for a product). Both share the same WAC costing engine below; only the
// UI labels and whether EOQ/reorder planning applies differ by type.
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  type: OfferingType;
  active: boolean;
  // EOQ / reorder-planning inputs — product type only, all optional
  // (falls back to Settings defaults when unset).
  orderingCost?: number; // fixed cost to place one order (S)
  holdingCostPct?: number; // annual holding cost as % of unit cost (used to derive H)
  leadTimeDays?: number; // supplier lead time, for reorder point
  createdAt: number;
}

// For a product: a wholesale purchase (qty bought, unit cost).
// For a service: a cost entry (capacity/hours delivered, cost per unit —
// e.g. labor cost per hour or per job). Same shape, same WAC math either way.
export interface Purchase {
  id: string;
  productId: string;
  qty: number;
  unitCost: number;
  date: string; // ISO date (yyyy-mm-dd)
  supplier?: string; // product: supplier name. service: contractor/resource.
  notes?: string;
  createdAt: number;
}

export interface Sale {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  date: string; // ISO date
  customer?: string;
  notes?: string;
  createdAt: number;
}

export const EXPENSE_CATEGORIES = [
  "Marketing",
  "Rent & utilities",
  "Payroll & labor",
  "Software & tools",
  "Transport & logistics",
  "Professional fees",
  "Insurance",
  "Bank & payment fees",
  "Other overhead",
] as const;

// Covers both operating expenses AND recurring revenue (retainers, subscriptions,
// rent income, etc). "kind" decides which side of the P&L it lands on.
export interface Expense {
  id: string;
  name: string;
  amount: number;
  category: string;
  kind: "expense" | "revenue";
  isRecurring: boolean;
  recurrence: Recurrence;
  startDate: string; // ISO date
  endDate?: string; // ISO date, optional (ongoing if absent)
  createdAt: number;
}

export interface VariableCost {
  id: string;
  name: string;
  // "per_unit": flat amount added to every unit sold (any product, unless productId set)
  // "percent": percentage of the sale's revenue
  type: "per_unit" | "percent";
  amount: number;
  productId?: string; // if absent, applies globally to all products
  createdAt: number;
}

// Capital in/out of the business — separate from operating P&L. Tracks the
// initial investment, any reinvestment, and owner withdrawals, so the
// dashboard can show payback progress and cash position rather than only
// month-to-month profit.
export type CapitalKind = "investment" | "reinvestment" | "withdrawal";

export interface CapitalEntry {
  id: string;
  kind: CapitalKind;
  amount: number;
  date: string; // ISO date
  notes?: string;
  createdAt: number;
}

export interface Settings {
  taxRatePct: number; // e.g. 15 = 15%
  currency: string; // e.g. "LKR", "USD", "AED"
  forecastMonths: number; // how many months forward to project
  defaultOrderingCost: number; // fallback S for EOQ when a product doesn't set its own
  defaultHoldingCostPct: number; // fallback annual holding-cost % of unit cost
  defaultLeadTimeDays: number; // fallback supplier lead time in days
}

export const DEFAULT_SETTINGS: Settings = {
  taxRatePct: 0,
  currency: "LKR",
  forecastMonths: 3,
  defaultOrderingCost: 0,
  defaultHoldingCostPct: 20,
  defaultLeadTimeDays: 7,
};
