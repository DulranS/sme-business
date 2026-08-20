"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import type { ReceivableLine, PayableLine } from "@/lib/calculations";
import type { ReceivablePayment, PayablePayment } from "@/lib/types";
import { RecordPaymentForm } from "@/components/RecordPaymentForm";
import { RecordPayablePaymentForm } from "@/components/RecordPayablePaymentForm";
import { Badge, Button, Card, EmptyState, Field, Input, Label, Modal, PageHeader, Select, Stat, Table } from "@/components/ui";

type Tab = "receivables" | "payables";

const BUCKET_LABEL: Record<string, string> = {
  current: "Not yet due",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "90+ days overdue",
};

export default function ReceivablesPayablesPage() {
  const { role } = useAuth();
  const {
    receivablesAging,
    payablesAging,
    receivablePayments,
    payablePayments,
    updateReceivablePayment,
    deleteReceivablePayment,
    updatePayablePayment,
    deletePayablePayment,
    settings,
  } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const isOwner = role === "owner";
  const [tab, setTab] = useState<Tab>("receivables");
  const [payingReceivable, setPayingReceivable] = useState<ReceivableLine | null>(null);
  const [payingPayable, setPayingPayable] = useState<PayableLine | null>(null);
  const [editingReceivablePayment, setEditingReceivablePayment] = useState<ReceivablePayment | null>(null);
  const [editingPayablePayment, setEditingPayablePayment] = useState<PayablePayment | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const receivablesData = {
    lines: receivablesAging.lines,
    totalOutstanding: receivablesAging.totalOutstanding,
    overdueTotal: receivablesAging.byBucket["1-30"] + receivablesAging.byBucket["31-60"] + receivablesAging.byBucket["61-90"] + receivablesAging.byBucket["90+"],
    byBucket: receivablesAging.byBucket,
  };

  const payablesData = {
    lines: payablesAging.lines,
    totalOutstanding: payablesAging.totalOutstanding,
    overdueTotal: payablesAging.byBucket["1-30"] + payablesAging.byBucket["31-60"] + payablesAging.byBucket["61-90"] + payablesAging.byBucket["90+"],
    byBucket: payablesAging.byBucket,
  };

  const active = tab === "receivables" ? receivablesData : payablesData;
  const historyForTab = [...(tab === "receivables" ? receivablePayments : payablePayments)].sort(
    (a, b) => b.createdAt - a.createdAt
  );

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
              ? "Every sale is fully paid. When you record a sale on credit terms — mark it as \"credit\" with a due date on the Selling page — it'll show up here and age automatically."
              : "Every purchase is fully paid. When you record a purchase on credit terms — mark it as \"credit\" with a due date on the Buying page — it'll show up here and age automatically."
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
                  <th className="py-2 px-3 font-medium text-right">Paid</th>
                  <th className="py-2 px-3 font-medium text-right">Still owed</th>
                  <th className="py-2 pl-3 font-medium text-right">·</th>
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
                      <td className="py-2.5 pl-3 text-right">
                        <button onClick={() => setPayingReceivable(line)} className="text-xs text-amber-soft hover:opacity-80">
                          Record payment
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  payablesData.lines.map((line: PayableLine) => (
                    <tr key={line.purchaseId} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{line.supplier}</td>
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
                      <td className="py-2.5 pl-3 text-right">
                        <button onClick={() => setPayingPayable(line)} className="text-xs text-amber-soft hover:opacity-80">
                          Record payment
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
          <div className="text-[11px] text-muted mt-3">
            {tab === "receivables"
              ? "Aging is measured against the due date you set on the credit sale. Record payments to reduce outstanding amounts — each payment is its own dated record, so partial payments are tracked exactly."
              : "Aging is measured against the due date you set on the credit purchase. Record payments to reduce outstanding amounts — each payment is its own dated record, so partial payments are tracked exactly."}
          </div>
        </Card>
      )}

      {isOwner && historyForTab.length > 0 && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Payment history &amp; corrections</div>
              <div className="text-xs text-muted mt-0.5">
                Every payment ever recorded on this tab. As owner, you can fix a mis-keyed amount, date or method —
                everyone else can only ever add a new payment, never edit one.
              </div>
            </div>
            <button onClick={() => setShowHistory((v) => !v)} className="text-xs text-amber-soft shrink-0 ml-4">
              {showHistory ? "Hide" : `Show (${historyForTab.length})`}
            </button>
          </div>

          {showHistory && (
            <div className="mt-4 space-y-1.5">
              {historyForTab.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line last:border-0">
                  <div>
                    <span className="num font-medium">{formatMoney(p.amount, currency)}</span>{" "}
                    <span className="text-muted text-xs">
                      · {p.date} · {p.method.replace("_", " ")} · {p.createdByName ?? "—"}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() =>
                        tab === "receivables"
                          ? setEditingReceivablePayment(p as ReceivablePayment)
                          : setEditingPayablePayment(p as PayablePayment)
                      }
                      className="text-xs text-muted hover:text-fg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm("Delete this payment record? This can't be undone.")) return;
                        const del = tab === "receivables" ? deleteReceivablePayment : deletePayablePayment;
                        del(p.id)
                          .then(() => toast.success("Deleted"))
                          .catch((err) => toast.error("Couldn't delete", toastableErrorMessage(err)));
                      }}
                      className="text-xs text-muted hover:text-bad"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal open={!!payingReceivable} onClose={() => setPayingReceivable(null)} title="Record a payment">
        {payingReceivable && <RecordPaymentForm line={payingReceivable} onDone={() => setPayingReceivable(null)} />}
      </Modal>

      <Modal open={!!payingPayable} onClose={() => setPayingPayable(null)} title="Record a payment">
        {payingPayable && <RecordPayablePaymentForm line={payingPayable} onDone={() => setPayingPayable(null)} />}
      </Modal>

      <Modal open={!!editingReceivablePayment} onClose={() => setEditingReceivablePayment(null)} title="Correct this payment">
        {editingReceivablePayment && (
          <EditPaymentForm
            payment={editingReceivablePayment}
            currency={currency}
            onSave={async (patch) => {
              try {
                await updateReceivablePayment(editingReceivablePayment.id, patch);
                toast.success("Payment corrected");
                setEditingReceivablePayment(null);
              } catch (err) {
                toast.error("Couldn't save", toastableErrorMessage(err));
              }
            }}
            onCancel={() => setEditingReceivablePayment(null)}
          />
        )}
      </Modal>

      <Modal open={!!editingPayablePayment} onClose={() => setEditingPayablePayment(null)} title="Correct this payment">
        {editingPayablePayment && (
          <EditPaymentForm
            payment={editingPayablePayment}
            currency={currency}
            onSave={async (patch) => {
              try {
                await updatePayablePayment(editingPayablePayment.id, patch);
                toast.success("Payment corrected");
                setEditingPayablePayment(null);
              } catch (err) {
                toast.error("Couldn't save", toastableErrorMessage(err));
              }
            }}
            onCancel={() => setEditingPayablePayment(null)}
          />
        )}
      </Modal>
    </>
  );
}

function EditPaymentForm({
  payment,
  currency,
  onSave,
  onCancel,
}: {
  payment: ReceivablePayment | PayablePayment;
  currency: string;
  onSave: (patch: { amount?: number; date?: string; method?: "cash" | "card" | "bank_transfer"; note?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(payment.amount.toString());
  const [date, setDate] = useState(payment.date);
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer">(payment.method);
  const [note, setNote] = useState(payment.note ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ amount: Number(amount), date, method, note: note || undefined });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Amount</Label>
          <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field>
          <Label>Date</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />
        </Field>
      </div>
      <Field>
        <Label>Method</Label>
        <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
        </Select>
      </Field>
      <Field>
        <Label>Note (optional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="text-[11px] text-muted">Currency: {currency}</div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save correction"}
        </Button>
      </div>
    </form>
  );
}
