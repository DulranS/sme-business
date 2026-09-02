// Anomaly flagging — deliberately plain arithmetic, not an LLM call. The
// question "is this 3x what I usually spend on X" has one correct answer
// computable from the data itself; asking a model to eyeball a list of
// numbers and guess which look wrong is strictly worse than just computing
// it, and would risk both false confidence and real cost for no benefit.
// This keeps the AI Assistant's only genuinely "generated" output limited
// to phrasing — see ANOMALY_SUMMARY_SYSTEM_PROMPT in app/api/ai/chat for
// where a flagged list like this gets turned into a friendly sentence.
//
// Everything here is advisory only: nothing in this file ever mutates the
// ledger, blocks a save, or is treated as ground truth — it's a "you might
// want to double-check this" surface, same spirit as a spreadsheet's
// conditional formatting.

import type { Expense, Purchase, Product } from "./types";

export interface ExpenseAnomaly {
  expense: Expense;
  categoryMedian: number;
  multiple: number; // this expense's amount ÷ the category's recent median
}

export interface PurchaseAnomaly {
  purchase: Purchase;
  product: Product;
  productMedianCost: number;
  multiple: number; // this purchase's unit cost ÷ the product's recent median unit cost
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

const LOOKBACK_DAYS = 180;
const MIN_SAMPLE_SIZE = 3; // don't flag anything until there's enough history to compare against
const FLAG_MULTIPLE = 2.5; // "3x your usual" from the brief, given a little headroom

function withinLookback(iso: string, asOfIso: string): boolean {
  const days = (Date.parse(asOfIso) - Date.parse(iso)) / 86_400_000;
  return days >= 0 && days <= LOOKBACK_DAYS;
}

// One-off (non-recurring) expenses only — a recurring expense repeating at
// the same amount every month isn't "unusual", it's just rent. Compares
// each candidate against the median of every OTHER one-off expense in the
// same category within the lookback window.
export function detectExpenseAnomalies(expenses: Expense[], asOfIso: string): ExpenseAnomaly[] {
  const oneOff = expenses.filter((e) => e.kind === "expense" && !e.isRecurring && withinLookback(e.startDate, asOfIso));
  const byCategory = new Map<string, Expense[]>();
  for (const e of oneOff) {
    const key = e.category || "Uncategorized";
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(e);
  }

  const anomalies: ExpenseAnomaly[] = [];
  for (const bucket of byCategory.values()) {
    if (bucket.length < MIN_SAMPLE_SIZE + 1) continue; // need enough OTHER entries to compare against
    for (const candidate of bucket) {
      const rest = bucket.filter((e) => e.id !== candidate.id).map((e) => e.amount);
      const categoryMedian = median(rest);
      if (categoryMedian <= 0) continue;
      const multiple = candidate.amount / categoryMedian;
      if (multiple >= FLAG_MULTIPLE) {
        anomalies.push({ expense: candidate, categoryMedian, multiple });
      }
    }
  }
  return anomalies.sort((a, b) => b.multiple - a.multiple);
}

// Compares each purchase's unit cost against the median unit cost of every
// OTHER purchase of the same product within the lookback window — catches
// a supplier price spike, a data-entry typo (an extra zero), or a one-off
// rush order at a premium.
export function detectPurchaseAnomalies(purchases: Purchase[], products: Product[], asOfIso: string): PurchaseAnomaly[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const recent = purchases.filter((p) => withinLookback(p.date, asOfIso));
  const byProduct = new Map<string, Purchase[]>();
  for (const p of recent) {
    if (!byProduct.has(p.productId)) byProduct.set(p.productId, []);
    byProduct.get(p.productId)!.push(p);
  }

  const anomalies: PurchaseAnomaly[] = [];
  for (const [productId, bucket] of byProduct.entries()) {
    const product = productById.get(productId);
    if (!product || bucket.length < MIN_SAMPLE_SIZE + 1) continue;
    for (const candidate of bucket) {
      const rest = bucket.filter((p) => p.id !== candidate.id).map((p) => p.unitCost);
      const productMedianCost = median(rest);
      if (productMedianCost <= 0) continue;
      const multiple = candidate.unitCost / productMedianCost;
      if (multiple >= FLAG_MULTIPLE) {
        anomalies.push({ purchase: candidate, product, productMedianCost, multiple });
      }
    }
  }
  return anomalies.sort((a, b) => b.multiple - a.multiple);
}
