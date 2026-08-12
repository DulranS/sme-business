import type { CapitalEntry, Expense, Product, Purchase, Recurrence, Sale, Settings, VariableCost } from "./types";

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
  operatingExpenses: number;
  netProfitPreTax: number;
  tax: number;
  netProfitAfterTax: number;
  unitsSold: number;
}

export function computeMonthlyPnL(
  sales: Sale[],
  saleEconomics: SaleEconomics[],
  expenses: Expense[],
  taxRatePct: number
): MonthlyPnL[] {
  const economicsBySaleId = new Map(saleEconomics.map((e) => [e.saleId, e]));
  const monthKeys = new Set<string>();

  for (const s of sales) monthKeys.add(s.date.slice(0, 7));
  for (const e of expenses) {
    monthKeys.add(e.startDate.slice(0, 7));
    if (e.isRecurring) {
      // ensure months up to "now" show recurring items even with no sales that month
      const now = new Date();
      const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      monthKeys.add(curKey);
    }
  }

  const months = Array.from(monthKeys).sort();
  const result: MonthlyPnL[] = [];

  for (const month of months) {
    const monthSales = sales.filter((s) => s.date.slice(0, 7) === month);
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
    const netProfitPreTax = grossProfit - expenseTotal;
    const tax = Math.max(netProfitPreTax, 0) * (taxRatePct / 100);
    const netProfitAfterTax = netProfitPreTax - tax;

    result.push({
      month,
      salesRevenue,
      recurringRevenue: recurringRevenueTotal,
      totalRevenue,
      cogs,
      variableCosts,
      grossProfit,
      operatingExpenses: expenseTotal,
      netProfitPreTax,
      tax,
      netProfitAfterTax,
      unitsSold,
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
