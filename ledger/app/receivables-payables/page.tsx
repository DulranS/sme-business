"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import type { AgingLineItem } from "@/lib/calculations";
import { Badge, Card, EmptyState, PageHeader, Stat, Table } from "@/components/ui";

type Tab = "receivables" | "payables";

export default function ReceivablesPayablesPage() {
  const { receivables, payables, sales, purchases, updateSale, updatePurchase, settings } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const [tab, setTab] = useState<Tab>("receivables");

  const active = tab === "receivables" ? receivables : payables;

  async function markPaid(item: AgingLineItem) {
    try {
      if (tab === "receivables") {
        const sale = sales.find((s) => s.id === item.id);
        if (!sale) return;
        await updateSale(sale.id, { paymentStatus: "paid", paidDate: todayIso(), amountPaid: sale.unitPrice * sale.qty });
      } else {
        const purchase = purchases.find((p) => p.id === item.id);
        if (!purchase) return;
        await updatePurchase(purchase.id, {
          paymentStatus: "paid",
          paidDate: todayIso(),
          amountPaid: purchase.qty * purchase.unitCost,
        });
      }
      toast.success("Marked as paid", item.label);
    } catch (err) {
      toast.error("Couldn't update", toastableErrorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Money owed" />

      <div className="flex gap-2 mb-5 border-b border-line">
        <button
          onClick={() => setTab("receivables")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            tab === "receivables" ? "border-amber-soft text-fg font-medium" : "border-transparent text-muted"
          }`}
        >
          Owed to you ({receivables.items.length})
        </button>
        <button
          onClick={() => setTab("payables")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            tab === "payables" ? "border-amber-soft text-fg font-medium" : "border-transparent text-muted"
          }`}
        >
          You owe ({payables.items.length})
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <Stat label="Total outstanding" value={formatMoney(active.totalOutstanding, currency)} tone={tab === "receivables" ? "good" : "bad"} />
        <Stat label="Overdue" value={formatMoney(active.overdueTotal, currency)} tone={active.overdueTotal > 0 ? "bad" : undefined} />
        <Stat label="1-30 days" value={formatMoney(active.byBucket["1-30"], currency)} />
        <Stat label="31-60 days" value={formatMoney(active.byBucket["31-60"], currency)} />
        <Stat label="60+ days" value={formatMoney(active.byBucket["61-90"] + active.byBucket["90+"], currency)} tone={active.byBucket["61-90"] + active.byBucket["90+"] > 0 ? "bad" : undefined} />
      </div>

      {active.items.length === 0 ? (
        <EmptyState
          title={tab === "receivables" ? "Nothing outstanding" : "Nothing owed"}
          body={
            tab === "receivables"
              ? "Every sale is fully paid. When you record a sale on credit terms — mark it &quot;unpaid&quot; or &quot;partial&quot; with a due date on the Selling page — it'll show up here and age automatically."
              : "Every purchase is fully paid. When you record a purchase on credit terms — mark it &quot;unpaid&quot; or &quot;partial&quot; with a due date on the Buying page — it'll show up here and age automatically."
          }
        />
      ) : (
        <Card>
          <div className="table-container">
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">{tab === "receivables" ? "Customer" : "Supplier"}</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Due</th>
                  <th className="py-2 px-3 font-medium text-right">Total</th>
                  <th className="py-2 px-3 font-medium text-right">Paid</th>
                  <th className="py-2 px-3 font-medium text-right">Outstanding</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
                </tr>
              </thead>
              <tbody>
                {active.items.map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{item.label}</td>
                    <td className="py-2.5 px-3 text-muted text-xs">{item.date}</td>
                    <td className="py-2.5 px-3 text-muted text-xs">{item.dueDate ?? "—"}</td>
                    <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(item.fullAmount, currency)}</td>
                    <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(item.amountPaid, currency)}</td>
                    <td className="py-2.5 px-3 num text-right font-medium">{formatMoney(item.outstanding, currency)}</td>
                    <td className="py-2.5 px-3">
                      {item.bucket === "current" ? (
                        <Badge>not yet due</Badge>
                      ) : (
                        <Badge tone="bad">{item.daysOverdue}d overdue</Badge>
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => markPaid(item)} className="text-xs text-amber-soft hover:opacity-80">
                        Mark paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="text-[11px] text-muted mt-3">
            Aging is measured against the due date you set on the sale/purchase — or, if none was set, 30 days
            after the transaction date. &quot;Mark paid&quot; records full payment today; for a partial payment, edit the
            record directly from the Selling/Buying page instead.
          </div>
        </Card>
      )}
    </>
  );
}
