import type {
  CapitalEntry,
  Employee,
  Expense,
  FixedAsset,
  Loan,
  OfferingType,
  PaymentFields,
  Product,
  Purchase,
  PurchaseOrder,
  Recurrence,
  Sale,
  Settings,
  VariableCost,
} from "./types";

// ---------------------------------------------------------------------------
// Inventory costing: Weighted Average Cost (WAC).
//
// Why WAC and not FIFO/LIFO: FIFO/LIFO need lot-level tracking (which physical
// batch a sale draws down), which is real bookkeeping overhead for a solo
// operator hand-entering purchases and sales. WAC keeps one rolling cost per
// product, recalculated on every purchase, and is what most small-business
// accounting tools default to for exactly this reason. It's auditable from a
// flat purchases+sales list, which is what we store.
// ---------------------------------------------------------------------------

export interface LedgerEvent {
  date: string;
  createdAt: number;
  type: "purchase" | "sale";
  qty: number;
  unitValue: number; // unitCost for purchase, unitPrice for sale
  refId: string;
}

export interface SaleCogsResult {
  saleId: string;
  cogsPerUnit: number;
  cogsTotal: number;
  oversold: boolean; // sold more than was on hand at that point
}

export interface ProductLedgerResult {
  qtyOnHand: number;
  wac: number; // current weighted average cost
  inventoryValue: number;
  saleCogs: Map<string, SaleCogsResult>;
}

function sortEvents(events: LedgerEvent[]): LedgerEvent[] {
  return [...events].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    return a.createdAt - b.createdAt;
  });
}

export function computeProductLedger(
  purchases: Purchase[],
  sales: Sale[]
): ProductLedgerResult {
  const events: LedgerEvent[] = [
    ...purchases.map((p) => ({
      date: p.date,
      createdAt: p.createdAt,
      type: "purchase" as const,
      qty: p.qty,
      unitValue: p.unitCost,
      refId: p.id,
    })),
    ...sales.map((s) => ({
      date: s.date,
      createdAt: s.createdAt,
      type: "sale" as const,
      qty: s.qty,
      unitValue: s.unitPrice,
      refId: s.id,
    })),
  ];

  const ordered = sortEvents(events);

  let qtyOnHand = 0;
  let wac = 0;
  const saleCogs = new Map<string, SaleCogsResult>();

  for (const ev of ordered) {
    if (ev.type === "purchase") {
      const newQty = qtyOnHand + ev.qty;
      wac = newQty > 0 ? (qtyOnHand * wac + ev.qty * ev.unitValue) / newQty : 0;
      qtyOnHand = newQty;
    } else {
      const oversold = ev.qty > qtyOnHand;
      const cogsPerUnit = wac;
      const cogsTotal = cogsPerUnit * ev.qty;
      saleCogs.set(ev.refId, { saleId: ev.refId, cogsPerUnit, cogsTotal, oversold });
      qtyOnHand = qtyOnHand - ev.qty; // allowed to go negative -> surfaced as "oversold" in UI
    }
  }

  return {
    qtyOnHand,
    wac,
    inventoryValue: Math.max(qtyOnHand, 0) * wac,
    saleCogs,
  };
}

export function computeAllLedgers(
  products: Product[],
  purchases: Purchase[],
  sales: Sale[]
): Map<string, ProductLedgerResult> {
  const byProduct = new Map<string, ProductLedgerResult>();
  for (const product of products) {
    const pPurchases = purchases.filter((p) => p.productId === product.id);
    const pSales = sales.filter((s) => s.productId === product.id);
    byProduct.set(product.id, computeProductLedger(pPurchases, pSales));
  }
  return byProduct;
}

// ---------------------------------------------------------------------------
// Unit economics for a single sale.
// ---------------------------------------------------------------------------

export function variableCostForSale(
  sale: Sale,
  variableCosts: VariableCost[]
): number {
  const applicable = variableCosts.filter(
    (vc) => !vc.productId || vc.productId === sale.productId
  );
  let total = 0;
  for (const vc of applicable) {
    if (vc.type === "per_unit") {
      total += vc.amount * sale.qty;
    } else {
      total += (vc.amount / 100) * sale.unitPrice * sale.qty;
    }
  }
  return total;
}

export interface SaleEconomics {
  saleId: string;
  revenue: number;
  cogs: number;
  variableCost: number;
  grossProfit: number; // revenue - cogs
  contributionMargin: number; // revenue - cogs - variableCost
  contributionMarginPerUnit: number;
  oversold: boolean;
}

export function computeSaleEconomics(
  sales: Sale[],
  ledgers: Map<string, ProductLedgerResult>,
  variableCosts: VariableCost[]
): SaleEconomics[] {
  return sales.map((sale) => {
    const ledger = ledgers.get(sale.productId);
    const cogsResult = ledger?.saleCogs.get(sale.id);
    const cogs = cogsResult?.cogsTotal ?? 0;
    const revenue = sale.unitPrice * sale.qty;
    const varCost = variableCostForSale(sale, variableCosts);
    const grossProfit = revenue - cogs;
    const contributionMargin = grossProfit - varCost;
    return {
      saleId: sale.id,
      revenue,
      cogs,
      variableCost: varCost,
      grossProfit,
      contributionMargin,
      contributionMarginPerUnit: sale.qty > 0 ? contributionMargin / sale.qty : 0,
      oversold: cogsResult?.oversold ?? false,
    };
  });
}

// ---------------------------------------------------------------------------
// Recurring items normalized to a monthly figure (MRR-style), and expanded
// into the specific months they're active in for period P&L.
// ---------------------------------------------------------------------------

export function monthlyNormalizedAmount(amount: number, recurrence: Recurrence): number {
  switch (recurrence) {
    case "weekly":
      return (amount * 52) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    default:
      return 0;
  }
}

// Returns the total recurring monthly run-rate active as of `asOfISO`.
export function computeMRR(expenses: Expense[], asOfISO: string): { mrrRevenue: number; mrrExpense: number } {
  let mrrRevenue = 0;
  let mrrExpense = 0;
  for (const e of expenses) {
    if (!e.isRecurring) continue;
    const started = e.startDate <= asOfISO;
    const notEnded = !e.endDate || e.endDate >= asOfISO;
    if (started && notEnded) {
      const monthly = monthlyNormalizedAmount(e.amount, e.recurrence);
      if (e.kind === "revenue") mrrRevenue += monthly;
      else mrrExpense += monthly;
    }
  }
  return { mrrRevenue, mrrExpense };
}

// Expands expenses/recurring-revenue into a per-month total for a given
// month key ("YYYY-MM"). One-off items land only in their startDate's month.
export function expenseTotalsForMonth(
  expenses: Expense[],
  monthKey: string
): { expenseTotal: number; recurringRevenueTotal: number } {
  const monthStart = `${monthKey}-01`;
  const [y, m] = monthKey.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  let expenseTotal = 0;
  let recurringRevenueTotal = 0;

  for (const e of expenses) {
    if (e.isRecurring) {
      const started = e.startDate < nextMonth;
      const notEnded = !e.endDate || e.endDate >= monthStart;
      if (started && notEnded) {
        const monthly = monthlyNormalizedAmount(e.amount, e.recurrence);
        if (e.kind === "revenue") recurringRevenueTotal += monthly;
        else expenseTotal += monthly;
      }
    } else {
      if (e.startDate >= monthStart && e.startDate < nextMonth) {
        if (e.kind === "revenue") recurringRevenueTotal += e.amount;
        else expenseTotal += e.amount;
      }
    }
  }
  return { expenseTotal, recurringRevenueTotal };
}

// ---------------------------------------------------------------------------
// Period P&L: aggregate sales + expenses into monthly buckets, then compute
// gross profit, net profit (pre/post tax) per month.
// ---------------------------------------------------------------------------

export interface MonthlyPnL {
  month: string; // "YYYY-MM"
  salesRevenue: number;
  recurringRevenue: number;
  totalRevenue: number;
  cogs: number;
  variableCosts: number;
  grossProfit: number;
  grossMarginPct: number | null; // grossProfit / totalRevenue, null when no revenue
  operatingExpenses: number; // rent, payroll, subscriptions, etc — excludes loan interest
  interestExpense: number; // loan interest for the month
  netProfitPreTax: number; // grossProfit - operatingExpenses - interestExpense
  tax: number;
  netProfitAfterTax: number;
  netMarginPct: number | null; // netProfitAfterTax / totalRevenue, null when no revenue
  unitsSold: number;
  // Decision-support only — not a real transaction, never flows into the
  // Income Statement/Balance Sheet/Cash Flow Statement. Nets the owner's
  // imputed monthly labor cost (Settings.monthlyOwnerDraw) out of accounting
  // net profit, so "the business is profitable" isn't quietly built on
  // nobody paying themselves for the hours worked.
  economicProfit: number;
  depreciationExpense: number; // straight-line, non-cash — see computeFixedAssetSchedule
  disposalGainLoss: number; // gain/(loss) recognized when a fixed asset is disposed — see computeDisposalGainLossByMonth
  // Cash-basis fields, for the Cash Flow Statement / Balance Sheet. These
  // differ from the accrual fields above in two ways: (1) inventory
  // purchases hit cash when bought, not when the stock is later sold (COGS
  // timing), and (2) sales/purchases on credit terms (see PaymentFields)
  // hit cash when actually paid — via paidDate — not on the accrual `date`.
  // An unpaid or partial sale/purchase contributes its accrual figures to
  // salesRevenue/cogs/purchaseCash as usual but only its *received/paid*
  // amount here.
  salesCash: number; // actual cash received from sales this month
  purchaseCash: number; // actual cash paid for inventory this month
  loanProceeds: number; // new loan cash received this month
  principalRepayment: number; // loan principal repaid this month
  capitalIn: number; // owner investment/reinvestment this month
  capitalOut: number; // owner withdrawals this month
  assetPurchaseCash: number; // cash paid for fixed assets this month
  assetDisposalCash: number; // cash received from disposing fixed assets this month
  operatingCashFlow: number;
  financingCashFlow: number;
  investingCashFlow: number;
  netCashFlow: number; // operating + financing + investing
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Accounts Receivable / Accounts Payable
//
// A sale or purchase with no paymentStatus set is treated as "paid" in full
// on its `date` — this is the pre-AR/AP default and keeps every existing
// record's cash timing exactly as it was before these fields existed.
// Only records explicitly marked "unpaid"/"partial" (i.e. sold/bought on
// credit terms) behave differently.
// ---------------------------------------------------------------------------

interface CashEvent {
  date: string | null; // null = no cash has moved yet (fully unpaid)
  amount: number; // cash amount that moved on `date`
  outstanding: number; // remaining balance still owed as of now
}

function resolveCashEvent(entry: PaymentFields, fullAmount: number, entryDate: string): CashEvent {
  const status = entry.paymentStatus ?? "paid";
  if (status === "paid") {
    const amount = entry.amountPaid ?? fullAmount;
    return { date: entry.paidDate ?? entryDate, amount, outstanding: Math.max(fullAmount - amount, 0) };
  }
  if (status === "partial") {
    const amount = entry.amountPaid ?? 0;
    return { date: amount > 0 ? entry.paidDate ?? entryDate : null, amount, outstanding: Math.max(fullAmount - amount, 0) };
  }
  // unpaid
  return { date: null, amount: 0, outstanding: fullAmount };
}

function cashByMonth(events: CashEvent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const ev of events) {
    if (!ev.date || ev.amount === 0) continue;
    const key = monthKey(ev.date);
    map.set(key, (map.get(key) ?? 0) + ev.amount);
  }
  return map;
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export interface AgingLineItem {
  id: string;
  label: string; // customer/supplier name, or product name fallback
  date: string; // transaction date
  dueDate: string | null;
  fullAmount: number;
  amountPaid: number;
  outstanding: number;
  daysOverdue: number; // negative = not yet due
  bucket: AgingBucket;
}

function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "1-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86400000);
}

export interface AgingSummary {
  items: AgingLineItem[];
  totalOutstanding: number;
  overdueTotal: number;
  byBucket: Record<AgingBucket, number>;
}

function summarizeAging(items: AgingLineItem[]): AgingSummary {
  const byBucket: Record<AgingBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let totalOutstanding = 0;
  let overdueTotal = 0;
  for (const item of items) {
    byBucket[item.bucket] += item.outstanding;
    totalOutstanding += item.outstanding;
    if (item.bucket !== "current") overdueTotal += item.outstanding;
  }
  return { items, totalOutstanding, overdueTotal, byBucket };
}

// Money customers owe you. Only sales with something still outstanding
// (unpaid or partial) show up here.
export function computeReceivables(sales: Sale[], asOfISO: string): AgingSummary {
  const items: AgingLineItem[] = [];
  for (const s of sales) {
    const fullAmount = s.unitPrice * s.qty;
    const cash = resolveCashEvent(s, fullAmount, s.date);
    if (cash.outstanding <= 0) continue;
    const dueDate = s.dueDate ?? null;
    // No due date set on a credit sale: assume net-30 from the sale date, a
    // reasonable default term, so it still ages sensibly instead of being
    // permanently "current".
    const daysOverdue = dueDate ? daysBetween(dueDate, asOfISO) : daysBetween(s.date, asOfISO) - 30;
    items.push({
      id: s.id,
      label: s.customer || "Unnamed customer",
      date: s.date,
      dueDate,
      fullAmount,
      amountPaid: cash.amount,
      outstanding: cash.outstanding,
      daysOverdue,
      bucket: agingBucket(daysOverdue),
    });
  }
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return summarizeAging(items);
}

// Money you owe suppliers. Only purchases with something still outstanding
// (unpaid or partial) show up here.
export function computePayables(purchases: Purchase[], asOfISO: string): AgingSummary {
  const items: AgingLineItem[] = [];
  for (const p of purchases) {
    const fullAmount = p.qty * p.unitCost;
    const cash = resolveCashEvent(p, fullAmount, p.date);
    if (cash.outstanding <= 0) continue;
    const dueDate = p.dueDate ?? null;
    const daysOverdue = dueDate ? daysBetween(dueDate, asOfISO) : daysBetween(p.date, asOfISO) - 30;
    items.push({
      id: p.id,
      label: p.supplier || "Unnamed supplier",
      date: p.date,
      dueDate,
      fullAmount,
      amountPaid: cash.amount,
      outstanding: cash.outstanding,
      daysOverdue,
      bucket: agingBucket(daysOverdue),
    });
  }
  items.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return summarizeAging(items);
}

// ---------------------------------------------------------------------------
// Fixed assets — straight-line depreciation.
// ---------------------------------------------------------------------------

export interface FixedAssetStatus {
  asset: FixedAsset;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  fullyDepreciated: boolean;
  disposed: boolean;
}

function addMonthsToKey(key: string, n: number): string {
  let [y, m] = key.split("-").map(Number);
  m += n;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function computeFixedAssetStatus(asset: FixedAsset, asOfISO: string): FixedAssetStatus {
  const salvage = asset.salvageValue ?? 0;
  const depreciable = Math.max(asset.cost - salvage, 0);
  const monthlyDepreciation = asset.usefulLifeMonths > 0 ? depreciable / asset.usefulLifeMonths : 0;

  const endKey = asset.disposalDate
    ? monthKey(asset.disposalDate) < monthKey(asOfISO)
      ? monthKey(asset.disposalDate)
      : monthKey(asOfISO)
    : monthKey(asOfISO);
  const purchaseKey = monthKey(asset.purchaseDate);

  let monthsElapsed = 0;
  if (endKey >= purchaseKey) {
    let [py, pm] = purchaseKey.split("-").map(Number);
    let [ey, em] = endKey.split("-").map(Number);
    monthsElapsed = (ey - py) * 12 + (em - pm) + 1; // depreciation starts the month of purchase
  }
  monthsElapsed = Math.max(0, Math.min(monthsElapsed, asset.usefulLifeMonths));

  const accumulatedDepreciation = monthlyDepreciation * monthsElapsed;
  const netBookValue = Math.max(asset.cost - accumulatedDepreciation, salvage);

  return {
    asset,
    monthlyDepreciation,
    accumulatedDepreciation,
    netBookValue,
    fullyDepreciated: monthsElapsed >= asset.usefulLifeMonths,
    disposed: !!asset.disposalDate && asset.disposalDate <= asOfISO,
  };
}

// Total net book value across all non-disposed assets, as of a date — the
// Balance Sheet's "Fixed assets (net)" line.
export function computeFixedAssetsNetValue(assets: FixedAsset[], asOfISO: string): number {
  return assets.reduce((sum, a) => {
    if (a.disposalDate && a.disposalDate <= asOfISO) return sum;
    return sum + computeFixedAssetStatus(a, asOfISO).netBookValue;
  }, 0);
}

// Monthly depreciation expense (for the Income Statement) keyed by "YYYY-MM".
function computeDepreciationByMonth(assets: FixedAsset[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of assets) {
    const salvage = a.salvageValue ?? 0;
    const monthlyDepreciation = a.usefulLifeMonths > 0 ? Math.max(a.cost - salvage, 0) / a.usefulLifeMonths : 0;
    if (monthlyDepreciation <= 0) continue;
    const purchaseKey = monthKey(a.purchaseDate);
    const lastKey = a.disposalDate ? monthKey(a.disposalDate) : addMonthsToKey(purchaseKey, a.usefulLifeMonths - 1);
    let key = purchaseKey;
    let count = 0;
    while (key <= lastKey && count < a.usefulLifeMonths) {
      map.set(key, (map.get(key) ?? 0) + monthlyDepreciation);
      key = addMonthsToKey(key, 1);
      count += 1;
    }
  }
  return map;
}

// Investing cash flow, keyed by "YYYY-MM": -cost on purchase, +proceeds on disposal.
function computeAssetCashByMonth(assets: FixedAsset[]): {
  out: Map<string, number>;
  in: Map<string, number>;
} {
  const out = new Map<string, number>();
  const inMap = new Map<string, number>();
  for (const a of assets) {
    const pKey = monthKey(a.purchaseDate);
    out.set(pKey, (out.get(pKey) ?? 0) + a.cost);
    if (a.disposalDate && a.disposalAmount) {
      const dKey = monthKey(a.disposalDate);
      inMap.set(dKey, (inMap.get(dKey) ?? 0) + a.disposalAmount);
    }
  }
  return { out, in: inMap };
}

// Disposing an asset removes its remaining net book value from the Balance
// Sheet entirely (computeFixedAssetsNetValue excludes disposed assets
// outright, regardless of how much book value was left). If that removal
// isn't booked as a gain or loss somewhere, equity doesn't move to match —
// the Balance Sheet silently stops balancing by exactly the leftover book
// value. This is the accrual-side entry that keeps it correct: proceeds
// received minus the asset's net book value on its disposal date, landing
// in the month of disposal. A scrapped asset (no/low proceeds) shows a
// loss; selling above book value shows a gain.
function computeDisposalGainLossByMonth(assets: FixedAsset[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of assets) {
    if (!a.disposalDate) continue;
    const nbvAtDisposal = computeFixedAssetStatus(a, a.disposalDate).netBookValue;
    const gainLoss = (a.disposalAmount ?? 0) - nbvAtDisposal;
    const dKey = monthKey(a.disposalDate);
    map.set(dKey, (map.get(dKey) ?? 0) + gainLoss);
  }
  return map;
}


// Every calendar month from the earliest activity to "now", inclusive — not
// just months that happen to contain a sale or a new expense. Without this,
// a recurring expense (rent, a loan payment) silently disappears from the
// P&L / cash flow in any month with no sales activity, which would also
// throw off the Balance Sheet's cumulative cash figure.
function fullMonthRange(startKey: string, endKey: string): string[] {
  const months: string[] = [];
  let [y, m] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function computeMonthlyPnL(
  sales: Sale[],
  saleEconomics: SaleEconomics[],
  expenses: Expense[],
  purchases: Purchase[],
  loans: Loan[],
  capitalEntries: CapitalEntry[],
  taxRatePct: number,
  monthlyOwnerDraw = 0,
  fixedAssets: FixedAsset[] = []
): MonthlyPnL[] {
  const economicsBySaleId = new Map(saleEconomics.map((e) => [e.saleId, e]));
  const loanMonthlyTotals = computeLoanMonthlyTotals(loans);
  const depreciationByMonth = computeDepreciationByMonth(fixedAssets);
  const disposalGainLossByMonth = computeDisposalGainLossByMonth(fixedAssets);
  const assetCash = computeAssetCashByMonth(fixedAssets);

  // Cash timing for sales/purchases: accrual figures (salesRevenue, cogs,
  // purchase cost) are always booked in the transaction's own month below,
  // regardless of payment status. Cash only moves in the month it was
  // actually received/paid — see resolveCashEvent.
  const salesCashByMonth = cashByMonth(
    sales.map((s) => resolveCashEvent(s, s.unitPrice * s.qty, s.date))
  );
  const purchaseCashByMonth = cashByMonth(
    purchases.map((p) => resolveCashEvent(p, p.qty * p.unitCost, p.date))
  );

  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const candidateKeys: string[] = [nowKey];
  for (const s of sales) candidateKeys.push(monthKey(s.date));
  for (const p of purchases) candidateKeys.push(monthKey(p.date));
  for (const e of expenses) candidateKeys.push(monthKey(e.startDate));
  for (const c of capitalEntries) candidateKeys.push(monthKey(c.date));
  for (const a of fixedAssets) candidateKeys.push(monthKey(a.purchaseDate));
  // Loan schedules run for the loan's full term (often 12-36+ months), which
  // is almost always well past "now". Letting those future months extend the
  // P&L range breaks every piece of code that treats the last entry in this
  // array as "the current month" (Dashboard KPIs, break-even, the Statements
  // default month, the revenue forecast baseline) — they'd silently pick up
  // a mostly-empty future month instead. Past/current loan months still need
  // to land in the range (that's how interest expense reaches the month it
  // was actually incurred in), so only future ones are excluded here.
  for (const key of loanMonthlyTotals.keys()) {
    if (key <= nowKey) candidateKeys.push(key);
  }

  if (candidateKeys.length === 0) return [];
  candidateKeys.sort();
  const months = fullMonthRange(candidateKeys[0], candidateKeys[candidateKeys.length - 1]);
  const result: MonthlyPnL[] = [];

  for (const month of months) {
    const monthSales = sales.filter((s) => monthKey(s.date) === month);
    let salesRevenue = 0;
    let cogs = 0;
    let variableCosts = 0;
    let unitsSold = 0;
    for (const s of monthSales) {
      const econ = economicsBySaleId.get(s.id);
      salesRevenue += econ?.revenue ?? 0;
      cogs += econ?.cogs ?? 0;
      variableCosts += econ?.variableCost ?? 0;
      unitsSold += s.qty;
    }

    const { expenseTotal, recurringRevenueTotal } = expenseTotalsForMonth(expenses, month);
    const totalRevenue = salesRevenue + recurringRevenueTotal;
    const grossProfit = salesRevenue - cogs - variableCosts + recurringRevenueTotal;

    const loanTotals = loanMonthlyTotals.get(month);
    const interestExpense = loanTotals?.interest ?? 0;
    const principalRepayment = loanTotals?.principal ?? 0;
    const loanProceeds = loanTotals?.proceeds ?? 0;
    const depreciationExpense = depreciationByMonth.get(month) ?? 0;
    const disposalGainLoss = disposalGainLossByMonth.get(month) ?? 0;

    const netProfitPreTax = grossProfit - expenseTotal - interestExpense - depreciationExpense + disposalGainLoss;
    const tax = Math.max(netProfitPreTax, 0) * (taxRatePct / 100);
    const netProfitAfterTax = netProfitPreTax - tax;
    const economicProfit = netProfitAfterTax - monthlyOwnerDraw;

    const salesCash = salesCashByMonth.get(month) ?? 0;
    const purchaseCash = purchaseCashByMonth.get(month) ?? 0;

    const monthCapital = capitalEntries.filter((c) => monthKey(c.date) === month);
    const capitalIn = monthCapital
      .filter((c) => c.kind === "investment" || c.kind === "reinvestment")
      .reduce((s, c) => s + c.amount, 0);
    const capitalOut = monthCapital
      .filter((c) => c.kind === "withdrawal")
      .reduce((s, c) => s + c.amount, 0);

    const assetPurchaseCash = assetCash.out.get(month) ?? 0;
    const assetDisposalCash = assetCash.in.get(month) ?? 0;

    // Depreciation is non-cash by design — it's excluded here; the actual
    // cash cost hit Investing when the asset was purchased/disposed.
    const operatingCashFlow =
      salesCash + recurringRevenueTotal - purchaseCash - variableCosts - expenseTotal - interestExpense - tax;
    const financingCashFlow = loanProceeds - principalRepayment + capitalIn - capitalOut;
    const investingCashFlow = assetDisposalCash - assetPurchaseCash;

    result.push({
      month,
      salesRevenue,
      recurringRevenue: recurringRevenueTotal,
      totalRevenue,
      cogs,
      variableCosts,
      grossProfit,
      grossMarginPct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null,
      operatingExpenses: expenseTotal,
      interestExpense,
      netProfitPreTax,
      tax,
      netProfitAfterTax,
      netMarginPct: totalRevenue > 0 ? (netProfitAfterTax / totalRevenue) * 100 : null,
      unitsSold,
      economicProfit,
      depreciationExpense,
      disposalGainLoss,
      salesCash,
      purchaseCash,
      loanProceeds,
      principalRepayment,
      capitalIn,
      capitalOut,
      assetPurchaseCash,
      assetDisposalCash,
      operatingCashFlow,
      financingCashFlow,
      investingCashFlow,
      netCashFlow: operatingCashFlow + financingCashFlow + investingCashFlow,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Forecasting: simple linear regression (least squares) over monthly revenue
// plus a 3-period moving average, projected forward N months.
//
// Why not ARIMA/Prophet: those need dozens of clean periodic data points to
// beat a trend line. A solo SME ledger has few, noisy months. Linear
// regression + moving average is transparent (you can verify it by hand),
// stable with sparse data, and good enough to spot direction and rough
// magnitude - which is what this is for.
// ---------------------------------------------------------------------------

export interface ForecastPoint {
  month: string;
  actual: number | null;
  trend: number;
  movingAvg: number | null;
}

function linearRegression(ys: number[]): { slope: number; intercept: number } {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0 };
  const xs = ys.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function addMonths(monthKey: string, n: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function forecastRevenue(
  monthlyPnL: MonthlyPnL[],
  forecastMonths: number,
  metric: (m: MonthlyPnL) => number = (m) => m.totalRevenue
): ForecastPoint[] {
  if (monthlyPnL.length === 0) return [];

  const values = monthlyPnL.map(metric);
  const { slope, intercept } = linearRegression(values);

  const points: ForecastPoint[] = monthlyPnL.map((m, i) => {
    const windowStart = Math.max(0, i - 2);
    const windowVals = values.slice(windowStart, i + 1);
    const movingAvg = windowVals.reduce((a, b) => a + b, 0) / windowVals.length;
    return {
      month: m.month,
      actual: values[i],
      trend: intercept + slope * i,
      movingAvg,
    };
  });

  const lastMonth = monthlyPnL[monthlyPnL.length - 1].month;
  for (let i = 1; i <= forecastMonths; i++) {
    const idx = monthlyPnL.length - 1 + i;
    points.push({
      month: addMonths(lastMonth, i),
      actual: null,
      trend: intercept + slope * idx,
      movingAvg: null,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Dashboard summary helpers
// ---------------------------------------------------------------------------

export function currentInventoryValue(ledgers: Map<string, ProductLedgerResult>): number {
  let total = 0;
  for (const l of ledgers.values()) total += l.inventoryValue;
  return total;
}

export function currentInventoryUnits(ledgers: Map<string, ProductLedgerResult>): number {
  let total = 0;
  for (const l of ledgers.values()) total += Math.max(l.qtyOnHand, 0);
  return total;
}

// ---------------------------------------------------------------------------
// Economic Order Quantity (EOQ) — product-type offerings only. Services have
// no physical stock, so reorder planning doesn't apply to them.
//
// EOQ = sqrt(2 * D * S / H)
//   D = annual demand (units/year)
//   S = fixed cost to place one order
//   H = annual holding cost per unit (derived as holdingCostPct% of unit cost)
//
// Reorder point = average daily demand * lead time (days). When qty on hand
// falls at or below this, it's time to place the next order.
// ---------------------------------------------------------------------------

// Estimates annualized demand from actual sales history. Uses the trailing
// 90 days if there's enough history to be meaningful; otherwise annualizes
// whatever history exists (at least 1 day) so a brand-new product still gets
// a (rough) number instead of zero.
export function estimateAnnualDemand(sales: Sale[], productId: string, asOfISO: string): number {
  const productSales = sales.filter((s) => s.productId === productId);
  if (productSales.length === 0) return 0;

  const asOf = new Date(asOfISO + "T00:00:00Z").getTime();
  const ninetyDaysAgo = asOf - 90 * 24 * 60 * 60 * 1000;
  const recent = productSales.filter((s) => new Date(s.date + "T00:00:00Z").getTime() >= ninetyDaysAgo);

  const useRecent = recent.length > 0 ? recent : productSales;
  const dates = useRecent.map((s) => new Date(s.date + "T00:00:00Z").getTime());
  const spanDays = Math.max(1, (Math.max(...dates, asOf) - Math.min(...dates)) / (24 * 60 * 60 * 1000) + 1);
  const totalQty = useRecent.reduce((sum, s) => sum + s.qty, 0);

  return (totalQty / spanDays) * 365;
}

export interface EoqResult {
  annualDemand: number;
  orderingCost: number;
  holdingCostPerUnit: number;
  eoq: number;
  ordersPerYear: number;
  daysOfSupplyPerOrder: number;
  dailyDemand: number;
  reorderPoint: number;
  totalAnnualCost: number; // ordering + holding cost at EOQ (excludes purchase cost itself)
}

export function computeEOQ(
  product: Product,
  wac: number,
  annualDemand: number,
  settings: Settings
): EoqResult {
  const orderingCost = product.orderingCost ?? settings.defaultOrderingCost;
  const holdingCostPct = product.holdingCostPct ?? settings.defaultHoldingCostPct;
  const leadTimeDays = product.leadTimeDays ?? settings.defaultLeadTimeDays;
  const holdingCostPerUnit = (holdingCostPct / 100) * wac;

  const dailyDemand = annualDemand / 365;
  const reorderPoint = dailyDemand * leadTimeDays;

  if (annualDemand <= 0 || holdingCostPerUnit <= 0 || orderingCost <= 0) {
    return {
      annualDemand,
      orderingCost,
      holdingCostPerUnit,
      eoq: 0,
      ordersPerYear: 0,
      daysOfSupplyPerOrder: 0,
      dailyDemand,
      reorderPoint,
      totalAnnualCost: 0,
    };
  }

  const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCostPerUnit);
  const ordersPerYear = annualDemand / eoq;
  const totalAnnualCost = ordersPerYear * orderingCost + (eoq / 2) * holdingCostPerUnit;

  return {
    annualDemand,
    orderingCost,
    holdingCostPerUnit,
    eoq,
    ordersPerYear,
    daysOfSupplyPerOrder: eoq / Math.max(dailyDemand, 0.0001),
    dailyDemand,
    reorderPoint,
    totalAnnualCost,
  };
}

// ---------------------------------------------------------------------------
// Break-even & overhead coverage. Answers "are we actually profitable once
// overhead is accounted for" using a blended contribution margin ratio
// across everything sold (products and services together), applied to
// current fixed operating costs (the recurring + one-off expense run-rate).
// ---------------------------------------------------------------------------

export interface BreakEvenResult {
  contributionMarginRatio: number; // 0..1, blended across all sales in the period
  monthlyFixedCosts: number;
  breakEvenRevenue: number; // revenue needed per month to cover fixed costs
  actualRevenue: number;
  marginOfSafetyPct: number | null; // how far above break-even, as % of actual revenue
  overheadCoverageRatio: number | null; // gross profit / operating expenses; >1 = covering overhead
}

export function computeBreakEven(
  latestMonth: MonthlyPnL | undefined,
  trailingMonths: MonthlyPnL[]
): BreakEvenResult {
  // Blend contribution margin ratio over up to the last 3 months of actual
  // sales, so one unusually cheap/expensive month doesn't skew the picture.
  const window = trailingMonths.slice(-3);
  const revenue = window.reduce((s, m) => s + m.salesRevenue, 0);
  const variableCostTotal = window.reduce((s, m) => s + m.cogs + m.variableCosts, 0);
  const contributionMarginRatio = revenue > 0 ? (revenue - variableCostTotal) / revenue : 0;

  const monthlyFixedCosts = latestMonth?.operatingExpenses ?? 0;
  const breakEvenRevenue = contributionMarginRatio > 0 ? monthlyFixedCosts / contributionMarginRatio : Infinity;
  const actualRevenue = latestMonth?.totalRevenue ?? 0;

  const marginOfSafetyPct =
    actualRevenue > 0 && Number.isFinite(breakEvenRevenue)
      ? ((actualRevenue - breakEvenRevenue) / actualRevenue) * 100
      : null;

  const overheadCoverageRatio =
    latestMonth && monthlyFixedCosts > 0 ? latestMonth.grossProfit / monthlyFixedCosts : null;

  return {
    contributionMarginRatio,
    monthlyFixedCosts,
    breakEvenRevenue,
    actualRevenue,
    marginOfSafetyPct,
    overheadCoverageRatio,
  };
}

// ---------------------------------------------------------------------------
// Capital & ROI — initial investment, reinvestment, and withdrawals tracked
// separately from operating P&L, so payback and net cash position are visible
// alongside month-to-month profit.
// ---------------------------------------------------------------------------

export interface CapitalSummary {
  totalInvested: number; // investment + reinvestment
  totalWithdrawn: number;
  netCapitalIn: number; // totalInvested - totalWithdrawn
  cumulativeNetProfit: number; // sum of net profit after tax across all recorded months
  netPosition: number; // cumulativeNetProfit - netCapitalIn (>0 = paid back and ahead)
  paybackReached: boolean;
  roiPct: number | null; // cumulativeNetProfit / netCapitalIn * 100
}

export function computeCapitalSummary(
  capitalEntries: CapitalEntry[],
  monthlyPnL: MonthlyPnL[]
): CapitalSummary {
  let totalInvested = 0;
  let totalWithdrawn = 0;
  for (const c of capitalEntries) {
    if (c.kind === "investment" || c.kind === "reinvestment") totalInvested += c.amount;
    else totalWithdrawn += c.amount;
  }
  const netCapitalIn = totalInvested - totalWithdrawn;
  const cumulativeNetProfit = monthlyPnL.reduce((s, m) => s + m.netProfitAfterTax, 0);
  const netPosition = cumulativeNetProfit - netCapitalIn;

  return {
    totalInvested,
    totalWithdrawn,
    netCapitalIn,
    cumulativeNetProfit,
    netPosition,
    paybackReached: netCapitalIn <= 0 || cumulativeNetProfit >= netCapitalIn,
    roiPct: netCapitalIn > 0 ? (cumulativeNetProfit / netCapitalIn) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Wholesale orders in flight — quantity ordered but not yet received, per
// product. Cancelled and already-received orders don't count. This is what
// makes "on order" visible separately from "on hand" (which only reflects
// stock that has actually arrived, via Purchases/the WAC ledger).
// ---------------------------------------------------------------------------

export function computeOnOrderByProduct(purchaseOrders: PurchaseOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const po of purchaseOrders) {
    if (po.status !== "ordered" && po.status !== "in_transit") continue;
    map.set(po.productId, (map.get(po.productId) ?? 0) + po.qtyOrdered);
  }
  return map;
}

export interface OpenOrderValue {
  openOrderCount: number;
  openOrderUnits: number;
  openOrderValue: number; // committed spend on orders not yet received
}

export function computeOpenOrderValue(purchaseOrders: PurchaseOrder[]): OpenOrderValue {
  let openOrderCount = 0;
  let openOrderUnits = 0;
  let openOrderValue = 0;
  for (const po of purchaseOrders) {
    if (po.status !== "ordered" && po.status !== "in_transit") continue;
    openOrderCount += 1;
    openOrderUnits += po.qtyOrdered;
    openOrderValue += po.qtyOrdered * po.unitCost;
  }
  return { openOrderCount, openOrderUnits, openOrderValue };
}

// ---------------------------------------------------------------------------
// Employees / payroll. The actual cost to the business (gross pay) is booked
// as a normal recurring Expense (see DataContext), so it already flows
// through computeMRR / computeMonthlyPnL / expenseTotalsForMonth untouched.
// This just adds the employee-facing view: estimated take-home after their
// personal tax %, and a total monthly payroll run-rate for active staff.
// ---------------------------------------------------------------------------

export function estimateNetPay(payRate: number, taxPct: number): number {
  return payRate * (1 - taxPct / 100);
}

export function monthlyPayrollCost(employees: Employee[]): number {
  let total = 0;
  for (const e of employees) {
    if (!e.active) continue;
    total += monthlyNormalizedAmount(e.payRate, e.payFrequency);
  }
  return total;
}

// ---------------------------------------------------------------------------
// Loans / debt amortization. Standard fixed-payment monthly amortizing loan
// (the common shape for an SME bank/working-capital loan). First payment
// falls one month after startDate (the disbursement date).
//
// payment = P * r(1+r)^n / ((1+r)^n - 1), r = monthly rate, n = termMonths.
// Falls back to a straight-line split (P/n, no interest) when rate is 0.
// ---------------------------------------------------------------------------

function addMonthsIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const daysInTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, daysInTargetMonth);
  target.setUTCDate(day);
  return target.toISOString().slice(0, 10);
}

export interface LoanPayment {
  periodIndex: number; // 1-based
  date: string; // ISO date
  monthKey: string; // "YYYY-MM"
  payment: number;
  principal: number;
  interest: number;
  balance: number; // remaining balance after this payment
}

export function computeLoanSchedule(loan: Loan): LoanPayment[] {
  const n = Math.max(0, Math.round(loan.termMonths));
  if (n === 0 || loan.principal <= 0) return [];
  const r = loan.annualInterestRatePct / 100 / 12;

  const payment =
    r === 0
      ? loan.principal / n
      : (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const schedule: LoanPayment[] = [];
  let balance = loan.principal;
  for (let i = 1; i <= n; i++) {
    const interest = balance * r;
    let principal = payment - interest;
    if (i === n || principal > balance) principal = balance; // clear rounding drift on the final payment
    balance = Math.max(0, balance - principal);
    const date = addMonthsIso(loan.startDate, i);
    schedule.push({
      periodIndex: i,
      date,
      monthKey: date.slice(0, 7),
      payment: principal + interest,
      principal,
      interest,
      balance,
    });
  }
  return schedule;
}

export interface LoanSummary {
  monthlyPayment: number;
  totalInterest: number;
  totalPayments: number;
  payoffDate: string | null;
  currentBalance: number;
  principalPaidToDate: number;
  interestPaidToDate: number;
  percentPaid: number; // 0..100, by principal
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
}

export function computeLoanSummary(loan: Loan, asOfISO: string): LoanSummary {
  const schedule = computeLoanSchedule(loan);
  const monthlyPayment = schedule[0]?.payment ?? 0;
  const totalInterest = schedule.reduce((s, p) => s + p.interest, 0);
  const past = schedule.filter((p) => p.date <= asOfISO);
  const future = schedule.filter((p) => p.date > asOfISO);
  const principalPaidToDate = past.reduce((s, p) => s + p.principal, 0);
  const interestPaidToDate = past.reduce((s, p) => s + p.interest, 0);
  const currentBalance = past.length > 0 ? past[past.length - 1].balance : loan.principal;

  return {
    monthlyPayment,
    totalInterest,
    totalPayments: schedule.length,
    payoffDate: schedule.length > 0 ? schedule[schedule.length - 1].date : null,
    currentBalance,
    principalPaidToDate,
    interestPaidToDate,
    percentPaid: loan.principal > 0 ? (principalPaidToDate / loan.principal) * 100 : 0,
    nextPaymentDate: future[0]?.date ?? null,
    nextPaymentAmount: future[0]?.payment ?? null,
  };
}

export interface LoanMonthlyTotals {
  interest: number;
  principal: number;
  proceeds: number; // cash borrowed, booked in the disbursement month
  payment: number;
}

// Aggregates every loan's schedule (plus its disbursement) into per-month
// totals across the whole portfolio — this is what feeds interest expense
// into the Income Statement and principal/proceeds into the Cash Flow
// Statement, month by month.
export function computeLoanMonthlyTotals(loans: Loan[]): Map<string, LoanMonthlyTotals> {
  const map = new Map<string, LoanMonthlyTotals>();
  const bump = (key: string, delta: Partial<LoanMonthlyTotals>) => {
    const cur = map.get(key) ?? { interest: 0, principal: 0, proceeds: 0, payment: 0 };
    map.set(key, {
      interest: cur.interest + (delta.interest ?? 0),
      principal: cur.principal + (delta.principal ?? 0),
      proceeds: cur.proceeds + (delta.proceeds ?? 0),
      payment: cur.payment + (delta.payment ?? 0),
    });
  };
  for (const loan of loans) {
    bump(loan.startDate.slice(0, 7), { proceeds: loan.principal });
    for (const p of computeLoanSchedule(loan)) {
      bump(p.monthKey, { interest: p.interest, principal: p.principal, payment: p.payment });
    }
  }
  return map;
}

export interface LoanPortfolioSummary {
  loanCount: number;
  totalOutstanding: number; // sum of current balances, active loans only
  totalMonthlyPayment: number; // sum of monthly payment for loans not yet paid off
  totalPrincipalPaidToDate: number;
  totalInterestPaidToDate: number;
  totalOriginalPrincipal: number;
}

export function computeLoanPortfolio(loans: Loan[], asOfISO: string): LoanPortfolioSummary {
  let totalOutstanding = 0;
  let totalMonthlyPayment = 0;
  let totalPrincipalPaidToDate = 0;
  let totalInterestPaidToDate = 0;
  let totalOriginalPrincipal = 0;

  for (const loan of loans) {
    if (!loan.active) continue;
    const summary = computeLoanSummary(loan, asOfISO);
    totalOutstanding += summary.currentBalance;
    if (summary.currentBalance > 0) totalMonthlyPayment += summary.monthlyPayment;
    totalPrincipalPaidToDate += summary.principalPaidToDate;
    totalInterestPaidToDate += summary.interestPaidToDate;
    totalOriginalPrincipal += loan.principal;
  }

  return {
    loanCount: loans.filter((l) => l.active).length,
    totalOutstanding,
    totalMonthlyPayment,
    totalPrincipalPaidToDate,
    totalInterestPaidToDate,
    totalOriginalPrincipal,
  };
}

// ---------------------------------------------------------------------------
// Item-level (per-product/service) profitability. Aggregates sale economics
// by product over an optional date range: units sold, revenue, cost behavior
// (COGS driven by what was actually paid to the supplier per WAC, vs. the
// selling price), gross/contribution margin, and what's still tied up as
// inventory. This is the "is THIS item actually worth selling" view, as
// opposed to the business-wide P&L.
// ---------------------------------------------------------------------------

export interface ProductProfitability {
  productId: string;
  name: string;
  sku: string;
  type: OfferingType;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number | null; // null when no revenue in range
  avgSellingPrice: number;
  avgUnitCost: number;
  variableCost: number;
  contributionMargin: number;
  contributionMarginPct: number | null;
  qtyOnHand: number;
  inventoryValue: number;
  wac: number;
  // A rough pricing-power signal, not a rigorous market-structure model:
  // thin margins tend to mean a commoditized/price-competitive item (many
  // substitutes, buyers price-shop), fat margins tend to mean real
  // differentiation or low buyer price-sensitivity. Useful as a prompt to
  // ask "why", not a verdict.
  marginBand: "thin" | "moderate" | "healthy" | "strong" | "n/a";
  // Fully-loaded view: COGS plus the labor that went into delivering each
  // unit (Product.laborCostPerUnit), for offerings — usually services —
  // where the person doing the work is an employee whose pay already sits
  // in operating expenses rather than in a logged Purchase. Without this,
  // a service's COGS-only margin can look much better than it really is.
  laborCost: number;
  fullyLoadedCost: number; // avgUnitCost + laborCostPerUnit
  fullyLoadedGrossProfit: number; // grossProfit - laborCost
  fullyLoadedMarginPct: number | null;
}

export function computeProductProfitability(
  products: Product[],
  sales: Sale[],
  saleEconomics: SaleEconomics[],
  ledgers: Map<string, ProductLedgerResult>,
  dateFrom?: string,
  dateTo?: string
): ProductProfitability[] {
  const economicsBySaleId = new Map(saleEconomics.map((e) => [e.saleId, e]));
  const inRange = (d: string) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);

  return products.map((p) => {
    const productSales = sales.filter((s) => s.productId === p.id && inRange(s.date));
    let revenue = 0;
    let cogs = 0;
    let variableCost = 0;
    let unitsSold = 0;
    for (const s of productSales) {
      const econ = economicsBySaleId.get(s.id);
      revenue += econ?.revenue ?? 0;
      cogs += econ?.cogs ?? 0;
      variableCost += econ?.variableCost ?? 0;
      unitsSold += s.qty;
    }
    const grossProfit = revenue - cogs;
    const contributionMargin = grossProfit - variableCost;
    const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : null;

    let marginBand: ProductProfitability["marginBand"] = "n/a";
    if (grossMarginPct !== null) {
      if (grossMarginPct < 10) marginBand = "thin";
      else if (grossMarginPct < 25) marginBand = "moderate";
      else if (grossMarginPct < 45) marginBand = "healthy";
      else marginBand = "strong";
    }

    const ledger = ledgers.get(p.id);
    const laborCost = (p.laborCostPerUnit ?? 0) * unitsSold;
    const fullyLoadedCost = (unitsSold > 0 ? cogs / unitsSold : ledger?.wac ?? 0) + (p.laborCostPerUnit ?? 0);
    const fullyLoadedGrossProfit = grossProfit - laborCost;
    const fullyLoadedMarginPct = revenue > 0 ? (fullyLoadedGrossProfit / revenue) * 100 : null;

    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      type: p.type,
      unitsSold,
      revenue,
      cogs,
      grossProfit,
      grossMarginPct,
      avgSellingPrice: unitsSold > 0 ? revenue / unitsSold : 0,
      avgUnitCost: unitsSold > 0 ? cogs / unitsSold : ledger?.wac ?? 0,
      variableCost,
      contributionMargin,
      contributionMarginPct: revenue > 0 ? (contributionMargin / revenue) * 100 : null,
      qtyOnHand: ledger?.qtyOnHand ?? 0,
      inventoryValue: ledger?.inventoryValue ?? 0,
      wac: ledger?.wac ?? 0,
      marginBand,
      laborCost,
      fullyLoadedCost,
      fullyLoadedGrossProfit,
      fullyLoadedMarginPct,
    };
  });
}

// ---------------------------------------------------------------------------
// Balance Sheet, as of a given date (defaults to today — this build doesn't
// reconstruct historical inventory/cash snapshots for a past date, since
// that needs full point-in-time WAC replay; "as of today" is what an SME
// actually checks day to day).
//
// Cash is derived, not stored: it's the cumulative net cash flow (operating
// + financing) across every month up to `asOf`, using the same cash-basis
// fields computeMonthlyPnL already produces. This keeps Assets = Liabilities
// + Equity true by construction — nothing here is separately hand-entered.
// ---------------------------------------------------------------------------

export interface BalanceSheet {
  asOf: string;
  cash: number;
  inventoryValue: number;
  accountsReceivable: number; // money owed to you by customers
  fixedAssetsNet: number; // cost less accumulated depreciation, across all held assets
  totalAssets: number;
  loansPayable: number;
  accountsPayable: number; // money you owe suppliers
  totalLiabilities: number;
  ownersCapital: number; // net capital contributed (investment + reinvestment - withdrawals)
  retainedEarnings: number; // cumulative net profit after tax, all time
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balances: boolean; // sanity check — should always be true within rounding
}

// ---------------------------------------------------------------------------
// Strategic business metrics for better decision-making
// ---------------------------------------------------------------------------

export interface GrowthRates {
  momRevenuePct: number | null; // month-over-month revenue growth %
  yoyRevenuePct: number | null; // year-over-year revenue growth %
  momProfitPct: number | null; // month-over-month profit growth %
  yoyProfitPct: number | null; // year-over-year profit growth %
  trendDirection: "up" | "down" | "flat" | "insufficient-data";
}

export function computeGrowthRates(monthlyPnL: MonthlyPnL[]): GrowthRates {
  if (monthlyPnL.length < 2) {
    return {
      momRevenuePct: null,
      yoyRevenuePct: null,
      momProfitPct: null,
      yoyProfitPct: null,
      trendDirection: "insufficient-data",
    };
  }

  const current = monthlyPnL[monthlyPnL.length - 1];
  const previous = monthlyPnL[monthlyPnL.length - 2];
  const yearAgo = monthlyPnL.find((pnl) => {
    const [y, m] = pnl.month.split("-").map(Number);
    const [cy, cm] = current.month.split("-").map(Number);
    return y === cy - 1 && m === cm;
  });

  const momRevenuePct =
    previous.totalRevenue > 0 ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100 : null;
  const momProfitPct =
    previous.netProfitAfterTax > 0
      ? ((current.netProfitAfterTax - previous.netProfitAfterTax) / previous.netProfitAfterTax) * 100
      : null;

  const yoyRevenuePct =
    yearAgo && yearAgo.totalRevenue > 0
      ? ((current.totalRevenue - yearAgo.totalRevenue) / yearAgo.totalRevenue) * 100
      : null;
  const yoyProfitPct =
    yearAgo && yearAgo.netProfitAfterTax > 0
      ? ((current.netProfitAfterTax - yearAgo.netProfitAfterTax) / yearAgo.netProfitAfterTax) * 100
      : null;

  let trendDirection: GrowthRates["trendDirection"] = "flat";
  if (momRevenuePct !== null) {
    if (momRevenuePct > 2) trendDirection = "up";
    else if (momRevenuePct < -2) trendDirection = "down";
  }

  return {
    momRevenuePct,
    yoyRevenuePct,
    momProfitPct,
    yoyProfitPct,
    trendDirection,
  };
}

export interface OperationalMetrics {
  averageOrderValue: number; // revenue / number of sales
  revenuePerEmployee: number | null; // revenue / active employee count
  inventoryTurnoverRate: number | null; // COGS / average inventory value
  daysOfInventoryOnHand: number | null; // 365 / turnover rate
  cashRunwayMonths: number | null; // cash / monthly burn rate
  monthlyBurnRate: number; // average monthly cash outflow (last 3 months)
}

export function computeOperationalMetrics(
  monthlyPnL: MonthlyPnL[],
  sales: Sale[],
  inventoryValue: number,
  activeEmployeeCount: number,
  cash: number
): OperationalMetrics {
  // Average Order Value (AOV)
  const currentMonthSales = sales.filter((s) => s.date.startsWith(monthlyPnL[monthlyPnL.length - 1]?.month ?? ""));
  const aov = currentMonthSales.length > 0
    ? currentMonthSales.reduce((sum, s) => sum + s.unitPrice * s.qty, 0) / currentMonthSales.length
    : 0;

  // Revenue per Employee
  const currentRevenue = monthlyPnL[monthlyPnL.length - 1]?.totalRevenue ?? 0;
  const revenuePerEmployee = activeEmployeeCount > 0 ? currentRevenue / activeEmployeeCount : null;

  // Inventory Turnover Rate = COGS / Average Inventory Value
  // Using current month COGS and current inventory value as approximation
  const currentCogs = monthlyPnL[monthlyPnL.length - 1]?.cogs ?? 0;
  const inventoryTurnoverRate = inventoryValue > 0 ? currentCogs / inventoryValue : null;

  // Days of Inventory on Hand = 365 / Turnover Rate
  const daysOfInventoryOnHand =
    inventoryTurnoverRate && inventoryTurnoverRate > 0 ? 365 / inventoryTurnoverRate : null;

  // Cash Runway = Cash / Monthly Burn Rate
  // Burn rate = average monthly cash outflow (last 3 months)
  const last3Months = monthlyPnL.slice(-3);
  const monthlyBurnRate =
    last3Months.length > 0
      ? last3Months.reduce((sum, m) => sum + Math.abs(Math.min(0, m.netCashFlow)), 0) / last3Months.length
      : 0;
  const cashRunwayMonths = monthlyBurnRate > 0 ? cash / monthlyBurnRate : null;

  return {
    averageOrderValue: aov,
    revenuePerEmployee,
    inventoryTurnoverRate,
    daysOfInventoryOnHand,
    cashRunwayMonths,
    monthlyBurnRate,
  };
}

export function computeBalanceSheet(
  monthlyPnL: MonthlyPnL[],
  inventoryValue: number,
  loans: Loan[],
  capitalSummary: CapitalSummary,
  asOfISO: string,
  sales: Sale[] = [],
  purchases: Purchase[] = [],
  fixedAssets: FixedAsset[] = []
): BalanceSheet {
  const toDate = monthlyPnL.filter((m) => m.month <= asOfISO.slice(0, 7));
  const cash = toDate.reduce((s, m) => s + m.netCashFlow, 0);
  const retainedEarnings = toDate.reduce((s, m) => s + m.netProfitAfterTax, 0);

  const loansPayable = loans
    .filter((l) => l.active)
    .reduce((s, l) => s + computeLoanSummary(l, asOfISO).currentBalance, 0);

  const accountsReceivable = computeReceivables(sales, asOfISO).totalOutstanding;
  const accountsPayable = computePayables(purchases, asOfISO).totalOutstanding;
  const fixedAssetsNet = computeFixedAssetsNetValue(fixedAssets, asOfISO);

  const totalAssets = cash + inventoryValue + accountsReceivable + fixedAssetsNet;
  const totalLiabilities = loansPayable + accountsPayable;
  const ownersCapital = capitalSummary.netCapitalIn;
  const totalEquity = ownersCapital + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    asOf: asOfISO,
    cash,
    inventoryValue,
    accountsReceivable,
    fixedAssetsNet,
    totalAssets,
    loansPayable,
    accountsPayable,
    totalLiabilities,
    ownersCapital,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    balances: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
  };
}

// ---------------------------------------------------------------------------
// Project-specific P&L calculations
// ---------------------------------------------------------------------------

export function computeProjectPnL(
  projectId: string,
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[],
  products: Product[],
  variableCosts: VariableCost[],
  loans: Loan[],
  capitalEntries: CapitalEntry[],
  settings: Settings
): MonthlyPnL[] {
  // Filter data by project
  const projectSales = sales.filter((s) => s.projectId === projectId);
  const projectPurchases = purchases.filter((p) => p.projectId === projectId);
  const projectExpenses = expenses.filter((e) => e.projectId === projectId);

  // Compute ledgers for project purchases
  const projectLedgers = computeAllLedgers(products, projectPurchases, projectSales);

  // Compute sale economics for project sales
  const projectSaleEconomics = computeSaleEconomics(projectSales, projectLedgers, variableCosts);

  // Use existing monthly PnL computation with project-filtered data
  // Note: loans and capitalEntries are not project-specific, so we pass all of them
  return computeMonthlyPnL(
    projectSales,
    projectSaleEconomics,
    projectExpenses,
    projectPurchases,
    loans,
    capitalEntries,
    settings.taxRatePct,
    settings.monthlyOwnerDraw
  );
}

// ---------------------------------------------------------------------------
// Financial ratios — the standard set a bank, investor, or accountant asks
// for (profitability beyond net margin, returns, liquidity, leverage). All
// derived from data already tracked elsewhere (monthlyPnL, the Balance
// Sheet, loan schedules) — nothing new to enter.
//
// Everything here is computed over a trailing window (default 12 months, or
// however much history exists) rather than a single month, since ratios
// like ROE/ROA/interest coverage are conventionally annualized — a single
// month is too noisy and not what a lender would ask to see.
// ---------------------------------------------------------------------------

export interface FinancialRatios {
  windowMonths: number; // how many months of history this is actually based on
  revenue: number;
  ebit: number; // operating profit: gross profit − opex − depreciation (excludes interest, tax, disposal gains)
  ebitda: number; // ebit + depreciation added back
  operatingMarginPct: number | null; // ebit / revenue
  ebitdaMarginPct: number | null;
  netProfit: number;
  returnOnSalesPct: number | null; // net profit / revenue
  freeCashFlow: number; // operating cash flow − capex
  roePct: number | null; // net profit / shareholders' equity
  roaPct: number | null; // net profit / total assets
  rocePct: number | null; // ebit / capital employed (equity + net debt)
  currentRatio: number | null; // (cash + AR + inventory) / current liabilities
  quickRatio: number | null; // (cash + AR) / current liabilities
  netDebt: number; // total loan balance − cash (negative = net cash position)
  interestCoverage: number | null; // ebit / interest expense
  debtServiceCoveragePct: number | null; // ebitda / (interest + principal due), as a ratio (>1 = covers it)
}

// Principal due within the next 12 months, across active loans — the
// "current portion of long-term debt" a real balance sheet would split out.
function currentPortionOfDebt(loans: Loan[], asOfISO: string): number {
  const cutoffKey = addMonthsToKey(asOfISO.slice(0, 7), 12);
  let total = 0;
  for (const loan of loans) {
    if (!loan.active) continue;
    for (const p of computeLoanSchedule(loan)) {
      if (p.date > asOfISO && p.monthKey <= cutoffKey) total += p.principal;
    }
  }
  return total;
}

export function computeFinancialRatios(
  monthlyPnL: MonthlyPnL[],
  balanceSheet: BalanceSheet,
  loans: Loan[],
  asOfISO: string,
  windowMonths = 12
): FinancialRatios {
  const toDate = monthlyPnL.filter((m) => m.month <= asOfISO.slice(0, 7));
  const window = toDate.slice(-windowMonths);

  const revenue = window.reduce((s, m) => s + m.totalRevenue, 0);
  const grossProfit = window.reduce((s, m) => s + m.grossProfit, 0);
  const operatingExpenses = window.reduce((s, m) => s + m.operatingExpenses, 0);
  const depreciation = window.reduce((s, m) => s + m.depreciationExpense, 0);
  const interestExpense = window.reduce((s, m) => s + m.interestExpense, 0);
  const netProfit = window.reduce((s, m) => s + m.netProfitAfterTax, 0);
  const operatingCashFlow = window.reduce((s, m) => s + m.operatingCashFlow, 0);
  const capex = window.reduce((s, m) => s + m.assetPurchaseCash, 0);
  const principalRepayment = window.reduce((s, m) => s + m.principalRepayment, 0);

  const ebit = grossProfit - operatingExpenses - depreciation;
  const ebitda = ebit + depreciation;
  const freeCashFlow = operatingCashFlow - capex;

  const netDebt = balanceSheet.loansPayable - balanceSheet.cash;
  const capitalEmployed = balanceSheet.totalEquity + netDebt;

  const currentLiabilities = balanceSheet.accountsPayable + currentPortionOfDebt(loans, asOfISO);
  const currentAssets = balanceSheet.cash + balanceSheet.accountsReceivable + balanceSheet.inventoryValue;

  const debtService = interestExpense + principalRepayment;

  return {
    windowMonths: window.length,
    revenue,
    ebit,
    ebitda,
    operatingMarginPct: revenue > 0 ? (ebit / revenue) * 100 : null,
    ebitdaMarginPct: revenue > 0 ? (ebitda / revenue) * 100 : null,
    netProfit,
    returnOnSalesPct: revenue > 0 ? (netProfit / revenue) * 100 : null,
    freeCashFlow,
    // ROE with negative equity is a classic trap: a lossmaking business with
    // negative equity divides two negatives into a large *positive*
    // percentage — which looks like an exceptional return but actually
    // signals insolvency on a book-equity basis. Suppressing it here (rather
    // than showing a misleadingly attractive number) is standard practice.
    roePct: balanceSheet.totalEquity > 0 ? (netProfit / balanceSheet.totalEquity) * 100 : null,
    roaPct: balanceSheet.totalAssets > 0 ? (netProfit / balanceSheet.totalAssets) * 100 : null,
    rocePct: capitalEmployed > 0 ? (ebit / capitalEmployed) * 100 : null,
    currentRatio: currentLiabilities > 0 ? currentAssets / currentLiabilities : null,
    quickRatio: currentLiabilities > 0 ? (currentAssets - balanceSheet.inventoryValue) / currentLiabilities : null,
    netDebt,
    interestCoverage: interestExpense > 0 ? ebit / interestExpense : null,
    debtServiceCoveragePct: debtService > 0 ? (ebitda / debtService) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Customer acquisition cost & customer value — the two "essential KPIs"
// that need grouping sales by customer name rather than reading straight off
// a single table. `customer` is free text, not a structured entity, so
// matching is by trimmed, case-insensitive name; blank/anonymous sales are
// excluded (there's no name to group them by).
// ---------------------------------------------------------------------------

export interface CustomerMetrics {
  newCustomersThisMonth: number;
  marketingSpendThisMonth: number;
  cac: number | null; // marketing spend this month / new customers acquired this month
  distinctCustomerCount: number; // all-time, named customers only
  averageCustomerValue: number; // all-time revenue / distinct named customers
  topCustomers: { name: string; revenue: number; orders: number }[];
}

function marketingSpendForMonth(expenses: Expense[], monthKeyStr: string): number {
  const monthStart = `${monthKeyStr}-01`;
  const [y, m] = monthKeyStr.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  let total = 0;
  for (const e of expenses) {
    if (e.kind !== "expense" || e.category !== "Marketing") continue;
    if (e.isRecurring) {
      const started = e.startDate < nextMonth;
      const notEnded = !e.endDate || e.endDate >= monthStart;
      if (started && notEnded) total += monthlyNormalizedAmount(e.amount, e.recurrence);
    } else if (e.startDate >= monthStart && e.startDate < nextMonth) {
      total += e.amount;
    }
  }
  return total;
}

export function computeCustomerMetrics(sales: Sale[], expenses: Expense[], monthKeyStr: string): CustomerMetrics {
  const byCustomer = new Map<string, { firstMonth: string; revenue: number; orders: number }>();
  for (const s of sales) {
    const name = (s.customer ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const revenue = s.unitPrice * s.qty;
    const existing = byCustomer.get(key);
    const saleMonth = monthKey(s.date);
    if (!existing) {
      byCustomer.set(key, { firstMonth: saleMonth, revenue, orders: 1 });
    } else {
      existing.revenue += revenue;
      existing.orders += 1;
      if (saleMonth < existing.firstMonth) existing.firstMonth = saleMonth;
    }
  }

  const customers = Array.from(byCustomer.values());
  const newCustomersThisMonth = customers.filter((c) => c.firstMonth === monthKeyStr).length;
  const marketingSpendThisMonth = marketingSpendForMonth(expenses, monthKeyStr);

  const distinctCustomerCount = customers.length;
  const totalRevenue = customers.reduce((s, c) => s + c.revenue, 0);

  // Top customers by revenue, with original-cased names (byCustomer is keyed
  // lowercase for matching, so recover the display name separately).
  const nameByKey = new Map<string, string>();
  for (const s of sales) {
    const name = (s.customer ?? "").trim();
    if (!name) continue;
    nameByKey.set(name.toLowerCase(), name);
  }
  const topCustomersNamed = Array.from(byCustomer.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([key, v]) => ({ name: nameByKey.get(key) ?? key, revenue: v.revenue, orders: v.orders }));

  return {
    newCustomersThisMonth,
    marketingSpendThisMonth,
    cac: newCustomersThisMonth > 0 ? marketingSpendThisMonth / newCustomersThisMonth : null,
    distinctCustomerCount,
    averageCustomerValue: distinctCustomerCount > 0 ? totalRevenue / distinctCustomerCount : 0,
    topCustomers: topCustomersNamed,
  };
}
