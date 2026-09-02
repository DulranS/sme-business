import JSZip from "jszip";
import {
  toCsv,
  productsRows,
  purchasesRows,
  salesRows,
  expensesRows,
  variableCostsRows,
  capitalEntriesRows,
  purchaseOrdersRows,
  employeesRows,
  loansRows,
} from "./csv";
import type {
  CapitalEntry,
  Employee,
  Expense,
  Loan,
  Product,
  Purchase,
  PurchaseOrder,
  Sale,
  Settings,
  VariableCost,
} from "./types";

export interface BackupData {
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
  expenses: Expense[];
  variableCosts: VariableCost[];
  capitalEntries: CapitalEntry[];
  purchaseOrders: PurchaseOrder[];
  employees: Employee[];
  loans: Loan[];
  settings: Settings;
}

// One zip containing every entity CSV already offered individually on the
// Import/Export page, so "what if this goes down" has a single-click answer
// without adding a second export format to maintain. Re-importable: every
// file inside is byte-identical to what "Export CSV" produces for that
// entity, so restoring is just re-importing each file the normal way.
export async function downloadFullBackupZip(data: BackupData) {
  const zip = new JSZip();
  const today = new Date().toISOString().slice(0, 10);

  zip.file("products.csv", toCsv(productsRows(data.products)));
  zip.file("purchases.csv", toCsv(purchasesRows(data.purchases, data.products)));
  zip.file("sales.csv", toCsv(salesRows(data.sales, data.products)));
  zip.file("expenses.csv", toCsv(expensesRows(data.expenses)));
  zip.file("variable_costs.csv", toCsv(variableCostsRows(data.variableCosts, data.products)));
  zip.file("capital_entries.csv", toCsv(capitalEntriesRows(data.capitalEntries)));
  zip.file("purchase_orders.csv", toCsv(purchaseOrdersRows(data.purchaseOrders, data.products)));
  zip.file("employees.csv", toCsv(employeesRows(data.employees)));
  zip.file("loans.csv", toCsv(loansRows(data.loans)));

  const manifest = [
    `Ledger backup — ${today}`,
    "",
    `Business: ${data.settings.businessName?.trim() || "(no business name set)"}`,
    `Currency: ${data.settings.currency}`,
    "",
    "Contents:",
    `  products.csv          ${data.products.length} row(s)`,
    `  purchases.csv         ${data.purchases.length} row(s)`,
    `  sales.csv              ${data.sales.length} row(s)`,
    `  expenses.csv           ${data.expenses.length} row(s)`,
    `  variable_costs.csv    ${data.variableCosts.length} row(s)`,
    `  capital_entries.csv   ${data.capitalEntries.length} row(s)`,
    `  purchase_orders.csv   ${data.purchaseOrders.length} row(s)`,
    `  employees.csv          ${data.employees.length} row(s)`,
    `  loans.csv              ${data.loans.length} row(s)`,
    "",
    "To restore: go to Import / export and import each CSV file individually.",
    "Each file matches the format that page already expects — no reformatting needed.",
  ].join("\n");
  zip.file("backup-info.txt", manifest);

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-backup-${today}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
