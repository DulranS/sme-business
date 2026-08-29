import type {
  CapitalEntry,
  Employee,
  Expense,
  FixedAsset,
  Loan,
  OfferingType,
  Product,
  Project,
  ProjectCostSegment,
  ProjectMilestone,
  ProjectStatus,
  Purchase,
  PurchaseOrder,
  Recurrence,
  ReceivablePayment,
  PayablePayment,
  Sale,
  Settings,
  TimeEntry,
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

function sumVariableCosts(sale: Sale, costs: VariableCost[]): number {
  let total = 0;
  for (const vc of costs) {
    if (vc.type === "per_unit") {
      total += vc.amount * sale.qty;
    } else {
      total += (vc.amount / 100) * sale.unitPrice * sale.qty;
    }
  }
  return total;
}

export function variableCostForSale(
  sale: Sale,
  variableCosts: VariableCost[]
): number {
  const applicable = variableCosts.filter(
    (vc) => !vc.productId || vc.productId === sale.productId
  );
  return sumVariableCosts(sale, applicable);
}

export interface SaleEconomics {
  saleId: string;
  revenue: number;
  cogs: number; // WAC-based inventory cost only
  // The slice of variableCost tagged VariableCost.includeInCogs=true (e.g.
  // outbound shipping) — counted toward Gross Profit, not just Contribution
  // Margin. Zero for every sale as long as no variable cost is tagged that
  // way, which is exactly today's behavior for all pre-existing data.
  cogsVariableCost: number;
  variableCost: number; // ALL applicable variable costs, tagged or not
  grossProfit: number; // revenue - cogs - cogsVariableCost (true Gross Margin)
  contributionMargin: number; // grossProfit - (variableCost - cogsVariableCost) === revenue - cogs - variableCost
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
    const applicable = variableCosts.filter(
      (vc) => !vc.productId || vc.productId === sale.productId
    );
    const varCost = sumVariableCosts(sale, applicable);
    const cogsVarCost = sumVariableCosts(sale, applicable.filter((vc) => vc.includeInCogs));
    const grossProfit = revenue - cogs - cogsVarCost;
    const contributionMargin = grossProfit - (varCost - cogsVarCost);
    return {
      saleId: sale.id,
      revenue,
      cogs,
      cogsVariableCost: cogsVarCost,
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
  // Portion of variableCosts tagged VariableCost.includeInCogs=true (e.g.
  // outbound shipping) — counted toward Gross Profit below, not just
  // Contribution Margin. Zero unless a variable cost is explicitly tagged
  // that way.
  cogsVariableCosts: number;
  variableCosts: number;
  grossProfit: number; // totalRevenue - cogs - cogsVariableCosts — true Gross Margin
  grossMarginPct: number | null; // grossProfit / totalRevenue, null when no revenue
  // grossProfit minus whatever variableCosts weren't already counted toward
  // COGS above (selling fees, fulfillment, variable marketing, etc) — i.e.
  // totalRevenue - cogs - variableCosts. This is the number this app used
  // to call "grossProfit" before Gross Margin and Contribution Margin were
  // split into two distinct figures; the bottom line (netProfitPreTax and
  // everything after) is unaffected by the split.
  contributionMargin: number;
  contributionMarginPct: number | null; // contributionMargin / totalRevenue, null when no revenue
  operatingExpenses: number; // rent, payroll, subscriptions, etc — excludes loan interest
  interestExpense: number; // loan interest for the month
  netProfitPreTax: number; // contributionMargin - operatingExpenses - interestExpense - depreciationExpense + disposalGainLoss
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
  // Non-cash straight-line depreciation for fixed assets held this month —
  // reduces net profit (and is tax-deductible, matching the pre-tax
  // treatment of every other expense here) but never touches cash.
  depreciationExpense: number;
  // Gain/loss recognized when a fixed asset is disposed this month:
  // disposal proceeds minus its net book value at disposal. Positive =
  // gain, negative = loss. Flows into net profit; the cash side is
  // `fixedAssetDisposalProceeds` below.
  disposalGainLoss: number;
  // Cash-basis fields, for the Cash Flow Statement / Balance Sheet. These
  // differ from the accrual fields above in a few key ways: inventory
  // purchases and sales hit cash only when actually paid/collected (not
  // when incurred/recognized — see cashSalesRevenue/receivableCollections
  // and purchaseCash/payableSettlements), and fixed-asset purchases/
  // disposals are investing activity, never part of accrual net profit
  // (only depreciation and disposal gain/loss are).
  cashSalesRevenue: number; // revenue from non-credit sales, collected same month
  receivableCollections: number; // cash collected this month against credit sales (any period)
  purchaseCash: number; // cash paid for inventory this month: non-credit purchases + payable settlements
  payableSettlements: number; // cash paid this month against supplier credit (any period)
  loanProceeds: number; // new loan cash received this month
  principalRepayment: number; // loan principal repaid this month
  capitalIn: number; // owner investment/reinvestment this month
  capitalOut: number; // owner withdrawals this month
  fixedAssetPurchases: number; // cash paid to acquire fixed assets this month
  fixedAssetDisposalProceeds: number; // cash received on fixed asset disposals this month
  operatingCashFlow: number;
  financingCashFlow: number;
  investingCashFlow: number; // fixedAssetDisposalProceeds - fixedAssetPurchases
  netCashFlow: number; // operating + financing + investing
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
  monthlyOwnerDraw = 0,
  fixedAssets: FixedAsset[] = [],
  receivablePayments: ReceivablePayment[] = [],
  payablePayments: PayablePayment[] = []
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
  for (const a of fixedAssets) {
    candidateKeys.push(monthKey(a.purchaseDate));
    if (a.disposalDate) candidateKeys.push(monthKey(a.disposalDate));
  }
  for (const rp of receivablePayments) candidateKeys.push(monthKey(rp.date));
  for (const pp of payablePayments) candidateKeys.push(monthKey(pp.date));

  if (candidateKeys.length === 0) return [];
  candidateKeys.sort();
  // This function reports what actually happened, month by month — never a
  // projection (that's forecastRevenue's job, entirely separately). But a
  // loan's amortization schedule and a recurring expense both generate
  // month keys for their FULL remaining term regardless of whether that
  // time has passed yet, so without capping here, adding any loan or
  // recurring expense silently stretches this array with not-yet-real
  // future months — zero sales, but real-looking interest expense — and
  // every caller that reads the array's tail (Dashboard's "this month"
  // stats, break-even, the trailing-12-months financial health ratios)
  // would silently grab one of those phantom months instead of the actual
  // most recent one. Capping the end at the current month is what keeps
  // this an accrual record of the past, not a forecast wearing its clothes.
  const rangeEnd = candidateKeys[candidateKeys.length - 1] > nowKey ? nowKey : candidateKeys[candidateKeys.length - 1];
  const months = fullMonthRange(candidateKeys[0], rangeEnd);
  const fixedAssetMonthlyTotals = computeFixedAssetMonthlyTotals(fixedAssets, months);
  const result: MonthlyPnL[] = [];

  for (const month of months) {
    const monthSales = sales.filter((s) => monthKey(s.date) === month);
    let salesRevenue = 0;
    let cogs = 0;
    let variableCosts = 0;
    let cogsVariableCosts = 0;
    let unitsSold = 0;
    for (const s of monthSales) {
      const econ = economicsBySaleId.get(s.id);
      salesRevenue += econ?.revenue ?? 0;
      cogs += econ?.cogs ?? 0;
      variableCosts += econ?.variableCost ?? 0;
      cogsVariableCosts += econ?.cogsVariableCost ?? 0;
      unitsSold += s.qty;
    }

    const { expenseTotal, recurringRevenueTotal } = expenseTotalsForMonth(expenses, month);
    const totalRevenue = salesRevenue + recurringRevenueTotal;
    const grossProfit = totalRevenue - cogs - cogsVariableCosts;
    const contributionMargin = grossProfit - (variableCosts - cogsVariableCosts);

    const loanTotals = loanMonthlyTotals.get(month);
    const interestExpense = loanTotals?.interest ?? 0;
    const principalRepayment = loanTotals?.principal ?? 0;
    const loanProceeds = loanTotals?.proceeds ?? 0;

    const faTotals = fixedAssetMonthlyTotals.get(month);
    const depreciationExpense = faTotals?.depreciation ?? 0;
    const disposalGainLoss = faTotals?.disposalGainLoss ?? 0;
    const fixedAssetPurchases = faTotals?.purchaseCash ?? 0;
    const fixedAssetDisposalProceeds = faTotals?.disposalProceeds ?? 0;

    const netProfitPreTax =
      contributionMargin - expenseTotal - interestExpense - depreciationExpense + disposalGainLoss;
    const tax = Math.max(netProfitPreTax, 0) * (taxRatePct / 100);
    const netProfitAfterTax = netProfitPreTax - tax;
    const economicProfit = netProfitAfterTax - monthlyOwnerDraw;

    // Cash actually paid/collected this month — not the accrual figures
    // above. A credit sale/purchase only moves cash when it's actually
    // collected/paid (receivablePayments / payablePayments), not in the
    // month it was recognized as revenue/COGS.
    const cashSalesRevenue = monthSales
      .filter((s) => (s.paymentMethod ?? "cash") !== "credit")
      .reduce((sum, s) => sum + (economicsBySaleId.get(s.id)?.revenue ?? 0), 0);

    const receivableCollections = receivablePayments
      .filter((p) => monthKey(p.date) === month)
      .reduce((sum, p) => sum + p.amount, 0);

    const cashPurchasesThisMonth = purchases
      .filter((p) => monthKey(p.date) === month && (p.paymentMethod ?? "cash") !== "credit")
      .reduce((sum, p) => sum + p.qty * p.unitCost, 0);

    const payableSettlements = payablePayments
      .filter((p) => monthKey(p.date) === month)
      .reduce((sum, p) => sum + p.amount, 0);

    const purchaseCash = cashPurchasesThisMonth + payableSettlements;

    const monthCapital = capitalEntries.filter((c) => monthKey(c.date) === month);
    const capitalIn = monthCapital
      .filter((c) => c.kind === "investment" || c.kind === "reinvestment")
      .reduce((s, c) => s + c.amount, 0);
    const capitalOut = monthCapital
      .filter((c) => c.kind === "withdrawal")
      .reduce((s, c) => s + c.amount, 0);

    const operatingCashFlow =
      cashSalesRevenue +
      recurringRevenueTotal +
      receivableCollections -
      purchaseCash -
      variableCosts -
      expenseTotal -
      interestExpense -
      tax;
    const financingCashFlow = loanProceeds - principalRepayment + capitalIn - capitalOut;
    const investingCashFlow = fixedAssetDisposalProceeds - fixedAssetPurchases;

    result.push({
      month,
      salesRevenue,
      recurringRevenue: recurringRevenueTotal,
      totalRevenue,
      cogs,
      cogsVariableCosts,
      variableCosts,
      grossProfit,
      grossMarginPct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null,
      contributionMargin,
      contributionMarginPct: totalRevenue > 0 ? (contributionMargin / totalRevenue) * 100 : null,
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
      cashSalesRevenue,
      receivableCollections,
      purchaseCash,
      payableSettlements,
      loanProceeds,
      principalRepayment,
      capitalIn,
      capitalOut,
      fixedAssetPurchases,
      fixedAssetDisposalProceeds,
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

  // Depreciation is a real fixed cost (just non-cash), so it belongs in the
  // break-even fixed-cost base alongside rent/payroll/subscriptions —
  // otherwise break-even revenue understates what's actually needed to
  // cover the business's full cost structure.
  const monthlyFixedCosts = (latestMonth?.operatingExpenses ?? 0) + (latestMonth?.depreciationExpense ?? 0);
  const breakEvenRevenue = contributionMarginRatio > 0 ? monthlyFixedCosts / contributionMarginRatio : Infinity;
  const actualRevenue = latestMonth?.totalRevenue ?? 0;

  const marginOfSafetyPct =
    actualRevenue > 0 && Number.isFinite(breakEvenRevenue)
      ? ((actualRevenue - breakEvenRevenue) / actualRevenue) * 100
      : null;

  // Contribution margin, not (the now-distinct) gross profit — "does what's
  // left after ALL variable costs cover fixed overhead" is the question
  // this ratio is answering, matching contributionMarginRatio/
  // breakEvenRevenue above, which also treat COGS + every variable cost as
  // one blended bucket. Using the narrower gross-profit figure here would
  // overstate how much room there actually is to cover overhead.
  const overheadCoverageRatio =
    latestMonth && monthlyFixedCosts > 0 ? latestMonth.contributionMargin / monthlyFixedCosts : null;

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
  // Inventory aging — always computed off the FULL sales history for this
  // product, regardless of whatever dateFrom/dateTo range the rest of this
  // row is scoped to. Staleness is about "when did this last move", not
  // "did it move within whatever period I happen to be looking at" — a
  // product with zero sales in the selected 30-day window but a sale last
  // week isn't stale, so this deliberately ignores the range filter.
  lastSaleDate: string | null; // ISO date, null if never sold
  daysSinceLastSale: number | null; // null if never sold or no stock on hand
  agingValue: number; // inventoryValue if daysSinceLastSale >= 60 (or never sold with stock on hand), else 0
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

  const todayIso = new Date().toISOString().slice(0, 10);
  const daysBetween = (from: string, to: string) =>
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000));

  return products.map((p) => {
    const productSales = sales.filter((s) => s.productId === p.id && inRange(s.date));

    // Full history, not range-scoped — see lastSaleDate/daysSinceLastSale comment.
    let lastSaleDate: string | null = null;
    for (const s of sales) {
      if (s.productId === p.id && (lastSaleDate === null || s.date > lastSaleDate)) lastSaleDate = s.date;
    }

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

    const qtyOnHand = ledger?.qtyOnHand ?? 0;
    const inventoryValue = ledger?.inventoryValue ?? 0;
    // Only meaningful for physical stock actually sitting on the shelf —
    // a service or a fully sold-through item has nothing "aging".
    const daysSinceLastSale =
      p.type === "product" && qtyOnHand > 0 ? (lastSaleDate ? daysBetween(lastSaleDate, todayIso) : null) : null;
    // Never sold at all but stock is on hand: treat as maximally stale, not
    // "no data" — that's the case most worth flagging, not the one to hide.
    const isStale =
      p.type === "product" && qtyOnHand > 0 && (lastSaleDate === null || (daysSinceLastSale ?? 0) >= 60);
    const agingValue = isStale ? inventoryValue : 0;

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
      qtyOnHand,
      inventoryValue,
      wac: ledger?.wac ?? 0,
      marginBand,
      laborCost,
      fullyLoadedCost,
      fullyLoadedGrossProfit,
      fullyLoadedMarginPct,
      lastSaleDate,
      daysSinceLastSale,
      agingValue,
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
  accountsReceivable: number; // outstanding credit sales not yet collected — a real asset, omitted before this fix
  inventoryValue: number;
  fixedAssetsNetBookValue: number;
  totalAssets: number;
  loansPayable: number;
  accountsPayable: number; // outstanding credit purchases not yet paid — a real liability, omitted before this fix
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
  asOfISO: string,
  fixedAssets: FixedAsset[] = [],
  // Outstanding accounts receivable / payable as of asOfISO (pass
  // receivablesAging.totalOutstanding / payablesAging.totalOutstanding).
  // FIX: a credit sale immediately recognizes revenue into retainedEarnings
  // (via monthlyPnL's accrual salesRevenue) but only moves `cash` once it's
  // actually collected — so until it's collected, the asset side of the
  // balance sheet was missing the receivable entirely, understating total
  // assets relative to equity. Symmetrically, a credit purchase adds to
  // inventoryValue immediately (goods received) but was never recorded as a
  // liability, overstating assets relative to liabilities+equity. Any
  // business using credit sales or credit purchases — a first-class,
  // explicitly supported feature of this app (dueDate, creditTermDays,
  // aging reports) — would see `balances: false` and materially wrong
  // asset/liability totals without these two lines.
  accountsReceivable = 0,
  accountsPayable = 0
): BalanceSheet {
  const toDate = monthlyPnL.filter((m) => m.month <= asOfISO.slice(0, 7));
  const cash = toDate.reduce((s, m) => s + m.netCashFlow, 0);
  const retainedEarnings = toDate.reduce((s, m) => s + m.netProfitAfterTax, 0);

  const loansPayable = loans
    .filter((l) => l.active)
    .reduce((s, l) => s + computeLoanSummary(l, asOfISO).currentBalance, 0);

  // Only assets still held as of this date — a disposed asset's book value
  // left the books (and its cash/gain-loss are already folded into `cash`
  // and `retainedEarnings` above via investingCashFlow/disposalGainLoss).
  const fixedAssetsNetBookValue = fixedAssets
    .filter((a) => !a.disposalDate || a.disposalDate > asOfISO)
    .reduce((s, a) => s + computeFixedAssetStatus(a, asOfISO).netBookValue, 0);

  const totalAssets = cash + accountsReceivable + inventoryValue + fixedAssetsNetBookValue;
  const totalLiabilities = loansPayable + accountsPayable;
  const ownersCapital = capitalSummary.netCapitalIn;
  const totalEquity = ownersCapital + retainedEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    asOf: asOfISO,
    cash,
    accountsReceivable,
    inventoryValue,
    fixedAssetsNetBookValue,
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
// Accounts receivable aging. A credit sale is money you've already booked as
// revenue but haven't actually collected — this buckets every still-open
// credit sale by how overdue it is, which is what "90-day receivables" in
// the Sri Lankan SME sense actually means day to day: not a policy, a list
// of specific customers who owe specific amounts, some of them for longer
// than they should.
// ---------------------------------------------------------------------------

function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86400000);
}

export type ReceivableBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export interface ReceivableLine {
  saleId: string;
  productId: string;
  productName: string;
  customer: string;
  customerContact?: string;
  date: string; // sale date
  dueDate: string;
  amountDue: number; // full sale value
  amountPaid: number;
  amountOutstanding: number;
  daysOverdue: number; // negative = not yet due
  bucket: ReceivableBucket;
  createdByName?: string;
}

export interface ReceivablesAging {
  asOf: string;
  totalOutstanding: number;
  byBucket: Record<ReceivableBucket, number>;
  lines: ReceivableLine[];
}

export function computeReceivablesAging(
  products: Product[],
  sales: Sale[],
  saleEconomics: SaleEconomics[],
  payments: ReceivablePayment[],
  asOfISO: string
): ReceivablesAging {
  const productById = new Map(products.map((p) => [p.id, p]));
  const econBySaleId = new Map(saleEconomics.map((e) => [e.saleId, e]));
  const paidBySale = new Map<string, number>();
  for (const p of payments) paidBySale.set(p.saleId, (paidBySale.get(p.saleId) ?? 0) + p.amount);

  const lines: ReceivableLine[] = [];
  for (const s of sales) {
    if (s.paymentMethod !== "credit") continue;
    const amountDue = econBySaleId.get(s.id)?.revenue ?? s.qty * s.unitPrice;
    const amountPaid = paidBySale.get(s.id) ?? 0;
    const amountOutstanding = amountDue - amountPaid;
    if (amountOutstanding <= 0.005) continue; // fully collected

    const dueDate = s.dueDate ?? s.date;
    const daysOverdue = daysBetween(dueDate, asOfISO);
    let bucket: ReceivableBucket = "current";
    if (daysOverdue > 90) bucket = "90+";
    else if (daysOverdue > 60) bucket = "61-90";
    else if (daysOverdue > 30) bucket = "31-60";
    else if (daysOverdue > 0) bucket = "1-30";

    lines.push({
      saleId: s.id,
      productId: s.productId,
      productName: productById.get(s.productId)?.name ?? "—",
      customer: s.customer ?? "Unnamed customer",
      customerContact: s.customerContact,
      date: s.date,
      dueDate,
      amountDue,
      amountPaid,
      amountOutstanding,
      daysOverdue,
      bucket,
      createdByName: s.createdByName,
    });
  }
  lines.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const byBucket: Record<ReceivableBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let totalOutstanding = 0;
  for (const l of lines) {
    byBucket[l.bucket] += l.amountOutstanding;
    totalOutstanding += l.amountOutstanding;
  }

  return { asOf: asOfISO, totalOutstanding, byBucket, lines };
}

// Payable aging — mirrors receivables aging but for supplier credit purchases
export type PayableBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

export interface PayableLine {
  purchaseId: string;
  productId: string;
  productName: string;
  supplier: string;
  date: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  amountOutstanding: number;
  daysOverdue: number;
  bucket: PayableBucket;
}

export interface PayablesAging {
  asOf: string;
  totalOutstanding: number;
  byBucket: Record<PayableBucket, number>;
  lines: PayableLine[];
}

export function computePayablesAging(
  products: Product[],
  purchases: Purchase[],
  payments: PayablePayment[],
  asOfISO: string
): PayablesAging {
  const productById = new Map(products.map((p) => [p.id, p]));
  const paidByPurchase = new Map<string, number>();
  for (const p of payments) paidByPurchase.set(p.purchaseId, (paidByPurchase.get(p.purchaseId) ?? 0) + p.amount);

  const lines: PayableLine[] = [];
  for (const pur of purchases) {
    if (pur.paymentMethod !== "credit") continue;
    const amountDue = pur.qty * pur.unitCost;
    const amountPaid = paidByPurchase.get(pur.id) ?? 0;
    const amountOutstanding = amountDue - amountPaid;
    if (amountOutstanding <= 0.005) continue; // fully paid

    const dueDate = pur.dueDate ?? pur.date;
    const daysOverdue = daysBetween(dueDate, asOfISO);
    let bucket: PayableBucket = "current";
    if (daysOverdue > 90) bucket = "90+";
    else if (daysOverdue > 60) bucket = "61-90";
    else if (daysOverdue > 30) bucket = "31-60";
    else if (daysOverdue > 0) bucket = "1-30";

    lines.push({
      purchaseId: pur.id,
      productId: pur.productId,
      productName: productById.get(pur.productId)?.name ?? "—",
      supplier: pur.supplier ?? "Unnamed supplier",
      date: pur.date,
      dueDate,
      amountDue,
      amountPaid,
      amountOutstanding,
      daysOverdue,
      bucket,
    });
  }
  lines.sort((a, b) => b.daysOverdue - a.daysOverdue);

  const byBucket: Record<PayableBucket, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  let totalOutstanding = 0;
  for (const l of lines) {
    byBucket[l.bucket] += l.amountOutstanding;
    totalOutstanding += l.amountOutstanding;
  }

  return { asOf: asOfISO, totalOutstanding, byBucket, lines };
}

// ---------------------------------------------------------------------------
// Financial health ratios — the standard liquidity / profitability /
// efficiency / leverage set, computed off numbers this file already
// produces (Balance Sheet, Monthly P&L). Nothing here is hand-entered, so
// it stays consistent with the statements by construction, same as the
// Balance Sheet itself.
//
// "Current liabilities" for the liquidity ratios is accounts payable —
// this is a simplification (loan principal due within 12 months should
// technically also count), consistent with this codebase's existing
// approach elsewhere of favoring a transparent, checkable number over a
// more "complete" one that can't be verified by hand.
// ---------------------------------------------------------------------------

export interface FinancialHealthRatios {
  asOf: string;
  trailingMonths: number; // how many months of activity the profitability/efficiency ratios are drawn from

  // Liquidity — can the business cover near-term obligations?
  currentRatio: number | null; // (cash + AR + inventory) / accounts payable
  quickRatio: number | null; // (cash + AR) / accounts payable — excludes inventory, which isn't instantly spendable

  // Profitability — trailing-window margins and return on the owner's stake
  grossMarginPct: number | null;
  // Revenue minus COGS and operating costs (including depreciation) before
  // interest and tax — i.e. EBIT margin. Distinct from netMarginPct below:
  // net margin also absorbs interest, tax, and one-off disposal gain/loss,
  // so a business can have a healthy operating margin while net margin
  // looks weak because of a big loan or a bad tax quarter. This is the
  // number that isolates "is the core business itself profitable".
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  returnOnEquityPct: number | null; // trailing net profit / current total equity

  // Efficiency — how fast cash moves through the business
  daysSalesOutstanding: number | null; // avg days to collect a sale
  daysPayableOutstanding: number | null; // avg days taken to pay a supplier
  daysInventoryOutstanding: number | null; // avg days stock sits before selling
  cashConversionCycleDays: number | null; // DIO + DSO - DPO — days cash is tied up in the operating cycle
  inventoryTurnoverAnnualized: number | null; // times inventory is sold through per year

  // Leverage — how much of the business is financed by debt
  debtToEquity: number | null;
  debtRatio: number | null; // total liabilities / total assets
}

export function computeFinancialHealthRatios(
  monthlyPnL: MonthlyPnL[],
  balanceSheet: BalanceSheet,
  windowMonths = 12
): FinancialHealthRatios {
  const window = monthlyPnL.slice(-Math.max(1, windowMonths));
  const trailingMonths = window.length;
  const days = trailingMonths * 30; // approximate — matches this app's existing "30 days/month" convention elsewhere

  const revenue = window.reduce((s, m) => s + m.totalRevenue, 0);
  const cogs = window.reduce((s, m) => s + m.cogs, 0);
  const grossProfit = window.reduce((s, m) => s + m.grossProfit, 0);
  const netProfit = window.reduce((s, m) => s + m.netProfitAfterTax, 0);
  const operatingProfit = window.reduce(
    (s, m) => s + (m.contributionMargin - m.operatingExpenses - m.depreciationExpense),
    0
  );

  const { cash, accountsReceivable, inventoryValue, accountsPayable, totalLiabilities, totalAssets, totalEquity } =
    balanceSheet;

  const currentAssets = cash + accountsReceivable + inventoryValue;
  const currentRatio = accountsPayable > 0 ? currentAssets / accountsPayable : null;
  const quickRatio = accountsPayable > 0 ? (cash + accountsReceivable) / accountsPayable : null;

  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : null;
  const operatingMarginPct = revenue > 0 ? (operatingProfit / revenue) * 100 : null;
  const netMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : null;
  const returnOnEquityPct = totalEquity > 0 ? (netProfit / totalEquity) * 100 : null;

  const daysSalesOutstanding = revenue > 0 ? (accountsReceivable / revenue) * days : null;
  const daysPayableOutstanding = cogs > 0 ? (accountsPayable / cogs) * days : null;
  const daysInventoryOutstanding = cogs > 0 ? (inventoryValue / cogs) * days : null;
  const cashConversionCycleDays =
    daysInventoryOutstanding !== null && daysSalesOutstanding !== null && daysPayableOutstanding !== null
      ? daysInventoryOutstanding + daysSalesOutstanding - daysPayableOutstanding
      : null;
  const inventoryTurnoverAnnualized =
    cogs > 0 && inventoryValue > 0 ? (cogs / inventoryValue) * (365 / days) : null;

  const debtToEquity = totalEquity > 0 ? totalLiabilities / totalEquity : null;
  const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : null;

  return {
    asOf: balanceSheet.asOf,
    trailingMonths,
    currentRatio,
    quickRatio,
    grossMarginPct,
    operatingMarginPct,
    netMarginPct,
    returnOnEquityPct,
    daysSalesOutstanding,
    daysPayableOutstanding,
    daysInventoryOutstanding,
    cashConversionCycleDays,
    inventoryTurnoverAnnualized,
    debtToEquity,
    debtRatio,
  };
}

// ---------------------------------------------------------------------------
// Customer acquisition cost & average customer value. Deliberately built
// entirely off data this app already collects — no leads, no ad-platform
// integration, nothing external:
//   - marketing spend = Expenses already logged under the existing
//     "Marketing" category (see EXPENSE_CATEGORIES), using the same
//     monthly-equivalent normalization the Expenses page already shows for
//     its "spend by category" card, so this figure always agrees with that
//     one rather than becoming a second, disagreeing calculation.
//   - new customers = distinct Sale.customer names whose EARLIEST sale ever
//     (not just earliest in-window) falls inside the trailing window — a
//     returning customer buying again this month doesn't count as newly
//     acquired.
// A lead-to-customer conversion rate isn't computed here: nothing in this
// app's data model captures a lead (a pre-sale contact), so a conversion
// rate would have to be invented rather than derived. Adding that requires
// a new place to record leads and someone actually keeping it up to date —
// deliberately left out rather than shipping a number with no real input.
// ---------------------------------------------------------------------------

export interface MarketingMetrics {
  trailingMonths: number;
  marketingSpend: number; // trailing-window total, from the "Marketing" expense category
  newCustomers: number; // distinct customers whose first-ever sale falls in this window
  returningCustomers: number; // distinct customers who bought in this window but first bought earlier
  customerAcquisitionCost: number | null; // marketingSpend / newCustomers, null when newCustomers is 0
  averageCustomerValue: number; // total revenue in window / distinct customers who bought in window
}

export function computeMarketingMetrics(
  sales: Sale[],
  expenses: Expense[],
  windowMonths = 12
): MarketingMetrics {
  const todayIso = new Date().toISOString().slice(0, 10);
  const windowStart = addDaysIso(todayIso, -windowMonths * 30);

  const marketingSpend = expenses
    .filter((e) => e.kind === "expense" && e.category === "Marketing")
    .reduce((sum, e) => {
      if (e.isRecurring) {
        // Only count it if it's actually active at some point in the window.
        const activeInWindow = e.startDate <= todayIso && (!e.endDate || e.endDate >= windowStart);
        return activeInWindow ? sum + monthlyNormalizedAmount(e.amount, e.recurrence) * windowMonths : sum;
      }
      return e.startDate >= windowStart && e.startDate <= todayIso ? sum + e.amount : sum;
    }, 0);

  const key = (name: string) => name.trim().toLowerCase();
  const firstSaleByCustomer = new Map<string, string>(); // key -> earliest date, across ALL sales
  for (const s of sales) {
    if (!s.customer) continue;
    const k = key(s.customer);
    const existing = firstSaleByCustomer.get(k);
    if (!existing || s.date < existing) firstSaleByCustomer.set(k, s.date);
  }

  const buyersInWindow = new Map<string, number>(); // key -> revenue in window
  for (const s of sales) {
    if (!s.customer || s.date < windowStart || s.date > todayIso) continue;
    const k = key(s.customer);
    buyersInWindow.set(k, (buyersInWindow.get(k) ?? 0) + s.unitPrice * s.qty);
  }

  let newCustomers = 0;
  let returningCustomers = 0;
  let revenueInWindow = 0;
  for (const [k, revenue] of buyersInWindow) {
    revenueInWindow += revenue;
    const firstSale = firstSaleByCustomer.get(k);
    if (firstSale && firstSale >= windowStart) newCustomers += 1;
    else returningCustomers += 1;
  }

  return {
    trailingMonths: windowMonths,
    marketingSpend,
    newCustomers,
    returningCustomers,
    customerAcquisitionCost: newCustomers > 0 ? marketingSpend / newCustomers : null,
    averageCustomerValue: buyersInWindow.size > 0 ? revenueInWindow / buyersInWindow.size : 0,
  };
}

// ---------------------------------------------------------------------------
// Supplier concentration — what share of purchasing is riding on your
// top supplier(s). Built off Purchase.supplier (free text, same field the
// Purchases page already collects), so no new data entry needed. A pure
// risk signal: high concentration isn't wrong, it's just worth knowing
// deliberately rather than discovering it the day that supplier vanishes.
// ---------------------------------------------------------------------------

export interface SupplierConcentration {
  trailingMonths: number;
  totalSpend: number;
  suppliers: { supplier: string; spend: number; sharePct: number }[]; // sorted, highest spend first
  topSupplierSharePct: number | null; // suppliers[0].sharePct, null when no purchases
  top3SharePct: number | null; // sum of top 3 shares, null when no purchases
}

export function computeSupplierConcentration(purchases: Purchase[], windowMonths = 12): SupplierConcentration {
  const todayIso = new Date().toISOString().slice(0, 10);
  const windowStart = addDaysIso(todayIso, -windowMonths * 30);

  const bySupplier = new Map<string, number>();
  let totalSpend = 0;
  for (const p of purchases) {
    if (p.date < windowStart || p.date > todayIso) continue;
    const name = (p.supplier ?? "").trim() || "Unspecified supplier";
    const spend = p.qty * p.unitCost;
    bySupplier.set(name, (bySupplier.get(name) ?? 0) + spend);
    totalSpend += spend;
  }

  const suppliers = [...bySupplier.entries()]
    .map(([supplier, spend]) => ({ supplier, spend, sharePct: totalSpend > 0 ? (spend / totalSpend) * 100 : 0 }))
    .sort((a, b) => b.spend - a.spend);

  return {
    trailingMonths: windowMonths,
    totalSpend,
    suppliers,
    topSupplierSharePct: suppliers.length > 0 ? suppliers[0].sharePct : null,
    top3SharePct: suppliers.length > 0 ? suppliers.slice(0, 3).reduce((s, x) => s + x.sharePct, 0) : null,
  };
}

// ---------------------------------------------------------------------------
// Cash runway / "can I make rent" projection. Starts from today's actual
// cash position (the same derived cash figure the Balance Sheet uses, so
// this is never a second, disagreeing source of truth) and walks forward
// day by day to a target date, applying every scheduled cash movement that
// has an actual date attached — loan payments (exact, from the
// amortization schedule), rent and recurring expenses/payroll (projected
// onto the specific days they recur on), and expected receivable
// collections (assumed to land on their due date, which is optimistic but
// is the only defensible assumption without a track record of how late
// customers actually pay). A flat estimated daily cash-sales inflow fills
// the gaps — this is a planning tool, not a guarantee.
// ---------------------------------------------------------------------------

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

// Does a recurring item (rent, payroll, a recurring expense) land on this
// specific calendar day, given the day-of-month/week it started on? Handles
// the month-end edge case (e.g. something that starts on the 31st falls on
// the last day of shorter months) the same way computeLoanSchedule's
// addMonthsIso does.
function recurrenceLandsOn(anchorIso: string, recurrence: Recurrence, targetIso: string): boolean {
  if (targetIso < anchorIso) return false;
  const [ay, am, ad] = anchorIso.split("-").map(Number);
  const [ty, tm, td] = targetIso.split("-").map(Number);
  switch (recurrence) {
    case "monthly": {
      const lastDayOfTargetMonth = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
      const effectiveDay = Math.min(ad, lastDayOfTargetMonth);
      return td === effectiveDay;
    }
    case "weekly": {
      const anchorDow = new Date(Date.UTC(ay, am - 1, ad)).getUTCDay();
      const targetDow = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
      return anchorDow === targetDow;
    }
    case "yearly":
      return am === tm && ad === td;
    case "none":
      return anchorIso === targetIso;
  }
}

export interface CashRunwayDay {
  date: string;
  inflow: number;
  outflow: number;
  balance: number;
  events: string[]; // human-readable line items that moved cash this day
}

export interface CashRunwayResult {
  asOf: string;
  startingCash: number;
  rentDueDate: string;
  rentAmount: number;
  days: CashRunwayDay[];
  cashAtRentDue: number;
  canMakeRent: boolean;
  shortfall: number; // 0 if canMakeRent, else how much short
  lowestBalance: number;
  lowestBalanceDate: string;
}

export function computeCashRunway(params: {
  asOf: string;
  startingCash: number;
  horizonDays: number;
  estimatedDailyCashSales: number; 
  rentAmount: number;
  rentDueDayOfMonth: number;
  loans: Loan[];
  employees: Employee[];
  expenses: Expense[];
  receivables: ReceivableLine[];
  payables?: PayableLine[]; 
  currency: string;
}): CashRunwayResult {
  const { asOf, startingCash, horizonDays, estimatedDailyCashSales, rentAmount, rentDueDayOfMonth, loans, employees, expenses, receivables, payables = [] } = params;

  // Next occurrence of the rent due day, strictly after today. Walks forward
  // day by day (at most ~31 iterations) rather than doing month arithmetic,
  // so the "clamp to the last day of a short month" edge case (rent due day
  // 31, checking February) falls out for free: day 31 just never matches
  // and the search rolls into the next month, same as a calendar would.
  let rentDueDate = addDaysIso(asOf, 1);
  for (let i = 1; i <= 31; i++) {
    const candidate = addDaysIso(asOf, i);
    const [, , cd] = candidate.split("-").map(Number);
    const daysInThisMonth = new Date(Date.UTC(Number(candidate.slice(0, 4)), Number(candidate.slice(5, 7)), 0)).getUTCDate();
    const targetDay = Math.min(rentDueDayOfMonth, daysInThisMonth);
    if (cd === targetDay) {
      rentDueDate = candidate;
      break;
    }
  }

  const allLoanPayments = loans.filter((l) => l.active).flatMap((l) => computeLoanSchedule(l).map((p) => ({ ...p, loanName: l.name })));

  const days: CashRunwayDay[] = [];
  let balance = startingCash;
  let lowestBalance = startingCash;
  let lowestBalanceDate = asOf;

  for (let i = 1; i <= horizonDays; i++) {
    const date = addDaysIso(asOf, i);
    const events: string[] = [];
    let inflow = estimatedDailyCashSales;
    let outflow = 0;

    for (const r of receivables) {
      if (r.dueDate === date) {
        inflow += r.amountOutstanding;
        events.push(`${r.customer} payment due (${r.amountOutstanding.toLocaleString()})`);
      }
    }

    for (const p of payables) {
      if (p.dueDate === date) {
        outflow += p.amountOutstanding;
        events.push(`${p.supplier} payment due (${p.amountOutstanding.toLocaleString()})`);
      }
    }

    for (const lp of allLoanPayments) {
      if (lp.date === date) {
        outflow += lp.payment;
        events.push(`${lp.loanName} installment`);
      }
    }

    for (const e of employees) {
      if (!e.active) continue;
      if (recurrenceLandsOn(e.startDate, e.payFrequency, date)) {
        outflow += e.payRate;
        events.push(`Payroll: ${e.name}`);
      }
    }

    for (const ex of expenses) {
      if (ex.kind !== "expense" || !ex.isRecurring || ex.recurrence === "none") continue;
      if (ex.endDate && date > ex.endDate) continue;
      if (recurrenceLandsOn(ex.startDate, ex.recurrence, date)) {
        outflow += ex.amount;
        events.push(ex.name);
      }
    }

    if (date === rentDueDate && rentAmount > 0) {
      outflow += rentAmount;
      events.push("Rent");
    }

    balance = balance + inflow - outflow;
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestBalanceDate = date;
    }
    days.push({ date, inflow, outflow, balance, events });
  }

  const rentDueDay = days.find((d) => d.date === rentDueDate);
  const cashAtRentDue = rentDueDay ? rentDueDay.balance : balance;
  const canMakeRent = cashAtRentDue >= 0;

  return {
    asOf,
    startingCash,
    rentDueDate,
    rentAmount,
    days,
    cashAtRentDue,
    canMakeRent,
    shortfall: canMakeRent ? 0 : Math.abs(cashAtRentDue),
    lowestBalance,
    lowestBalanceDate,
  };
}

// Fixed asset depreciation calculation
export interface FixedAssetStatus {
  asset: FixedAsset;
  accumulatedDepreciation: number;
  netBookValue: number;
  monthlyDepreciation: number;
  fullyDepreciated: boolean;
  disposed: boolean;
  monthsDepreciated: number;
}

export function computeFixedAssetStatus(asset: FixedAsset, asOfISO: string): FixedAssetStatus {
  const disposed = !!asset.disposalDate;
  const effectiveEndDate = asset.disposalDate || asOfISO;

  // Calculate months between purchase date and effective end date
  const [py, pm, pd] = asset.purchaseDate.split("-").map(Number);
  const [ey, em, ed] = effectiveEndDate.split("-").map(Number);

  const purchaseMonth = py * 12 + (pm - 1);
  const endMonth = ey * 12 + (em - 1);
  const monthsDepreciated = Math.max(0, endMonth - purchaseMonth + 1);

  const depreciableAmount = asset.cost - (asset.salvageValue || 0);
  const monthlyDepreciation = depreciableAmount / asset.usefulLifeMonths;

  const accumulatedDepreciation = Math.min(
    depreciableAmount,
    monthlyDepreciation * monthsDepreciated
  );

  const netBookValue = asset.cost - accumulatedDepreciation;
  const fullyDepreciated = accumulatedDepreciation >= depreciableAmount;

  return {
    asset,
    accumulatedDepreciation,
    netBookValue,
    monthlyDepreciation,
    fullyDepreciated,
    disposed,
    monthsDepreciated,
  };
}

function monthEndIso(mKey: string): string {
  const [y, m] = mKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function previousMonthKey(mKey: string): string {
  const [y, m] = mKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export interface FixedAssetMonthlyTotals {
  depreciation: number; // non-cash expense for the month
  purchaseCash: number; // cash paid to acquire assets, this month
  disposalProceeds: number; // cash received on disposal, this month
  disposalGainLoss: number; // disposalProceeds - net book value at disposal
}

// Per-month depreciation, acquisition cash, and disposal cash/gain-loss for
// the fixed asset register, aggregated across the whole portfolio. This is
// what feeds the non-cash depreciation line (and disposal gain/loss) into
// the Income Statement, and the acquisition/disposal cash into the Cash
// Flow Statement's investing section — for every month in `months`.
// Depreciation per month is derived from computeFixedAssetStatus's
// accumulated-depreciation figure (month-end minus prior month-end) so it
// always reconciles exactly with the net book value shown on the Balance
// Sheet and on the Fixed Assets page, however many months are summed.
export function computeFixedAssetMonthlyTotals(
  fixedAssets: FixedAsset[],
  months: string[]
): Map<string, FixedAssetMonthlyTotals> {
  const map = new Map<string, FixedAssetMonthlyTotals>();
  const bump = (key: string, delta: Partial<FixedAssetMonthlyTotals>) => {
    const cur = map.get(key) ?? { depreciation: 0, purchaseCash: 0, disposalProceeds: 0, disposalGainLoss: 0 };
    map.set(key, {
      depreciation: cur.depreciation + (delta.depreciation ?? 0),
      purchaseCash: cur.purchaseCash + (delta.purchaseCash ?? 0),
      disposalProceeds: cur.disposalProceeds + (delta.disposalProceeds ?? 0),
      disposalGainLoss: cur.disposalGainLoss + (delta.disposalGainLoss ?? 0),
    });
  };

  for (const asset of fixedAssets) {
    const purchaseMonth = monthKey(asset.purchaseDate);
    bump(purchaseMonth, { purchaseCash: asset.cost });

    const disposalMonth = asset.disposalDate ? monthKey(asset.disposalDate) : null;

    for (const month of months) {
      if (month < purchaseMonth) continue;
      if (disposalMonth && month > disposalMonth) continue;

      const asOfThisMonth = disposalMonth === month ? asset.disposalDate! : monthEndIso(month);
      const accumThisMonth = computeFixedAssetStatus(asset, asOfThisMonth).accumulatedDepreciation;

      const prevKey = previousMonthKey(month);
      const accumPrev =
        prevKey < purchaseMonth ? 0 : computeFixedAssetStatus(asset, monthEndIso(prevKey)).accumulatedDepreciation;

      bump(month, { depreciation: accumThisMonth - accumPrev });
    }

    if (disposalMonth) {
      const statusAtDisposal = computeFixedAssetStatus(asset, asset.disposalDate!);
      const proceeds = asset.disposalAmount ?? 0;
      bump(disposalMonth, {
        disposalProceeds: proceeds,
        disposalGainLoss: proceeds - statusAtDisposal.netBookValue,
      });
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Project / job costing. Rolls a project's manual cost segments together
// with any Purchase/Expense/Sale tagged to it (via their optional
// `projectId`) into one picture: quoted price vs. actual cost vs. invoiced
// to date. Nothing here touches inventory/WAC, MRR, or the P&L — a
// project's costs live wherever they already lived (a tagged Purchase still
// affects inventory and COGS exactly as before); this is purely an
// additional lens over the same data plus the segments that don't fit
// anywhere else.
// ---------------------------------------------------------------------------

export interface ProjectCostCategoryTotal {
  category: string;
  amount: number;
}

export interface ProjectFinancials {
  projectId: string;
  segmentCost: number; // sum of this project's manual ProjectCostSegment amounts
  purchaseCost: number; // sum of qty*unitCost for Purchases tagged to this project
  expenseCost: number; // sum of amount for Expenses tagged to this project
  laborCost: number; // sum of hours*hourlyRate for closed, billable TimeEntries tagged to this project
  laborHours: number; // sum of hours for closed TimeEntries tagged to this project (billable or not, for visibility)
  totalCost: number; // segmentCost + purchaseCost + expenseCost + laborCost
  quotedPrice: number;
  profit: number; // quotedPrice - totalCost
  marginPct: number | null; // profit / quotedPrice * 100, null if quotedPrice is 0
  budgetUsedPct: number | null; // totalCost / quotedPrice * 100, null if quotedPrice is 0
  invoicedToDate: number; // sum of revenue for Sales tagged to this project — cash/billing progress, separate from the margin calc above
  costByCategory: ProjectCostCategoryTotal[]; // segments (own category) + tagged purchases ("Materials (purchases)") + tagged expenses (own category) + tagged labor ("Labor (time entries)"), sorted desc
}

export function computeProjectFinancials(
  project: Project,
  costSegments: ProjectCostSegment[],
  purchases: Purchase[],
  expenses: Expense[],
  sales: Sale[],
  timeEntries: TimeEntry[] = []
): ProjectFinancials {
  const segs = costSegments.filter((s) => s.projectId === project.id);
  const segmentCost = segs.reduce((sum, s) => sum + s.amount, 0);

  const linkedPurchases = purchases.filter((p) => p.projectId === project.id);
  const purchaseCost = linkedPurchases.reduce((sum, p) => sum + p.unitCost * p.qty, 0);

  const linkedExpenses = expenses.filter((e) => e.projectId === project.id && e.kind === "expense");
  const expenseCost = linkedExpenses.reduce((sum, e) => sum + e.amount, 0);

  const linkedSales = sales.filter((s) => s.projectId === project.id);
  const invoicedToDate = linkedSales.reduce((sum, s) => sum + s.unitPrice * s.qty, 0);

  // Only entries that are actually finished (clockOut set) have a settled
  // duration; a still-running clock-in has no end time to cost out yet.
  // Only billable entries with a snapshotted hourlyRate contribute a dollar
  // cost — a non-billable or unrated entry still counts toward laborHours
  // (so the hours worked are visible) but adds nothing to totalCost, same
  // as it always could add nothing if never entered as a segment either.
  const linkedTimeEntries = timeEntries.filter((t) => t.projectId === project.id && t.clockOut);
  const laborHours = linkedTimeEntries.reduce((sum, t) => sum + (t.clockOut! - t.clockIn) / 3600000, 0);
  const laborCost = linkedTimeEntries
    .filter((t) => t.billable && t.hourlyRate)
    .reduce((sum, t) => sum + ((t.clockOut! - t.clockIn) / 3600000) * (t.hourlyRate ?? 0), 0);

  const totalCost = segmentCost + purchaseCost + expenseCost + laborCost;
  const profit = project.quotedPrice - totalCost;
  const marginPct = project.quotedPrice > 0 ? (profit / project.quotedPrice) * 100 : null;
  const budgetUsedPct = project.quotedPrice > 0 ? (totalCost / project.quotedPrice) * 100 : null;

  const catMap = new Map<string, number>();
  for (const s of segs) {
    const key = s.category || "Other";
    catMap.set(key, (catMap.get(key) ?? 0) + s.amount);
  }
  if (purchaseCost > 0) {
    catMap.set("Materials (purchases)", (catMap.get("Materials (purchases)") ?? 0) + purchaseCost);
  }
  for (const e of linkedExpenses) {
    const key = e.category || "Other";
    catMap.set(key, (catMap.get(key) ?? 0) + e.amount);
  }
  if (laborCost > 0) {
    catMap.set("Labor (time entries)", (catMap.get("Labor (time entries)") ?? 0) + laborCost);
  }

  const costByCategory = Array.from(catMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    projectId: project.id,
    segmentCost,
    purchaseCost,
    expenseCost,
    laborCost,
    laborHours,
    totalCost,
    quotedPrice: project.quotedPrice,
    profit,
    marginPct,
    budgetUsedPct,
    invoicedToDate,
    costByCategory,
  };
}

export function computeAllProjectFinancials(
  projects: Project[],
  costSegments: ProjectCostSegment[],
  purchases: Purchase[],
  expenses: Expense[],
  sales: Sale[],
  timeEntries: TimeEntry[] = []
): Map<string, ProjectFinancials> {
  const map = new Map<string, ProjectFinancials>();
  for (const p of projects) {
    map.set(p.id, computeProjectFinancials(p, costSegments, purchases, expenses, sales, timeEntries));
  }
  return map;
}

// Portfolio-level roll-up across every active (not completed/cancelled)
// project — the numbers a "Projects" list page leads with.
export interface ProjectPortfolioSummary {
  activeCount: number;
  totalQuotedActive: number;
  totalCostActive: number;
  totalProfitActive: number;
  overBudgetCount: number; // active projects where totalCost > quotedPrice
}

export function computeProjectPortfolioSummary(
  projects: Project[],
  financials: Map<string, ProjectFinancials>
): ProjectPortfolioSummary {
  let activeCount = 0;
  let totalQuotedActive = 0;
  let totalCostActive = 0;
  let totalProfitActive = 0;
  let overBudgetCount = 0;

  for (const p of projects) {
    if (p.status === "completed" || p.status === "cancelled") continue;
    const f = financials.get(p.id);
    if (!f) continue;
    activeCount += 1;
    totalQuotedActive += f.quotedPrice;
    totalCostActive += f.totalCost;
    totalProfitActive += f.profit;
    if (f.totalCost > f.quotedPrice && f.quotedPrice > 0) overBudgetCount += 1;
  }

  return { activeCount, totalQuotedActive, totalCostActive, totalProfitActive, overBudgetCount };
}

// The actual list behind ProjectPortfolioSummary.overBudgetCount — every
// active (not completed/cancelled) project that's at or past a budget
// threshold, worst first. This is what surfaces "3 projects over budget" on
// the Dashboard and drives the budget-threshold notifications, rather than
// requiring a visit to the Projects page to notice.
export interface ProjectBudgetAlert {
  projectId: string;
  name: string;
  client?: string;
  status: ProjectStatus;
  totalCost: number;
  quotedPrice: number;
  budgetUsedPct: number;
  isOverBudget: boolean; // true once budgetUsedPct > 100, vs. just "approaching" at the warn threshold
}

export function computeProjectBudgetAlerts(
  projects: Project[],
  financials: Map<string, ProjectFinancials>,
  warnThresholdPct: number = 90
): ProjectBudgetAlert[] {
  const alerts: ProjectBudgetAlert[] = [];
  for (const p of projects) {
    if (p.status === "completed" || p.status === "cancelled") continue;
    if (p.quotedPrice <= 0) continue;
    const f = financials.get(p.id);
    if (!f || f.budgetUsedPct === null) continue;
    if (f.budgetUsedPct < warnThresholdPct) continue;
    alerts.push({
      projectId: p.id,
      name: p.name,
      client: p.client,
      status: p.status,
      totalCost: f.totalCost,
      quotedPrice: f.quotedPrice,
      budgetUsedPct: f.budgetUsedPct,
      isOverBudget: f.budgetUsedPct > 100,
    });
  }
  return alerts.sort((a, b) => b.budgetUsedPct - a.budgetUsedPct);
}

// ---------------------------------------------------------------------------
// Progress-billing schedule roll-up for a single project's milestones — the
// number behind "how much of the quote has been scheduled/invoiced/paid so
// far", used on the Project detail view and to sanity-check that a
// milestone schedule actually adds up to the quoted price.
// ---------------------------------------------------------------------------
export interface MilestoneSummary {
  scheduledTotal: number; // sum of every milestone's amount, regardless of status
  invoicedTotal: number; // sum of amounts for milestones marked invoiced or paid
  paidTotal: number; // sum of amounts for milestones marked paid
  outstandingInvoiced: number; // invoicedTotal - paidTotal — billed but not yet collected
  unscheduled: number; // quotedPrice - scheduledTotal — what's left to put on the schedule (can be negative if over-scheduled)
}

export function summarizeMilestones(milestones: ProjectMilestone[], quotedPrice: number): MilestoneSummary {
  let scheduledTotal = 0;
  let invoicedTotal = 0;
  let paidTotal = 0;
  for (const m of milestones) {
    scheduledTotal += m.amount;
    if (m.status === "invoiced" || m.status === "paid") invoicedTotal += m.amount;
    if (m.status === "paid") paidTotal += m.amount;
  }
  return {
    scheduledTotal,
    invoicedTotal,
    paidTotal,
    outstandingInvoiced: invoicedTotal - paidTotal,
    unscheduled: quotedPrice - scheduledTotal,
  };
}

// Milestones with a dueDate that's overdue or coming up soon and haven't
// been paid yet — the progress-billing counterpart to receivables aging.
// Deliberately excludes "paid" milestones (nothing left to chase) but
// includes "invoiced" ones (billed but not yet collected is exactly the
// case worth a reminder for), same as how an overdue receivable is tracked
// regardless of whether an invoice was formally issued.
export interface MilestoneReminder {
  milestoneId: string;
  projectId: string;
  projectName: string;
  label: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number; // negative when overdue
  isOverdue: boolean;
}

export function computeMilestoneReminders(
  projects: Project[],
  milestones: ProjectMilestone[],
  todayIsoDate: string,
  daysAhead: number = 7
): MilestoneReminder[] {
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const today = new Date(todayIsoDate).getTime();
  const reminders: MilestoneReminder[] = [];
  for (const m of milestones) {
    if (m.status === "paid" || !m.dueDate) continue;
    const due = new Date(m.dueDate).getTime();
    const daysUntilDue = Math.round((due - today) / 86400000);
    if (daysUntilDue > daysAhead) continue;
    const project = projectById.get(m.projectId);
    if (!project || project.status === "cancelled") continue;
    reminders.push({
      milestoneId: m.id,
      projectId: m.projectId,
      projectName: project.name,
      label: m.label,
      amount: m.amount,
      dueDate: m.dueDate,
      daysUntilDue,
      isOverdue: daysUntilDue < 0,
    });
  }
  return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}
