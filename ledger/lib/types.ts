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
  // Stock level tracking — product type only
  currentStock?: number; // current on-hand quantity, computed from purchases - sales
  minStockLevel?: number; // reorder point: alert when stock falls below this
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
  // Optional link to a Project — set when this purchase (materials, a
  // subcontracted service, whatever) was bought specifically for a costed
  // job. Rolls straight into that project's actual cost alongside its
  // manual cost segments — see ProjectCostSegment below. Purely additive.
  projectId?: string;
  // "cash"/"card"/"bank_transfer" are all treated as paid-in-full at purchase.
  // "credit" is money owed to supplier — it doesn't show as paid until a
  // PayablePayment is recorded against it.
  paymentMethod?: PaymentMethod;
  creditTermDays?: number; // only meaningful when paymentMethod === "credit"
  dueDate?: string; // ISO date = date + creditTermDays, stored so it never has to be recomputed
  // Multi-currency (all optional — absent means this was paid in the
  // business's base currency, i.e. exchangeRate 1). When set, `unitCost`
  // above is ALWAYS the base-currency equivalent (foreignUnitCost ×
  // exchangeRate), so WAC/COGS and every other calculation keep working
  // unchanged. These three fields exist purely to remember what was
  // actually paid, and in what currency, for display/audit. See lib/fx.ts.
  currency?: string; // e.g. "USD" — only set when different from the base currency
  exchangeRate?: number; // 1 unit of `currency` = this many units of base currency, at purchase date
  foreignUnitCost?: number; // the price actually paid, in `currency`
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

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "credit";

export interface Sale {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  date: string; // ISO date
  customer?: string;
  customerContact?: string; // phone/email — mainly useful once it's a credit sale you need to chase
  notes?: string;
  // Optional link to a Project — set when this sale is a progress-billing /
  // invoice line against a costed job rather than a standalone retail sale.
  // Purely additive: an untagged sale behaves exactly as before. See
  // Project/ProjectCostSegment below for the job-costing model.
  projectId?: string;
  // "cash"/"card"/"bank_transfer" are all treated as collected-in-full at the
  // point of sale. "credit" is money owed to you — it doesn't show up as cash
  // until a ReceivablePayment is recorded against it. Old sales without this
  // field are read as "cash" (see computeReceivablesAging / DataContext).
  paymentMethod?: PaymentMethod;
  creditTermDays?: number; // only meaningful when paymentMethod === "credit"
  dueDate?: string; // ISO date = date + creditTermDays, stored so it never has to be recomputed against a changed default later
  // Multi-currency (all optional — absent means this was charged in the
  // business's base currency, i.e. exchangeRate 1). When set, `unitPrice`
  // above is ALWAYS the base-currency equivalent (foreignUnitPrice ×
  // exchangeRate), so revenue/COGS/margin and every other calculation keep
  // working unchanged. These three fields exist purely to remember what was
  // actually charged, and in what currency, for display/audit. See lib/fx.ts.
  currency?: string; // e.g. "USD" — only set when different from the base currency
  exchangeRate?: number; // 1 unit of `currency` = this many units of base currency, at sale date
  foreignUnitPrice?: number; // the price actually charged, in `currency`
  // Who actually rang this up — set automatically by DataContext, never
  // user-entered. Powers per-staff cash reconciliation and the audit log;
  // also the basis for the Firestore rule that lets Staff read only their
  // own sales.
  createdByUid?: string;
  createdByName?: string;
  createdAt: number;
}

// A customer directory entry. Deliberately lightweight — this is a
// name/contact lookup, not a CRM: `Sale.customer` stays the free-text field
// it always was (so nothing about existing sales or the receivables/aging
// math changes), and this collection exists purely to (a) give the sale
// form a consistent list of names to pick from instead of retyping a
// slightly different spelling each time, and (b) anchor a per-customer
// view — total sales, outstanding balance, last visit — computed by
// matching this `name` against the existing sales/receivables data on the
// Customers page. No customerId foreign key anywhere; matching is by name.
export interface Customer {
  id: string;
  name: string;
  contact?: string; // phone or email
  notes?: string;
  createdByUid?: string;
  createdByName?: string;
  createdAt: number;
}

// A payment collected against a credit sale. Deliberately its own
// append-only record rather than an `amountPaid` field mutated on the Sale:
// that means collecting a payment never requires "edit" permission on
// Sales, so Staff can take a customer's cash against an outstanding credit
// sale without ever being able to alter the original sale record — and the
// business keeps a full history of who collected what, when, instead of a
// single overwritten running total.
export interface ReceivablePayment {
  id: string;
  saleId: string;
  amount: number;
  date: string; // ISO date
  method: "cash" | "card" | "bank_transfer";
  note?: string;
  createdByUid?: string;
  createdByName?: string;
  createdAt: number;
}

// A payment made against a credit purchase (payable). Mirrors ReceivablePayment
// for supplier payments — append-only for the same audit trail and permission
// separation reasons.
export interface PayablePayment {
  id: string;
  purchaseId: string;
  amount: number;
  date: string; // ISO date
  method: "cash" | "card" | "bank_transfer";
  note?: string;
  createdByUid?: string;
  createdByName?: string;
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
  // Optional link to a Project — set when this one-off cost (a permit, a
  // rental, a subcontractor invoice) belongs to a specific job rather than
  // general overhead. Only meaningful for kind === "expense". Purely
  // additive. See ProjectCostSegment below.
  projectId?: string;
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
  // If true, this cost is treated as part of Cost of Goods Sold and reduces
  // Gross Profit — the right setting for something like outbound shipping,
  // which most SME accounting treats as COGS, not a below-the-line cost.
  // If false/unset (the default — every VariableCost created before this
  // field existed behaves exactly as it did before), it only reduces
  // Contribution Margin, sitting below Gross Profit — the right setting for
  // payment processing fees, marketplace commissions, variable marketing
  // spend, and similar costs that aren't part of "what it cost to make/
  // acquire the thing you sold".
  includeInCogs?: boolean;
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
  // Default credit term offered to a customer when a sale is marked
  // "credit" and no term is entered on that sale specifically.
  defaultCreditTermDays: number;
  // Credit sales at or above this amount get visually flagged on the
  // Receivables page — not blocked, just surfaced, since the biggest single
  // fraud vector in a credit-heavy shop is a large "sale" that was never
  // really owed and never gets chased.
  creditReviewThreshold: number;
  // Rent (or any single largest fixed monthly outflow) — what the Cash
  // Runway tool is checking you can cover.
  rentAmount: number;
  rentDueDayOfMonth: number; // 1-28, day of month rent is due
  // Starting float assumed for a new cash-count session when nothing else
  // is entered.
  defaultOpeningFloat: number;
  // Business identity for printed documents (project quotes/invoices — see
  // buildQuoteHtml/buildInvoiceHtml in app/projects/page.tsx). All optional
  // and all purely cosmetic — nothing elsewhere in the app reads these, so
  // leaving them blank never breaks anything, it just means the printed
  // document has no letterhead.
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  // Download URL for a logo image uploaded via Settings → General (see
  // lib/logoUpload.ts). Purely cosmetic, same as the fields above — shown
  // next to the letterhead text on printed quotes/invoices/receipts when
  // set, omitted entirely when blank.
  logoUrl?: string;
  // Timestamp (Date.now()) of the last time an owner clicked "Download
  // full backup" on Import/Export. Backup is manual/on-demand — there is
  // no scheduled export — so this is purely so the Dashboard can show
  // "last backed up X days ago" (or "never") instead of an owner assuming
  // a backup exists that was never taken.
  lastBackupAt?: number;
}

export const DEFAULT_SETTINGS: Settings = {
  taxRatePct: 0,
  currency: "LKR",
  forecastMonths: 3,
  defaultOrderingCost: 0,
  defaultHoldingCostPct: 20,
  defaultLeadTimeDays: 7,
  defaultCreditTermDays: 90,
  creditReviewThreshold: 25000,
  rentAmount: 0,
  rentDueDayOfMonth: 1,
  defaultOpeningFloat: 0,
};

// ---------------------------------------------------------------------------
// Multi-user access. One business (identified by its owner's uid) can have
// several people signed in under it, each with their own login and a role
// that determines what they can see and do. See lib/permissions.ts for the
// actual permission matrix and firestore.rules for how it's enforced at the
// database level (client-side checks alone are not real security).
// ---------------------------------------------------------------------------

// owner: the account the business was created under. Full access, always
//   exactly one, cannot be removed or demoted.
// manager: trusted day-to-day operator. Can create/edit almost everything a
//   business needs day to day, but can't delete records, manage the team,
//   change settings, or see payroll — deletion and payroll are the two
//   things worth keeping to a short list of people even among trusted staff.
// staff: till/floor level. Can log a sale, record a customer's payment, and
//   count cash at end of shift — and nothing else. Critically, cannot edit
//   or delete anything once it's saved, including their own entries: a
//   genuine mistake gets fixed by a manager or owner, which is exactly the
//   friction that makes "log it low, pocket the difference" not work.
export type Role = "owner" | "manager" | "staff";

// The record of a person's membership in a business — lives at
// users/{businessId}/members/{uid}. This is the single source of truth
// Firestore rules check for every permission decision; nothing else (not
// even the top-level `memberships` pointer below) grants access on its own.
export interface Member {
  id: string; // == uid
  role: Role;
  name: string;
  email: string;
  active: boolean; // false = removed. Kept, not deleted, so history/audit trail stays intact.
  invitedBy?: string; // uid of whoever invited them
  createdAt: number;
}

// A top-level users/{uid}-independent pointer, at memberships/{uid}, that
// exists purely so a freshly signed-in user's own client can answer "which
// business am I part of" with a single doc read by their own uid — Firestore
// can't otherwise search "which business's members subcollection contains
// me" without a collection-group query. It intentionally carries no role —
// role is always read fresh from the Member doc above, so there's exactly
// one place a role can be wrong, and it isn't this one.
export interface MembershipPointer {
  businessId: string;
}

// A pending invitation — lives at users/{businessId}/invites/{id}. The owner
// creates one and shares the resulting link with the person out of band
// (WhatsApp, in person, whatever); accepting it is what creates the Member
// doc and the MembershipPointer, validated by matching email + role in
// firestore.rules.
export interface Invite {
  id: string;
  email: string; // lowercased at creation
  name: string; // pre-filled display name, editable by the invitee on accept
  role: Role;
  status: "pending" | "accepted" | "revoked";
  invitedBy: string; // uid
  invitedByName: string;
  createdAt: number;
  acceptedAt?: number;
  acceptedByUid?: string;
}

export type AuditAction = "create" | "update" | "delete";

// An append-only trail of who did what. Written by the app alongside the
// mutations that matter most for fraud detection (sales, purchases,
// expenses, deletions, role changes) — see contexts/DataContext.tsx. This is
// a detection/deterrence layer, not a cryptographic guarantee: firestore.rules
// make it truly impossible for anyone to edit or delete an entry here after
// the fact, but a sufficiently technical person could in principle write to
// Firestore directly and bypass the app's logging code entirely. The real,
// unconditional protection against theft is what firestore.rules refuses to
// allow Staff to do in the first place (see lib/permissions.ts) — this log
// is what lets an owner or manager notice when something looks wrong.
export interface AuditLogEntry {
  id: string;
  at: number;
  byUid: string;
  byName: string;
  byRole: Role;
  action: AuditAction;
  entity: string; // "sale" | "purchase" | "expense" | "product" | "loan" | "member" | ...
  entityId: string;
  summary: string; // short human-readable description, e.g. "Sale 2×Widget Rs 4,500 → Rs 2,500"
}

// End-of-shift cash reconciliation. `expectedCash` is snapshotted at the
// moment the count is submitted (opening float + cash sales collected -
// cash spent, over the covered date range) rather than recomputed live
// later, so a later edit to that day's records (which only Owner/Manager
// can make anyway) never silently rewrites a variance that's already been
// flagged and discussed. This is the single highest-leverage anti-theft
// control in the app: a staff member who's been skimming cash sales will
// show a shortfall here every time, on a clean, dated, named record they
// can never edit or delete themselves. The one exception is the Owner
// (never Manager, never the person who submitted it), who can correct a
// genuine data-entry slip — see DataContext.updateCashCount — without
// losing the record to a delete-and-recreate; `variance` is re-derived
// against the corrected `countedCash`, `expectedCash` itself never changes.
export interface CashCount {
  id: string;
  date: string; // ISO date the count covers
  openingFloat: number;
  expectedCash: number;
  countedCash: number;
  variance: number; // countedCash - expectedCash; negative = cash missing
  notes?: string;
  createdByUid?: string;
  createdByName?: string;
  createdAt: number;
}

// A billable-hours clock-in/out record. Deliberately per-job rather than
// per-day: `jobLabel` is a free-text reference (a customer name, a service
// sale, a project — whatever the business calls it) rather than a link to
// a formal "job" entity, since this app has no job/project object of its
// own. That also means the same member can have more than one entry open
// at once (clocked into two jobs on and off through the day) — the create
// rule doesn't try to prevent that, since a caterer or contractor genuinely
// does bounce between concurrent jobs. `clockOut` is unset while an entry
// is running; once set, `firestore.rules` blocks that field from ever being
// changed again by the entry's own creator, same anti-tampering shape as
// CashCount — only Owner/Manager can correct a mistake after the fact.
export interface TimeEntry {
  id: string;
  memberUid: string;
  memberName: string;
  jobLabel: string; // e.g. a customer name, "Acme Corp — website redesign"
  billable: boolean;
  hourlyRate?: number; // snapshotted at clock-in, in the business's currency
  clockIn: number; // epoch ms
  clockOut?: number; // epoch ms; absent while the entry is still running
  notes?: string;
  // Optional link to a Project — set when this clocked time was worked
  // against a costed job rather than general/unattributed work. Purely
  // additive, same shape as the `projectId` on Purchase/Expense/Sale: an
  // untagged entry behaves exactly as before. When set (and the entry has
  // both a hourlyRate and a clockOut), hours × rate rolls automatically
  // into that project's actual labor cost — see computeProjectFinancials
  // in lib/calculations.ts — instead of having to be re-entered by hand as
  // a manual ProjectCostSegment.
  projectId?: string;
  createdByUid?: string;
  createdByName?: string;
  createdAt: number;
}

// A cost-stripped mirror of Product, kept in sync by DataContext whenever a
// product is created/updated/deleted. Staff gets read access to this
// collection instead of `products` — same id, but no cost/margin fields —
// so a Staff-role sales form can list what's for sale and at what price
// without ever being able to read what it cost the business, and therefore
// without being able to work out how much room there is to skim per unit.
export interface CatalogItem {
  id: string; // == Product.id
  name: string;
  sku: string;
  category: string;
  type: OfferingType;
  active: boolean;
  sellPrice?: number; // mirrors Product.defaultSellPrice
}

// Notification types for reminders and alerts
export type NotificationType = 
  | "receivable_overdue"      // Customer payment is overdue
  | "receivable_due_soon"     // Customer payment due soon
  | "payable_overdue"         // Supplier payment is overdue
  | "payable_due_soon"        // Supplier payment due soon
  | "low_stock"               // Product stock below reorder point
  | "expense_due"             // Recurring expense due
  | "loan_payment_due"        // Loan payment due
  | "project_over_budget"     // Project actual cost is approaching/past its quoted price
  | "milestone_due"           // A progress-billing milestone is due soon or overdue
  | "custom";                 // User-created custom reminder

export type NotificationPriority = "low" | "medium" | "high";

// A notification/reminder for the business owner
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;           // Short headline
  message: string;         // Detailed description
  entityId?: string;       // Reference to related entity (saleId, purchaseId, productId, etc.)
  entityType?: string;     // Type of entity ("sale", "purchase", "product", etc.)
  dueDate?: string;        // ISO date when action is needed
  isRead: boolean;         // Whether user has dismissed/read it
  dismissedAt?: number;    // Timestamp when marked as read
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Project / job costing. A Project bundles many costs against ONE agreed
// price, so a business that quotes jobs (a build, a renovation, a client
// engagement, a custom order) can see whether that specific job actually
// made money once every material, subcontractor invoice, and ad-hoc cost
// against it is totalled up — not just whether the business as a whole is
// profitable that month. Deliberately kept separate from the WAC/COGS
// engine (which answers "is this *product* profitable") — this answers
// "is this *job* profitable", the question a project-based SME (a
// contractor, an agency, a fabricator) actually asks.
// ---------------------------------------------------------------------------

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";

export const PROJECT_COST_CATEGORIES = [
  "Materials",
  "Labor",
  "Subcontractor",
  "Equipment & rental",
  "Permits & fees",
  "Transport & logistics",
  "Overhead allocation",
  "Other",
] as const;

// A costed job — e.g. a customer order, a renovation, a build, a contract
// engagement. `quotedPrice` is the single agreed/contracted value of the
// whole job; every cost that lands against it (see ProjectCostSegment, and
// the optional `projectId` on Purchase/Expense/Sale) is compared against
// this one number to answer "did we make money on this job".
export interface Project {
  id: string;
  name: string;
  client?: string;
  quotedPrice: number; // the agreed/contracted price for the whole project
  status: ProjectStatus;
  startDate: string; // ISO date
  targetEndDate?: string; // ISO date
  completedDate?: string; // ISO date, set when marked completed
  notes?: string;
  createdAt: number;
}

// One line of cost against a project — a "cost segment". Kept as its own
// append list (rather than a running total mutated on Project) for the same
// auditability reason every other ledger in this app works this way.
// Segments are for costs that don't already exist as a Purchase or Expense
// (a subcontractor's lump-sum invoice, a permit fee, a manual labor
// allocation). A cost that *does* already exist as a Purchase or Expense
// should be tagged with this project's id on that record instead (its
// `projectId` field), so nothing is ever counted twice — see
// computeProjectFinancials in lib/calculations.ts, which sums segments and
// tagged Purchases/Expenses together into one total.
export interface ProjectCostSegment {
  id: string;
  projectId: string;
  label: string;
  category: string; // one of PROJECT_COST_CATEGORIES, free text also accepted
  amount: number;
  date: string; // ISO date
  notes?: string;
  createdAt: number;
}

// A progress-billing schedule line for a Project — e.g. "Deposit", "50% on
// delivery", "Final payment on handover". Deliberately its own append list
// (same auditability pattern as ProjectCostSegment) rather than a JSON blob
// on Project, and deliberately NOT auto-converted into a Sale: a milestone
// can be scheduled long before it's actually billed, and a service project
// billed in stages doesn't always map to a sellable Product/SKU the way the
// Sale record requires. Status is tracked here directly instead — see
// summarizeMilestones in lib/calculations.ts for the roll-up used on the
// Project detail view (scheduled vs invoiced vs paid, against quotedPrice).
export type MilestoneStatus = "pending" | "invoiced" | "paid";

export interface ProjectMilestone {
  id: string;
  projectId: string;
  label: string; // e.g. "Deposit", "Milestone 2 — framing complete"
  amount: number;
  dueDate?: string; // ISO date
  status: MilestoneStatus;
  invoicedDate?: string; // ISO date, set when marked invoiced
  paidDate?: string; // ISO date, set when marked paid
  notes?: string;
  createdAt: number;
}

// Fixed asset for depreciation tracking (machinery, vehicles, equipment, etc.)
export interface FixedAsset {
  id: string;
  name: string;
  category: string;
  purchaseDate: string; // ISO date
  cost: number;
  usefulLifeMonths: number;
  salvageValue?: number;
  notes?: string;
  disposalDate?: string; // ISO date, set when disposed
  disposalAmount?: number; // amount received on disposal
  createdAt: number;
}
