import Papa from "papaparse";
import type { CapitalEntry, Expense, Product, Purchase, Sale, VariableCost } from "./types";

// ---------------------------------------------------------------------------
// Export: flat CSV per entity. Kept as separate files (one per collection)
// rather than one mega-CSV, since the schemas don't share columns and mixing
// them forces a lot of empty cells / ambiguity on re-import.
// ---------------------------------------------------------------------------

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  return Papa.unparse(rows);
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProducts(products: Product[]) {
  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    type: p.type,
    active: p.active,
    orderingCost: p.orderingCost ?? "",
    holdingCostPct: p.holdingCostPct ?? "",
    leadTimeDays: p.leadTimeDays ?? "",
  }));
  downloadCsv("products.csv", toCsv(rows));
}

export function exportPurchases(purchases: Purchase[], products: Product[]) {
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const rows = purchases.map((p) => ({
    id: p.id,
    product: nameById.get(p.productId) ?? p.productId,
    productId: p.productId,
    qty: p.qty,
    unitCost: p.unitCost,
    date: p.date,
    supplier: p.supplier ?? "",
    notes: p.notes ?? "",
  }));
  downloadCsv("purchases.csv", toCsv(rows));
}

export function exportSales(sales: Sale[], products: Product[]) {
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const rows = sales.map((s) => ({
    id: s.id,
    product: nameById.get(s.productId) ?? s.productId,
    productId: s.productId,
    qty: s.qty,
    unitPrice: s.unitPrice,
    date: s.date,
    customer: s.customer ?? "",
    notes: s.notes ?? "",
  }));
  downloadCsv("sales.csv", toCsv(rows));
}

export function exportExpenses(expenses: Expense[]) {
  const rows = expenses.map((e) => ({
    id: e.id,
    name: e.name,
    amount: e.amount,
    category: e.category,
    kind: e.kind,
    isRecurring: e.isRecurring,
    recurrence: e.recurrence,
    startDate: e.startDate,
    endDate: e.endDate ?? "",
  }));
  downloadCsv("expenses.csv", toCsv(rows));
}

export function exportVariableCosts(variableCosts: VariableCost[], products: Product[]) {
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const rows = variableCosts.map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    amount: v.amount,
    product: v.productId ? nameById.get(v.productId) ?? v.productId : "(all products)",
    productId: v.productId ?? "",
  }));
  downloadCsv("variable_costs.csv", toCsv(rows));
}

export function exportCapitalEntries(entries: CapitalEntry[]) {
  const rows = entries.map((c) => ({
    id: c.id,
    kind: c.kind,
    amount: c.amount,
    date: c.date,
    notes: c.notes ?? "",
  }));
  downloadCsv("capital_entries.csv", toCsv(rows));
}

// ---------------------------------------------------------------------------
// Import: parse + validate before returning rows to the caller for a Firestore
// batch write. Validation is intentionally strict (reject the whole file with
// a row-level error report) rather than silently skipping bad rows, since
// this is financial data.
// ---------------------------------------------------------------------------

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult<T> {
  rows: T[];
  errors: ImportError[];
}

function parseCsvFile(file: File): Promise<Papa.ParseResult<Record<string, string>>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results),
      error: (err: Error) => reject(err),
    });
  });
}

function num(v: string | undefined, field: string, row: number, errors: ImportError[]): number {
  const n = Number(v);
  if (v === undefined || v === "" || Number.isNaN(n)) {
    errors.push({ row, message: `"${field}" must be a number (got "${v ?? ""}")` });
    return 0;
  }
  return n;
}

function requiredStr(v: string | undefined, field: string, row: number, errors: ImportError[]): string {
  if (!v || !v.trim()) {
    errors.push({ row, message: `"${field}" is required` });
    return "";
  }
  return v.trim();
}

function isoDate(v: string | undefined, field: string, row: number, errors: ImportError[]): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
    errors.push({ row, message: `"${field}" must be an ISO date (YYYY-MM-DD), got "${v ?? ""}"` });
    return "";
  }
  return v.trim();
}

export async function importProducts(file: File): Promise<ImportResult<Omit<Product, "id" | "createdAt">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const rows = data.map((r, i) => {
    const type = (r.type ?? "product").trim().toLowerCase() === "service" ? "service" : "product";
    return {
      name: requiredStr(r.name, "name", i + 2, errors),
      sku: (r.sku ?? "").trim(),
      category: (r.category ?? "").trim(),
      type: type as Product["type"],
      active: r.active === undefined ? true : String(r.active).toLowerCase() !== "false",
      orderingCost: r.orderingCost ? Number(r.orderingCost) : undefined,
      holdingCostPct: r.holdingCostPct ? Number(r.holdingCostPct) : undefined,
      leadTimeDays: r.leadTimeDays ? Number(r.leadTimeDays) : undefined,
    };
  });
  return { rows, errors };
}

// Purchases/sales resolve a "product" name column against existing products
// (by name or sku), and can also fall back to a raw productId column.
export async function importPurchases(
  file: File,
  products: Product[]
): Promise<ImportResult<Omit<Purchase, "id" | "createdAt">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const byNameOrSku = new Map<string, string>();
  for (const p of products) {
    byNameOrSku.set(p.name.toLowerCase(), p.id);
    if (p.sku) byNameOrSku.set(p.sku.toLowerCase(), p.id);
  }

  const rows = data.map((r, i) => {
    const row = i + 2;
    let productId = (r.productId ?? "").trim();
    if (!productId) {
      const key = (r.product ?? "").trim().toLowerCase();
      productId = byNameOrSku.get(key) ?? "";
      if (!productId) errors.push({ row, message: `Unknown product "${r.product ?? ""}"` });
    }
    return {
      productId,
      qty: num(r.qty, "qty", row, errors),
      unitCost: num(r.unitCost, "unitCost", row, errors),
      date: isoDate(r.date, "date", row, errors),
      supplier: (r.supplier ?? "").trim(),
      notes: (r.notes ?? "").trim(),
    };
  });
  return { rows, errors };
}

export async function importSales(
  file: File,
  products: Product[]
): Promise<ImportResult<Omit<Sale, "id" | "createdAt">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const byNameOrSku = new Map<string, string>();
  for (const p of products) {
    byNameOrSku.set(p.name.toLowerCase(), p.id);
    if (p.sku) byNameOrSku.set(p.sku.toLowerCase(), p.id);
  }

  const rows = data.map((r, i) => {
    const row = i + 2;
    let productId = (r.productId ?? "").trim();
    if (!productId) {
      const key = (r.product ?? "").trim().toLowerCase();
      productId = byNameOrSku.get(key) ?? "";
      if (!productId) errors.push({ row, message: `Unknown product "${r.product ?? ""}"` });
    }
    return {
      productId,
      qty: num(r.qty, "qty", row, errors),
      unitPrice: num(r.unitPrice, "unitPrice", row, errors),
      date: isoDate(r.date, "date", row, errors),
      customer: (r.customer ?? "").trim(),
      notes: (r.notes ?? "").trim(),
    };
  });
  return { rows, errors };
}

export async function importExpenses(file: File): Promise<ImportResult<Omit<Expense, "id" | "createdAt">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const rows = data.map((r, i) => {
    const row = i + 2;
    const kind = (r.kind ?? "expense").trim().toLowerCase() === "revenue" ? "revenue" : "expense";
    const recurrence = ["weekly", "monthly", "yearly", "none"].includes((r.recurrence ?? "").trim())
      ? (r.recurrence!.trim() as Expense["recurrence"])
      : "none";
    return {
      name: requiredStr(r.name, "name", row, errors),
      amount: num(r.amount, "amount", row, errors),
      category: (r.category ?? "").trim(),
      kind: kind as Expense["kind"],
      isRecurring: String(r.isRecurring).toLowerCase() === "true",
      recurrence,
      startDate: isoDate(r.startDate, "startDate", row, errors),
      endDate: r.endDate?.trim() || undefined,
    };
  });
  return { rows, errors };
}

export async function importCapitalEntries(
  file: File
): Promise<ImportResult<Omit<CapitalEntry, "id" | "createdAt">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const rows = data.map((r, i) => {
    const row = i + 2;
    const kind = ["investment", "reinvestment", "withdrawal"].includes((r.kind ?? "").trim())
      ? (r.kind!.trim() as CapitalEntry["kind"])
      : "investment";
    return {
      kind,
      amount: num(r.amount, "amount", row, errors),
      date: isoDate(r.date, "date", row, errors),
      notes: (r.notes ?? "").trim() || undefined,
    };
  });
  return { rows, errors };
}
