"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import { Badge, Button, Card, Field, Input, Label, PageHeader, Table, EmptyState } from "@/components/ui";

const VARIANCE_TOLERANCE = 1; // rounding-level tolerance, in currency units, before a variance is flagged at all

export default function CashCountPage() {
  const { role } = useAuth();
  const { cashCounts, settings, addCashCount, loading } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [date, setDate] = useState(todayIso());
  const [openingFloat, setOpeningFloat] = useState(settings.defaultOpeningFloat.toString());
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = [...cashCounts].sort((a, b) => b.createdAt - a.createdAt);
  const isOwnerOrManager = role === "owner" || role === "manager";

  return (
    <>
      <PageHeader title="Count the Till" />

      <Card className="mb-6">
        <div className="text-sm text-muted mb-4">
          {isOwnerOrManager
            ? "Count the cash in the till at the end of a shift or day. We work out what should be there from cash sales and cash payments in, and cash spent out — you just tell us what's actually in the drawer."
            : "End of your shift, count the cash in the till and enter it here. This gets logged with your name and can't be edited afterward — if you make a mistake, tell your manager."}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await addCashCount({
                date,
                openingFloat: Number(openingFloat) || 0,
                countedCash: Number(countedCash) || 0,
                notes: notes || undefined,
              });
              toast.success("Cash count saved");
              setCountedCash("");
              setNotes("");
            } catch (err) {
              toast.error("Couldn't save that count", toastableErrorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>Date</Label>
              <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field>
              <Label>Opening float</Label>
              <Input required type="number" min="0" step="0.01" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
            </Field>
          </div>
          <Field>
            <Label>Cash actually counted in the till</Label>
            <Input required type="number" min="0" step="0.01" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} autoFocus />
          </Field>
          <Field>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Rs 500 note looked fake, set aside" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save count"}
            </Button>
          </div>
        </form>
      </Card>

      {!loading && sorted.length === 0 && <EmptyState title="No counts yet" body="Your first cash count will show up here." />}

      {sorted.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                {isOwnerOrManager && <th className="py-2 px-3 font-medium">Counted by</th>}
                <th className="py-2 px-3 font-medium text-right">Expected</th>
                <th className="py-2 px-3 font-medium text-right">Counted</th>
                <th className="py-2 pl-3 font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const flagged = Math.abs(c.variance) > VARIANCE_TOLERANCE;
                return (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 num text-muted">{c.date}</td>
                    {isOwnerOrManager && <td className="py-2.5 px-3">{c.createdByName ?? "—"}</td>}
                    <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(c.expectedCash, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(c.countedCash, currency)}</td>
                    <td className="py-2.5 pl-3 num text-right">
                      {flagged ? (
                        <Badge tone={c.variance < 0 ? "bad" : "amber"}>
                          {c.variance < 0 ? "-" : "+"}
                          {formatMoney(Math.abs(c.variance), currency)}
                        </Badge>
                      ) : (
                        <span className="text-good">Matched</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
