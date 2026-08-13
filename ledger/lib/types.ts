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
// This represents STOCK ALREADY IN HAND / cost already incurred — see
// PurchaseOrder below for stock that's been ordered but not yet received.
export interface Purchase {
  id: string;
  productId: string;
  qty: number;
  unitCost: number;
  date: string; // ISO date (yyyy-mm-dd)
  supplier?: string; // product: supplier name. service: contractor/resource.
  notes?: string;
  purchaseOrderId?: string; // set when this purchase was created by receiving a PO
  createdAt: number;
}

export type OrderStatus = "ordered" | "in_transit" | "received" | "cancelled";

// A wholesale order placed with a supplier — separate from Purchase, which
// represents stock you already physically hold. A PurchaseOrder tracks the
// commitment (what you ordered, when, from whom, expected when) through to
// receipt. Marking one "received" generates the corresponding Purchase entry
// (qty actually received, which can differ from qty ordered) so it flows
// into the WAC/inventory ledger exactly once, at the moment stock actually
// arrives — not when you merely placed the order.
export interface PurchaseOrder {
  id: string;
  productId: string;
  qtyOrdered: number;
  unitCost: number; // quoted/expected unit cost at order time
  orderDate: string; // ISO date
  expectedDate?: string; // ISO date
  supplier?: string;
  notes?: string;
  status: OrderStatus;
  receivedDate?: string; // ISO date, set when received
  qtyReceived?: number; // actual qty received, set when received (may differ from qtyOrdered)
  receivedUnitCost?: number; // actual unit cost paid, set when received (may differ from quoted)
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
  employeeId?: string; // set when this expense is the auto-managed payroll line for an Employee
  createdAt: number;
}

// An employee/contractor on payroll. Adding one automatically books their pay
// as a recurring expense (category "Payroll & labor") so it flows straight
// into MRR, monthly P&L, and the spend-by-category breakdown — payroll is
// just another recurring bill, bookkept the same way rent or a subscription
// is, rather than a separate system. taxPct is the employee's own
// withholding/PAYE rate: informational only (splits take-home vs. tax
// remitted) and does NOT change what the business pays out — gross pay is
// the real cash cost and is what's booked as the expense.
export interface Employee {
  id: string;
  name: string;
  role: string;
  payRate: number; // gross pay per pay period
  payFrequency: Exclude<Recurrence, "none">;
  taxPct: number; // employee's personal tax/withholding %, for take-home reference only
  startDate: string; // ISO date
  endDate?: string; // ISO date, set when employee becomes inactive
  active: boolean;
  notes?: string;
  linkedExpenseId?: string; // the auto-managed Expense doc this employee's pay is booked as
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
