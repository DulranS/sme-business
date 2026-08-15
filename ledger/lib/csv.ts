import Papa from "papaparse";
import type { CapitalEntry, Employee, Expense, Loan, Product, Purchase, PurchaseOrder, Sale, VariableCost } from "./types";

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
    defaultCostPrice: p.defaultCostPrice ?? "",
    defaultSellPrice: p.defaultSellPrice ?? "",
    laborCostPerUnit: p.laborCostPerUnit ?? "",
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

export function exportPurchaseOrders(purchaseOrders: PurchaseOrder[], products: Product[]) {
  const nameById = new Map(products.map((p) => [p.id, p.name]));
  const rows = purchaseOrders.map((po) => ({
    id: po.id,
    product: nameById.get(po.productId) ?? po.productId,
    productId: po.productId,
    qtyOrdered: po.qtyOrdered,
    unitCost: po.unitCost,
    orderDate: po.orderDate,
    expectedDate: po.expectedDate ?? "",
    supplier: po.supplier ?? "",
    status: po.status,
    receivedDate: po.receivedDate ?? "",
    qtyReceived: po.qtyReceived ?? "",
    receivedUnitCost: po.receivedUnitCost ?? "",
    notes: po.notes ?? "",
  }));
  downloadCsv("purchase_orders.csv", toCsv(rows));
}

export function exportEmployees(employees: Employee[]) {
  const rows = employees.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    payRate: e.payRate,
    payFrequency: e.payFrequency,
    taxPct: e.taxPct,
    startDate: e.startDate,
    endDate: e.endDate ?? "",
    active: e.active,
    notes: e.notes ?? "",
  }));
  downloadCsv("employees.csv", toCsv(rows));
}

export function exportLoans(loans: Loan[]) {
  const rows = loans.map((l) => ({
    id: l.id,
    name: l.name,
    lender: l.lender ?? "",
    principal: l.principal,
    annualInterestRatePct: l.annualInterestRatePct,
    termMonths: l.termMonths,
    startDate: l.startDate,
    active: l.active,
    notes: l.notes ?? "",
  }));
  downloadCsv("loans.csv", toCsv(rows));
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
  if (v === undefined || v.trim() === "") {
    errors.push({ row, message: `"${field}" must be a number (got "${v ?? ""}")` });
    return 0;
  }
  // Spreadsheet apps love to hand back "1,250.50", "$1,250.50", or " 1250.50 "
  // once a file has been opened, formatted, and re-saved — strip anything
  // that isn't a digit, minus sign, or decimal point before parsing, rather
  // than rejecting the whole import over formatting.
  const cleaned = v.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  if (cleaned === "" || Number.isNaN(n)) {
    errors.push({ row, message: `"${field}" must be a number (got "${v}")` });
    return 0;
  }
  return n;
}

// Same cleanup as num(), but for optional fields — blank stays blank
// (undefined) instead of becoming an error.
function optionalNum(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined;
  const cleaned = v.replace(/[^0-9.\-]/g, "");
  if (cleaned === "") return undefined;
  const n = Number(cleaned);
  return Number.isNaN(n) ? undefined : n;
}

// Accepts the common truthy/falsy spellings a spreadsheet app or a person
// typing by hand might use, not just a literal "true"/"false".
function bool(v: string | undefined, defaultVal: boolean): boolean {
  if (v === undefined || v.trim() === "") return defaultVal;
  const s = v.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return defaultVal;
}

function requiredStr(v: string | undefined, field: string, row: number, errors: ImportError[]): string {
  if (!v || !v.trim()) {
    errors.push({ row, message: `"${field}" is required` });
    return "";
  }
  return v.trim();
}

// Accepts ISO (YYYY-MM-DD), slash-separated (YYYY/MM/DD, MM/DD/YYYY), and
// dash-separated (MM-DD-YYYY) dates, and normalizes all of them to ISO.
// This matters because the moment someone opens an exported CSV in Excel or
// Google Sheets and saves it back, date cells commonly get reformatted to
// the app's regional default (usually M/D/YYYY) — rejecting anything but
// strict ISO would silently break every re-imported file.
function isoDate(v: string | undefined, field: string, row: number, errors: ImportError[]): string {
  const s = (v ?? "").trim();
  const fail = () => {
    errors.push({ row, message: `"${field}" must be a date like 2026-01-05 or 1/5/2026 (got "${v ?? ""}")` });
    return "";
  };
  if (!s) return fail();

  // Already ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD or YYYY-MM-DD variants with slashes.
  let m = s.match(/^(\d{4})[/](\d{1,2})[/](\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // M/D/YYYY or MM-DD-YYYY — the common spreadsheet default. If the first
  // number can't be a month (>12), assume it's actually D/M/YYYY instead.
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    let [, a, b, y] = m;
    let month = Number(a);
    let day = Number(b);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    if (month < 1 || month > 12 || day < 1 || day > 31) return fail();
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return fail();
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
      active: bool(r.active, true),
      orderingCost: optionalNum(r.orderingCost),
      holdingCostPct: optionalNum(r.holdingCostPct),
      leadTimeDays: optionalNum(r.leadTimeDays),
      defaultCostPrice: optionalNum(r.defaultCostPrice),
      defaultSellPrice: optionalNum(r.defaultSellPrice),
      laborCostPerUnit: optionalNum(r.laborCostPerUnit),
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
      isRecurring: bool(r.isRecurring, false),
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

export async function importEmployees(
  file: File
): Promise<ImportResult<Omit<Employee, "id" | "createdAt" | "linkedExpenseId">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const rows = data.map((r, i) => {
    const row = i + 2;
    const payFrequency = ["weekly", "monthly", "yearly"].includes((r.payFrequency ?? "").trim())
      ? (r.payFrequency!.trim() as Employee["payFrequency"])
      : "monthly";
    const active = bool(r.active, true);
    return {
      name: requiredStr(r.name, "name", row, errors),
      role: (r.role ?? "").trim(),
      payRate: num(r.payRate, "payRate", row, errors),
      payFrequency,
      taxPct: optionalNum(r.taxPct) ?? 0,
      startDate: isoDate(r.startDate, "startDate", row, errors),
      endDate: r.endDate?.trim() || undefined,
      active,
      notes: (r.notes ?? "").trim() || undefined,
    };
  });
  return { rows, errors };
}

export async function importLoans(file: File): Promise<ImportResult<Omit<Loan, "id" | "createdAt">>> {
  const { data } = await parseCsvFile(file);
  const errors: ImportError[] = [];
  const rows = data.map((r, i) => {
    const row = i + 2;
    return {
      name: requiredStr(r.name, "name", row, errors),
      lender: (r.lender ?? "").trim() || undefined,
      principal: num(r.principal, "principal", row, errors),
      annualInterestRatePct: num(r.annualInterestRatePct, "annualInterestRatePct", row, errors),
      termMonths: num(r.termMonths, "termMonths", row, errors),
      startDate: isoDate(r.startDate, "startDate", row, errors),
      active: bool(r.active, true),
      notes: (r.notes ?? "").trim() || undefined,
    };
  });
  return { rows, errors };
}

// Purchase orders import only ever creates newly-placed orders ("ordered"
// status) — any status/receivedDate/qtyReceived columns in the file are
// ignored. Receiving an order updates the inventory ledger and must go
// through the app's receive flow (Orders page) so stock stays correct;
// importing a "received" row directly would silently create stock the
// costing engine never actually saw arrive.
export async function importPurchaseOrders(
  file: File,
  products: Product[]
): Promise<ImportResult<Omit<PurchaseOrder, "id" | "createdAt" | "status" | "receivedDate" | "qtyReceived" | "receivedUnitCost">>> {
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
      qtyOrdered: num(r.qtyOrdered, "qtyOrdered", row, errors),
      unitCost: num(r.unitCost, "unitCost", row, errors),
      orderDate: isoDate(r.orderDate, "orderDate", row, errors),
      expectedDate: r.expectedDate?.trim() ? isoDate(r.expectedDate, "expectedDate", row, errors) : undefined,
      supplier: (r.supplier ?? "").trim() || undefined,
      notes: (r.notes ?? "").trim() || undefined,
    };
  });
  return { rows, errors };
}
