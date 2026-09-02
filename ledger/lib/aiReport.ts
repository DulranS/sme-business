// Backs the assistant's "run_report" tool (see app/api/ai/chat/route.ts).
// The model's only job is picking WHICH question is being asked (metric +
// date range + filter) — every number in the answer comes from this file,
// not from the model. That split is the whole point: natural-language
// query is low-risk because the AI is a UI layer over numbers that are
// already correct, never a second source of truth for arithmetic.
//
// Deliberately simpler than lib/calculations.ts's WAC/COGS engine: this
// answers quick cash-basis questions ("how much did I spend on packaging
// last quarter") from raw expense/purchase/sale rows, not the full
// inventory-costed P&L. Anything needing that precision, the assistant's
// reply points at the Profitability/Statements pages instead of guessing.

import type { Expense, Purchase, Sale } from "./types";

export type ReportMetric =
  | "expense_total"
  | "expense_by_category"
  | "sale_total"
  | "sale_by_product"
  | "purchase_total"
  | "purchase_by_supplier"
  | "net_cashflow";

export interface ReportQuery {
  metric: ReportMetric;
  startDate: string; // ISO date, inclusive
  endDate: string; // ISO date, inclusive
  category?: string;
  productName?: string; // matched case-insensitively/substring against Sale.productId's product name (resolved by caller) or Purchase.supplier
  supplier?: string;
  productNameById?: Map<string, string>; // productId -> name, so sale/purchase rows can be filtered/labeled by product name
}

export interface ReportResult {
  metric: ReportMetric;
  startDate: string;
  endDate: string;
  total: number;
  count: number;
  breakdown?: { label: string; amount: number }[]; // top entries, for *_by_* metrics
  currency: string;
}

function inRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

function topBreakdown(map: Map<string, number>, limit = 8): { label: string; amount: number }[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, amount]) => ({ label, amount }));
}

export function runReport(
  query: ReportQuery,
  data: { expenses: Expense[]; purchases: Purchase[]; sales: Sale[] },
  currency: string
): ReportResult {
  const { startDate, endDate } = query;
  const base = { metric: query.metric, startDate, endDate, currency };

  switch (query.metric) {
    case "expense_total":
    case "expense_by_category": {
      const rows = data.expenses.filter(
        (e) =>
          e.kind === "expense" &&
          !e.isRecurring && // recurring bills are counted once at creation elsewhere; a date-ranged total should only include actual one-off spend rows to avoid double counting a monthly rent line every time it's queried
          inRange(e.startDate, startDate, endDate) &&
          (!query.category || e.category === query.category)
      );
      const total = rows.reduce((s, e) => s + e.amount, 0);
      if (query.metric === "expense_total") return { ...base, total, count: rows.length };
      const byCategory = new Map<string, number>();
      for (const e of rows) byCategory.set(e.category || "Uncategorized", (byCategory.get(e.category || "Uncategorized") ?? 0) + e.amount);
      return { ...base, total, count: rows.length, breakdown: topBreakdown(byCategory) };
    }

    case "sale_total":
    case "sale_by_product": {
      const rows = data.sales.filter((s) => inRange(s.date, startDate, endDate));
      const filtered = query.productName
        ? rows.filter((s) => (query.productNameById?.get(s.productId) ?? "").toLowerCase().includes(query.productName!.toLowerCase()))
        : rows;
      const total = filtered.reduce((sum, s) => sum + s.qty * s.unitPrice, 0);
      if (query.metric === "sale_total") return { ...base, total, count: filtered.length };
      const byProduct = new Map<string, number>();
      for (const s of filtered) {
        const name = query.productNameById?.get(s.productId) ?? s.productId;
        byProduct.set(name, (byProduct.get(name) ?? 0) + s.qty * s.unitPrice);
      }
      return { ...base, total, count: filtered.length, breakdown: topBreakdown(byProduct) };
    }

    case "purchase_total":
    case "purchase_by_supplier": {
      const rows = data.purchases.filter(
        (p) =>
          inRange(p.date, startDate, endDate) &&
          (!query.supplier || (p.supplier ?? "").toLowerCase().includes(query.supplier!.toLowerCase())) &&
          (!query.productName ||
            (query.productNameById?.get(p.productId) ?? "").toLowerCase().includes(query.productName!.toLowerCase()))
      );
      const total = rows.reduce((sum, p) => sum + p.qty * p.unitCost, 0);
      if (query.metric === "purchase_total") return { ...base, total, count: rows.length };
      const bySupplier = new Map<string, number>();
      for (const p of rows) bySupplier.set(p.supplier || "Unknown supplier", (bySupplier.get(p.supplier || "Unknown supplier") ?? 0) + p.qty * p.unitCost);
      return { ...base, total, count: rows.length, breakdown: topBreakdown(bySupplier) };
    }

    case "net_cashflow": {
      const revenue = data.sales.filter((s) => inRange(s.date, startDate, endDate)).reduce((sum, s) => sum + s.qty * s.unitPrice, 0);
      const expenseRows = data.expenses.filter((e) => e.kind === "expense" && !e.isRecurring && inRange(e.startDate, startDate, endDate));
      const purchaseRows = data.purchases.filter((p) => inRange(p.date, startDate, endDate));
      const expenseTotal = expenseRows.reduce((s, e) => s + e.amount, 0);
      const purchaseTotal = purchaseRows.reduce((s, p) => s + p.qty * p.unitCost, 0);
      const total = revenue - expenseTotal - purchaseTotal;
      return {
        ...base,
        total,
        count: data.sales.length + expenseRows.length + purchaseRows.length,
        breakdown: [
          { label: "Sales revenue", amount: revenue },
          { label: "Stock/materials bought", amount: -purchaseTotal },
          { label: "One-off bills", amount: -expenseTotal },
        ],
      };
    }
  }
}
