"use client";

import { useRef, useState } from "react";
import { useData } from "@/contexts/DataContext";
import {
  exportCapitalEntries,
  exportExpenses,
  exportProducts,
  exportPurchases,
  exportSales,
  exportVariableCosts,
  importCapitalEntries,
  importExpenses,
  importProducts,
  importPurchases,
  importSales,
  type ImportError,
} from "@/lib/csv";
import { Button, Card, PageHeader } from "@/components/ui";

type Entity = "products" | "purchases" | "sales" | "expenses" | "capitalEntries";

export default function ImportExportPage() {
  const data = useData();
  const [result, setResult] = useState<{ entity: Entity; added: number; errors: ImportError[] } | null>(null);
  const [busy, setBusy] = useState<Entity | null>(null);
  const inputRefs = {
    products: useRef<HTMLInputElement>(null),
    purchases: useRef<HTMLInputElement>(null),
    sales: useRef<HTMLInputElement>(null),
    expenses: useRef<HTMLInputElement>(null),
    capitalEntries: useRef<HTMLInputElement>(null),
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
      } else {
        const { rows, errors } = await importCapitalEntries(file);
        if (errors.length === 0) {
          for (const row of rows) await data.addCapitalEntry(row);
        }
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
      label: "Products & services",
      description: "Your catalog — physical items and service/labor offerings.",
      columns: "name, sku, category, type (product/service), active, orderingCost, holdingCostPct, leadTimeDays",
      onExport: () => exportProducts(data.products),
    },
    {
      entity: "purchases",
      label: "Purchases & cost entries",
      description: "Wholesale buys for products, or delivery cost entries for services.",
      columns: "product (or productId), qty, unitCost, date (YYYY-MM-DD), supplier, notes",
      onExport: () => exportPurchases(data.purchases, data.products),
    },
    {
      entity: "sales",
      label: "Sales",
      description: "What you sold, quantity and unit price.",
      columns: "product (or productId), qty, unitPrice, date (YYYY-MM-DD), customer, notes",
      onExport: () => exportSales(data.sales, data.products),
    },
    {
      entity: "expenses",
      label: "Expenses & recurring revenue",
      description: "Operating costs (incl. marketing, rent, payroll) and recurring income.",
      columns: "name, amount, category, kind (expense/revenue), isRecurring (true/false), recurrence (weekly/monthly/yearly), startDate, endDate",
      onExport: () => exportExpenses(data.expenses),
    },
    {
      entity: "capitalEntries",
      label: "Capital entries",
      description: "Initial investment, reinvestment, and owner withdrawals.",
      columns: "kind (investment/reinvestment/withdrawal), amount, date (YYYY-MM-DD), notes",
      onExport: () => exportCapitalEntries(data.capitalEntries),
    },
  ];

  return (
    <>
      <PageHeader title="Import / export" />
      <div className="space-y-4">
        {rows.map((row) => (
          <Card key={row.entity}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
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
                  disabled={busy === row.entity || (row.entity !== "products" && row.entity !== "capitalEntries" && data.products.length === 0)}
                  onClick={() => inputRefs[row.entity].current?.click()}
                >
                  {busy === row.entity ? "Importing…" : "Import CSV"}
                </Button>
              </div>
            </div>

            {result?.entity === row.entity && (
              <div className="mt-3 text-xs">
                {result.errors.length === 0 ? (
                  <div className="text-good">Imported {result.added} rows successfully.</div>
                ) : (
                  <div className="text-bad space-y-1">
                    <div>{result.errors.length} row(s) failed — nothing was imported. Fix and retry:</div>
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Variable costs</div>
              <div className="text-xs text-muted mt-0.5">Export only — manage these on the Products page.</div>
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
