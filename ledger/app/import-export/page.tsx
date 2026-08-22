"use client";

import { useRef, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useRequireRole } from "@/lib/roleGuard";
import {
  exportCapitalEntries,
  exportEmployees,
  exportExpenses,
  exportLoans,
  exportProducts,
  exportPurchaseOrders,
  exportPurchases,
  exportSales,
  exportVariableCosts,
  importCapitalEntries,
  importEmployees,
  importExpenses,
  importLoans,
  importProducts,
  importPurchaseOrders,
  importPurchases,
  importSales,
  type ImportError,
} from "@/lib/csv";
import { Button, Card, PageHeader } from "@/components/ui";

type Entity = "products" | "purchases" | "sales" | "expenses" | "capitalEntries" | "employees" | "loans" | "purchaseOrders";

export default function ImportExportPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner"]);
  const data = useData();
  const [result, setResult] = useState<{ entity: Entity; added: number; errors: ImportError[] } | null>(null);
  const [busy, setBusy] = useState<Entity | null>(null);
  const inputRefs = {
    products: useRef<HTMLInputElement>(null),
    purchases: useRef<HTMLInputElement>(null),
    sales: useRef<HTMLInputElement>(null),
    expenses: useRef<HTMLInputElement>(null),
    capitalEntries: useRef<HTMLInputElement>(null),
    employees: useRef<HTMLInputElement>(null),
    loans: useRef<HTMLInputElement>(null),
    purchaseOrders: useRef<HTMLInputElement>(null),
  };

  async function handleImport(entity: Entity, file: File) {
    setBusy(entity);
    setResult(null);
    try {
      if (entity === "products") {
        const { rows, errors } = await importProducts(file);
        if (errors.length === 0) await data.bulkAddProducts(rows);
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else if (entity === "purchases") {
        const { rows, errors } = await importPurchases(file, data.products);
        if (errors.length === 0) await data.bulkAddPurchases(rows);
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else if (entity === "sales") {
        const { rows, errors } = await importSales(file, data.products);
        if (errors.length === 0) await data.bulkAddSales(rows);
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else if (entity === "expenses") {
        const { rows, errors } = await importExpenses(file);
        if (errors.length === 0) await data.bulkAddExpenses(rows);
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else if (entity === "capitalEntries") {
        const { rows, errors } = await importCapitalEntries(file);
        if (errors.length === 0) {
          for (const row of rows) await data.addCapitalEntry(row);
        }
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else if (entity === "employees") {
        const { rows, errors } = await importEmployees(file);
        if (errors.length === 0) {
          for (const row of rows) await data.addEmployee(row);
        }
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else if (entity === "loans") {
        const { rows, errors } = await importLoans(file);
        if (errors.length === 0) await data.bulkAddLoans(rows);
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      } else {
        const { rows, errors } = await importPurchaseOrders(file, data.products);
        if (errors.length === 0) await data.bulkAddPurchaseOrders(rows.map((r) => ({ ...r, status: "ordered" as const })));
        setResult({ entity, added: errors.length === 0 ? rows.length : 0, errors });
      }
    } finally {
      setBusy(null);
    }
  }

  const rows: {
    entity: Entity;
    label: string;
    description: string;
    columns: string;
    onExport: () => void;
  }[] = [
    {
      entity: "products",
      label: "What you sell",
      description: "Your items and services — what you buy and keep in stock, or what you do as a service.",
      columns: "name, sku, category, type (product/service), active, orderingCost, holdingCostPct, leadTimeDays, defaultCostPrice, defaultSellPrice, laborCostPerUnit",
      onExport: () => exportProducts(data.products),
    },
    {
      entity: "purchases",
      label: "Things you bought",
      description: "Wholesale buys for items, or delivery cost entries for services.",
      columns: "product (or productId), qty, unitCost, date (e.g. 2026-01-05 or 1/5/2026), supplier, notes",
      onExport: () => exportPurchases(data.purchases, data.products),
    },
    {
      entity: "sales",
      label: "Things you sold",
      description: "What you sold, how many, and for how much each.",
      columns: "product (or productId), qty, unitPrice, date (e.g. 2026-01-05 or 1/5/2026), customer, notes",
      onExport: () => exportSales(data.sales, data.products),
    },
    {
      entity: "expenses",
      label: "Bills & recurring income",
      description: "Running costs (marketing, rent, payroll) and any recurring income.",
      columns: "name, amount, category, kind (expense/revenue), isRecurring (true/false), recurrence (weekly/monthly/yearly), startDate, endDate",
      onExport: () => exportExpenses(data.expenses),
    },
    {
      entity: "capitalEntries",
      label: "Money put in / taken out",
      description: "Initial investment, reinvestment, and owner withdrawals.",
      columns: "kind (investment/reinvestment/withdrawal), amount, date (e.g. 2026-01-05 or 1/5/2026), notes",
      onExport: () => exportCapitalEntries(data.capitalEntries),
    },
    {
      entity: "employees",
      label: "Employees & payroll",
      description: "Staff/contractors — importing books each one's pay as a recurring bill automatically.",
      columns: "name, role, payRate, payFrequency (weekly/monthly/yearly), taxPct, startDate, endDate, active, notes",
      onExport: () => exportEmployees(data.employees),
    },
    {
      entity: "loans",
      label: "Loans & debt",
      description: "Bank/supplier loans — monthly payment and interest are worked out for you automatically.",
      columns: "name, lender, principal, annualInterestRatePct, termMonths, startDate, active, notes",
      onExport: () => exportLoans(data.loans),
    },
    {
      entity: "purchaseOrders",
      label: "Wholesale orders",
      description: "Orders placed with a supplier that haven't arrived yet. Importing always creates a new open order — receiving one still happens on the Orders page, so your stock stays accurate.",
      columns: "product (or productId), qtyOrdered, unitCost, orderDate, expectedDate, supplier, notes",
      onExport: () => exportPurchaseOrders(data.purchaseOrders, data.products),
    },
  ];

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader title="Import / export" />
      <div className="space-y-4">
        {rows.map((row) => (
          <Card key={row.entity}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="text-xs text-muted mt-0.5">{row.description}</div>
                <div className="text-[11px] text-muted mt-1 font-mono">{row.columns}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" onClick={row.onExport}>
                  Export CSV
                </Button>
                <input
                  ref={inputRefs[row.entity]}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImport(row.entity, file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  disabled={
                    busy === row.entity ||
                    (["purchases", "sales", "purchaseOrders"].includes(row.entity) && data.products.length === 0)
                  }
                  onClick={() => inputRefs[row.entity].current?.click()}
                >
                  {busy === row.entity ? "Importing…" : "Import CSV"}
                </Button>
              </div>
            </div>

            {result?.entity === row.entity && (
              <div className="mt-3 text-xs">
                {result.errors.length === 0 ? (
                  <div className="text-good">Added {result.added} rows.</div>
                ) : (
                  <div className="text-bad space-y-1">
                    <div>{result.errors.length} row(s) had a problem — nothing was added yet. Fix these and try again:</div>
                    <ul className="list-disc list-inside text-muted">
                      {result.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                    {result.errors.length > 10 && <div className="text-muted">…and {result.errors.length - 10} more.</div>}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Extra costs per sale</div>
              <div className="text-xs text-muted mt-0.5">Export only — set these up on the Items page.</div>
            </div>
            <Button variant="ghost" onClick={() => exportVariableCosts(data.variableCosts, data.products)}>
              Export CSV
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
