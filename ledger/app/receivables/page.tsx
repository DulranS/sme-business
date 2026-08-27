"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney } from "@/lib/format";
import type { ReceivableLine } from "@/lib/calculations";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { Badge, Card, Modal, PageHeader, Stat, Table, EmptyState } from "@/components/ui";
import { openPrintWindow, buildSaleInvoiceHtml, buildWhatsAppShareUrl, buildReceivableReminderText, type InvoicePaymentRow } from "@/lib/print";

const BUCKET_LABEL: Record<string, string> = {
  current: "Not yet due",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "90+ days overdue",
};

export default function ReceivablesPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { receivablesAging, settings, loading, receivablePayments } = useData();
  const [payingFor, setPayingFor] = useState<ReceivableLine | null>(null);
  const currency = settings.currency;

  const paymentsBySaleId = useMemo(() => {
    const map = new Map<string, InvoicePaymentRow[]>();
    for (const p of receivablePayments) {
      const rows = map.get(p.saleId) ?? [];
      rows.push({ date: p.date, method: p.method, amount: p.amount });
      map.set(p.saleId, rows);
    }
    return map;
  }, [receivablePayments]);

  if (guardLoading || !allowed) return null;

  const overdueTotal =
    receivablesAging.byBucket["1-30"] + receivablesAging.byBucket["31-60"] + receivablesAging.byBucket["61-90"] + receivablesAging.byBucket["90+"];

  return (
    <>
      <PageHeader title="Owed to You" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Stat label="Total outstanding" value={formatMoney(receivablesAging.totalOutstanding, currency)} />
        <Stat label="Overdue" value={formatMoney(overdueTotal, currency)} tone={overdueTotal > 0 ? "bad" : "default"} />
        <Stat label="90+ days" value={formatMoney(receivablesAging.byBucket["90+"], currency)} tone={receivablesAging.byBucket["90+"] > 0 ? "bad" : "default"} />
      </div>

      {!loading && receivablesAging.lines.length === 0 && (
        <EmptyState
          title="Nothing owed to you right now"
          body="Credit sales show up here until they're fully paid off. Mark a sale as 'credit' when you log it to start tracking it."
        />
      )}

      {receivablesAging.lines.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Customer</th>
                <th className="py-2 px-3 font-medium">Item</th>
                <th className="py-2 px-3 font-medium">Due</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 px-3 font-medium text-right">Owed</th>
                <th className="py-2 px-3 font-medium text-right">Collected</th>
                <th className="py-2 px-3 font-medium text-right">Still owed</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {receivablesAging.lines.map((l) => {
                const overThreshold = l.amountOutstanding >= settings.creditReviewThreshold;
                return (
                  <tr key={l.saleId} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-medium">
                      {l.customer}
                      {l.customerContact && <div className="text-[11px] text-muted font-normal">{l.customerContact}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-muted">{l.productName}</td>
                    <td className="py-2.5 px-3 num text-muted">{l.dueDate}</td>
                    <td className="py-2.5 px-3">
                      <Badge tone={l.bucket === "current" ? "default" : l.bucket === "1-30" ? "amber" : "bad"}>
                        {BUCKET_LABEL[l.bucket]}
                      </Badge>
                      {overThreshold && (
                        <span className="ml-1.5">
                          <Badge tone="bad">large</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(l.amountDue, currency)}</td>
                    <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(l.amountPaid, currency)}</td>
                    <td className="py-2.5 px-3 num text-right font-medium">{formatMoney(l.amountOutstanding, currency)}</td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          openPrintWindow(
                            buildSaleInvoiceHtml({
                              saleId: l.saleId,
                              itemName: l.productName,
                              amount: l.amountDue,
                              customer: l.customer,
                              customerContact: l.customerContact,
                              issueDate: l.date,
                              dueDate: l.dueDate,
                              payments: paymentsBySaleId.get(l.saleId) ?? [],
                              settings,
                            })
                          )
                        }
                        className="text-xs text-muted hover:text-fg mr-3"
                      >
                        Print invoice
                      </button>
                      <button onClick={() => setPayingFor(l)} className="text-xs text-amber-soft hover:underline">
                        Record payment
                      </button>
                      <a
                        href={buildWhatsAppShareUrl(
                          buildReceivableReminderText({
                            businessName: settings.businessName,
                            customer: l.customer,
                            itemName: l.productName,
                            amountOutstanding: l.amountOutstanding,
                            dueDate: l.dueDate,
                            daysOverdue: l.daysOverdue,
                            currency,
                          })
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-good hover:underline ml-3"
                      >
                        Remind on WhatsApp
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal open={!!payingFor} onClose={() => setPayingFor(null)} title="Record a payment">
        {payingFor && <RecordPaymentForm line={payingFor} onDone={() => setPayingFor(null)} />}
      </Modal>
    </>
  );
}
