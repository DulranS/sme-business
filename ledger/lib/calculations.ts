import type {
  CapitalEntry,
  Employee,
  Expense,
  Loan,
  OfferingType,
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
  // Cash-basis fields, for the Cash Flow Statement / Balance Sheet. These
  // differ from the accrual fields above in one key way: inventory purchases
  // hit cash when bought, not when the stock is later sold (COGS timing).
  purchaseCash: number; // cash paid for inventory this month (at cost)
  loanProceeds: number; // new loan cash received this month
  principalRepayment: number; // loan principal repaid this month
  capitalIn: number; // owner investment/reinvestment this month
  capitalOut: number; // owner withdrawals this month
  operatingCashFlow: number;
  financingCashFlow: number;
  netCashFlow: number; // operating + financing (no investing activity tracked yet)
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
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
  monthlyOwnerDraw = 0
): MonthlyPnL[] {
  const economicsBySaleId = new Map(saleEconomics.map((e) => [e.saleId, e]));
  const loanMonthlyTotals = computeLoanMonthlyTotals(loans);

  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const candidateKeys: string[] = [nowKey];
  for (const s of sales) candidateKeys.push(monthKey(s.date));
  for (const p of purchases) candidateKeys.push(monthKey(p.date));
  for (const e of expenses) candidateKeys.push(monthKey(e.startDate));
  for (const c of capitalEntries) candidateKeys.push(monthKey(c.date));
  for (const key of loanMonthlyTotals.keys()) candidateKeys.push(key);

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

    const netProfitPreTax = grossProfit - expenseTotal - interestExpense;
    const tax = Math.max(netProfitPreTax, 0) * (taxRatePct / 100);
    const netProfitAfterTax = netProfitPreTax - tax;
    const economicProfit = netProfitAfterTax - monthlyOwnerDraw;

    const purchaseCash = purchases
      .filter((p) => monthKey(p.date) === month)
      .reduce((sum, p) => sum + p.qty * p.unitCost, 0);

    const monthCapital = capitalEntries.filter((c) => monthKey(c.date) === month);
    const capitalIn = monthCapital
      .filter((c) => c.kind === "investment" || c.kind === "reinvestment")
      .reduce((s, c) => s + c.amount, 0);
    const capitalOut = monthCapital
      .filter((c) => c.kind === "withdrawal")
      .reduce((s, c) => s + c.amount, 0);

    const operatingCashFlow =
      salesRevenue + recurringRevenueTotal - purchaseCash - variableCosts - expenseTotal - interestExpense - tax;
    const financingCashFlow = loanProceeds - principalRepayment + capitalIn - capitalOut;

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
      purchaseCash,
      loanProceeds,
      principalRepayment,
      capitalIn,
      capitalOut,
      operatingCashFlow,
      financingCashFlow,
      netCashFlow: operatingCashFlow + financingCashFlow,
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
  totalAssets: number;
  loansPayable: number;
  totalLiabilities: number;
  ownersCapital: number; // net capital contributed (investment + reinvestment - withdrawals)
  retainedEarnings: number; // cumulative net profit after tax, all time
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balances: boolean; // sanity check — should always be true within rounding
}

export function computeBalanceSheet(
  monthlyPnL: MonthlyPnL[],
  inventoryValue: number,
  loans: Loan[],
  capitalSummary: CapitalSummary,
  asOfISO: string
): BalanceSheet {
  const toDate = monthlyPnL.filter((m) => m.month <= asOfISO.slice(0, 7));
  const cash = toDate.reduce((s, m) => s + m.netCashFlow, 0);
  const retainedEarnings = toDate.reduce((s, m) => s + m.netProfitAfterTax, 0);

  const loansPayable = loans
    .filter((l) => l.active)
    .reduce((s, l) => s + computeLoanSummary(l, asOfISO).currentBalance, 0);

  const totalAssets = cash + inventoryValue;
  const totalLiabilities = loansPayable;
  const ownersCapital = capitalSummary.netCapitalIn;
  const totalEquity = ownersCapital + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    asOf: asOfISO,
    cash,
    inventoryValue,
    totalAssets,
    loansPayable,
    totalLiabilities,
    ownersCapital,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    balances: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
  };
}
