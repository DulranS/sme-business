"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { Badge, Card } from "@/components/ui";
import { QuickSaleForm, QuickStockForm, QuickExpenseForm } from "@/components/QuickForms";
import { describeEntry } from "./entryDescribe";
import type { ProposedEntry } from "@/lib/aiTypes";

// Renders one AI-proposed entry pre-filled into the exact same
// QuickSaleForm/QuickStockForm/QuickExpenseForm used by the manual "I sold
// something" / "I bought stock" / "I paid a bill" quick actions — same
// validation, same useData().addSale/addPurchase/addExpense call, same
// audit trail. The AI never gets a shortcut past that path; it only ever
// gets to pre-fill the form a human still reviews and submits.
export function ProposedEntryCard({
  entry,
  onStatusChange,
}: {
  entry: ProposedEntry;
  onStatusChange?: (status: "confirmed" | "discarded") => void;
}) {
  const { settings } = useData();
  const [status, setStatus] = useState<"pending" | "confirmed" | "discarded">(entry.status ?? "pending");

  const label = entry.kind === "sale" ? "Proposed sale" : entry.kind === "purchase" ? "Proposed purchase" : "Proposed expense";
  const icon = entry.kind === "sale" ? "💰" : entry.kind === "purchase" ? "📦" : "🧾";

  if (status === "discarded") {
    return (
      <Card className="opacity-60 py-3">
        <div className="text-xs text-muted">Discarded — {describeEntry(entry, settings.currency)}</div>
      </Card>
    );
  }

  if (status === "confirmed") {
    return (
      <Card className="border-good/30 py-3">
        <div className="flex items-center gap-2 text-sm text-good">
          <span>✓</span>
          <span>Logged — {describeEntry(entry, settings.currency)}</span>
        </div>
      </Card>
    );
  }

  const lowConfidence = entry.confidence !== undefined && entry.confidence < 0.6;
  const unmatchedProduct = (entry.kind === "sale" || entry.kind === "purchase") && !entry.matchedProductId;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium flex items-center gap-1.5">
            <span>{icon}</span>
            {label}
          </div>
          <div className="text-sm text-fg mt-0.5">{describeEntry(entry, settings.currency)}</div>
        </div>
        {(lowConfidence || unmatchedProduct) && (
          <Badge tone="amber">{unmatchedProduct ? "pick a product" : "double-check"}</Badge>
        )}
      </div>

      {entry.kind === "sale" && (
        <QuickSaleForm
          initial={{
            productId: entry.matchedProductId,
            qty: entry.qty,
            unitPrice: entry.unitPrice,
            date: entry.date,
            customer: entry.customer,
            paymentMethod: entry.paymentMethod,
            notes: entry.notes,
          }}
          onDone={() => {
            setStatus("confirmed");
            onStatusChange?.("confirmed");
          }}
        />
      )}
      {entry.kind === "purchase" && (
        <QuickStockForm
          initial={{
            productId: entry.matchedProductId,
            qty: entry.qty,
            unitCost: entry.unitCost,
            date: entry.date,
            supplier: entry.supplier,
            notes: entry.notes,
          }}
          onDone={() => {
            setStatus("confirmed");
            onStatusChange?.("confirmed");
          }}
        />
      )}
      {entry.kind === "expense" && (
        <QuickExpenseForm
          initial={{
            name: entry.name,
            amount: entry.amount,
            category: entry.category,
            isRecurring: entry.isRecurring,
            date: entry.date,
          }}
          onDone={() => {
            setStatus("confirmed");
            onStatusChange?.("confirmed");
          }}
        />
      )}

      <button
        type="button"
        className="text-xs text-muted hover:text-bad mt-3"
        onClick={() => {
          setStatus("discarded");
          onStatusChange?.("discarded");
        }}
      >
        Discard this suggestion
      </button>
    </Card>
  );
}
