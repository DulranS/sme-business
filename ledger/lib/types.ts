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
  // Default prices — optional convenience fields. Pre-fill the unit
  // cost/price on new Purchase/Sale entries so they don't need to be
  // retyped every time, and drive the live margin preview on this form and
  // the quick stock/sell actions on the Products page. The actual WAC/COGS
  // engine still only ever uses what's entered on each Purchase/Sale — these
  // are just sensible starting values, not a source of truth.
  defaultCostPrice?: number;
  defaultSellPrice?: number;
  // For service-type offerings especially: the labor cost that goes into
  // delivering one unit (an employee's time, not a logged Purchase/contractor
  // fee). Doesn't touch COGS or the WAC ledger — a service delivered by an
  // employee already has that employee's pay sitting in operating expenses,
  // so folding it into COGS too would double-count it. This is a separate,
  // clearly-labeled "fully-loaded" view so a service's true per-unit margin
  // isn't overstated just because payroll happens to live in a different
  // bucket than COGS.
  laborCostPerUnit?: number;
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

// A bank/supplier loan or other business debt. Monthly amortizing loan —
// this is what SMEs actually take (working capital loan, equipment loan,
// overdraft converted to term loan) — so the schedule assumes monthly
// payments rather than modeling every possible frequency. startDate is the
// disbursement date; the first payment falls one month after it.
export interface Loan {
  id: string;
  name: string; // e.g. "BOC working capital loan"
  lender?: string;
  principal: number; // original amount borrowed
  annualInterestRatePct: number; // nominal annual rate, e.g. 14 = 14%
  termMonths: number; // number of monthly payments
  startDate: string; // ISO date — disbursement date
  notes?: string;
  active: boolean; // false = closed/paid off early, kept for history but excluded from "current" liability views
  createdAt: number;
}

export interface Settings {
  taxRatePct: number; // e.g. 15 = 15%
  currency: string; // e.g. "LKR", "USD", "AED"
  forecastMonths: number; // how many months forward to project
  defaultOrderingCost: number; // fallback S for EOQ when a product doesn't set its own
  defaultHoldingCostPct: number; // fallback annual holding-cost % of unit cost
  defaultLeadTimeDays: number; // fallback supplier lead time in days
  // Imputed monthly cost of the owner's own labor — what you'd have to pay
  // someone to do your job if you weren't doing it. Not a real transaction
  // and never touches the accounting statements; purely a decision-support
  // number so "we're profitable" isn't an illusion built on nobody paying
  // themselves for the hours they put in.
  monthlyOwnerDraw?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  taxRatePct: 0,
  currency: "LKR",
  forecastMonths: 3,
  defaultOrderingCost: 0,
  defaultHoldingCostPct: 20,
  defaultLeadTimeDays: 7,
};
