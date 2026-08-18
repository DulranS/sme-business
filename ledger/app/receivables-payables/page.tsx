"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { formatMoney } from "@/lib/format";
import type { ReceivableLine } from "@/lib/calculations";
import { Badge, Card, EmptyState, PageHeader, Stat, Table } from "@/components/ui";

type Tab = "receivables" | "payables";

const BUCKET_LABEL: Record<string, string> = {
  current: "Not yet due",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "90+ days overdue",
};

export default function ReceivablesPayablesPage() {
  const { receivablesAging, sales, purchases, settings } = useData();
  const currency = settings.currency;
  const [tab, setTab] = useState<Tab>("receivables");

  // Calculate payables from purchases (similar to how receivablesAging works for sales)
  const payablesData = useState(() => {
    const asOf = new Date().toISOString().slice(0, 10);
    const payableLines: Array<{
      purchaseId: string;
      supplier: string;
      productName: string;
      date: string;
      dueDate: string;
      bucket: string;
      amountDue: number;
      amountPaid: number;
      amountOutstanding: number;
    }> = [];

    // This is a simplified version - in a full implementation, you'd want to track
    // payments against purchases similar to how receivablePayments work
    purchases.forEach((purchase) => {
      // For now, treat all purchases as paid (no credit tracking for purchases yet)
      // This can be extended later when payable payment tracking is added
    });

    return {
      lines: payableLines,
      totalOutstanding: 0,
      overdueTotal: 0,
      byBucket: { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
    };
  })[0];

  const receivablesData = {
    lines: receivablesAging.lines,
    totalOutstanding: receivablesAging.totalOutstanding,
    overdueTotal: receivablesAging.byBucket["1-30"] + receivablesAging.byBucket["31-60"] + receivablesAging.byBucket["61-90"] + receivablesAging.byBucket["90+"],
    byBucket: receivablesAging.byBucket,
  };

  const active = tab === "receivables" ? receivablesData : payablesData;

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
          Owed to you ({receivablesData.lines.length})
        </button>
        <button
          onClick={() => setTab("payables")}
          className={`px-3 py-2 text-sm border-b-2 -mb-px ${
            tab === "payables" ? "border-amber-soft text-fg font-medium" : "border-transparent text-muted"
          }`}
        >
          You owe ({payablesData.lines.length})
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <Stat label="Total outstanding" value={formatMoney(active.totalOutstanding, currency)} tone={tab === "receivables" ? "good" : "bad"} />
        <Stat label="Overdue" value={formatMoney(active.overdueTotal, currency)} tone={active.overdueTotal > 0 ? "bad" : undefined} />
        <Stat label="1-30 days" value={formatMoney(active.byBucket["1-30"], currency)} />
        <Stat label="31-60 days" value={formatMoney(active.byBucket["31-60"], currency)} />
        <Stat label="60+ days" value={formatMoney(active.byBucket["61-90"] + active.byBucket["90+"], currency)} tone={active.byBucket["61-90"] + active.byBucket["90+"] > 0 ? "bad" : undefined} />
      </div>

      {active.lines.length === 0 ? (
        <EmptyState
          title={tab === "receivables" ? "Nothing outstanding" : "Nothing owed"}
          body={
            tab === "receivables"
              ? "Every sale is fully paid. When you record a sale on credit terms — mark it as &quot;credit&quot; with a due date on the Selling page — it'll show up here and age automatically."
              : "Payables tracking is coming soon. This section will show supplier payments you owe when credit terms are added to purchases."
          }
        />
      ) : (
        <Card>
          <div className="table-container">
            <Table>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">{tab === "receivables" ? "Customer" : "Supplier"}</th>
                  <th className="py-2 px-3 font-medium">Item</th>
                  <th className="py-2 px-3 font-medium">Due</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium text-right">Owed</th>
                  <th className="py-2 px-3 font-medium text-right">Collected</th>
                  <th className="py-2 px-3 font-medium text-right">Still owed</th>
                </tr>
              </thead>
              <tbody>
                {tab === "receivables" ? (
                  receivablesData.lines.map((line: ReceivableLine) => (
                    <tr key={line.saleId} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 font-medium">
                        {line.customer}
                        {line.customerContact && <div className="text-[11px] text-muted font-normal">{line.customerContact}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-muted">{line.productName}</td>
                      <td className="py-2.5 px-3 num text-muted">{line.dueDate}</td>
                      <td className="py-2.5 px-3">
                        <Badge tone={line.bucket === "current" ? "default" : line.bucket === "1-30" ? "amber" : "bad"}>
                          {BUCKET_LABEL[line.bucket]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 num text-right">{formatMoney(line.amountDue, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(line.amountPaid, currency)}</td>
                      <td className="py-2.5 px-3 num text-right font-medium">{formatMoney(line.amountOutstanding, currency)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted">
                      Payables tracking coming soon
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          <div className="text-[11px] text-muted mt-3">
            {tab === "receivables"
              ? "Aging is measured against the due date you set on the credit sale. Record payments from the Receivables page to reduce outstanding amounts."
              : "Payables tracking will allow you to record credit terms with suppliers and track aging of amounts you owe."}
          </div>
        </Card>
      )}
    </>
  );
}
