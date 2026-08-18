"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import type { ReceivableLine } from "@/lib/calculations";
import { Button, Field, Input, Label, Select } from "@/components/ui";

// Used both on the Receivables page (Owner/Manager, any open credit sale)
// and on the Sales page's Staff view (their own credit sales only, via
// whichever ReceivableLine the page hands in). Recording a payment is a
// create-only action — see ReceivablePayment in lib/types.ts — so this is
// safe for Staff even though editing the underlying sale is not.
export function RecordPaymentForm({ line, onDone }: { line: ReceivableLine; onDone: () => void }) {
  const { addReceivablePayment, settings } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [amount, setAmount] = useState(line.amountOutstanding.toString());
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer">("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addReceivablePayment({
            saleId: line.saleId,
            amount: Number(amount),
            date,
            method,
            note: note || undefined,
          });
          toast.success("Payment recorded", `${formatMoney(Number(amount), currency)} from ${line.customer}`);
          onDone();
        } catch (err) {
          toast.error("Couldn't record that payment", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <div className="text-sm text-muted">
        {line.customer} owes {formatMoney(line.amountOutstanding, currency)} for {line.productName} (sold {line.date}).
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Amount received</Label>
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            max={line.amountOutstanding}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field>
          <Label>Date</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>How did they pay?</Label>
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
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
