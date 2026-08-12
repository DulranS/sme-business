"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { formatMoney, todayIso } from "@/lib/format";
import type { CapitalEntry } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Stat,
  Table,
  EmptyState,
} from "@/components/ui";

export default function ProfitabilityPage() {
  const { breakEven, capitalSummary, capitalEntries, addCapitalEntry, deleteCapitalEntry, settings, monthlyPnL } =
    useData();
  const currency = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);

  const hasData = monthlyPnL.length > 0;

  return (
    <>
      <PageHeader title="Profitability" />

      {!hasData ? (
        <EmptyState
          title="Not enough data yet"
          body="Log some sales and expenses first — break-even, overhead coverage, and ROI all build off your monthly P&L."
        />
      ) : (
        <>
          <Card className="mb-6">
            <div className="text-sm font-medium mb-1">Break-even &amp; overhead coverage</div>
            <div className="text-xs text-muted mb-4">
              Blended contribution margin across your last 3 months of sales, applied to this month&apos;s fixed
              costs (rent, salaries, subscriptions, marketing, etc).
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Stat
                label="Contribution margin"
                value={`${(breakEven.contributionMarginRatio * 100).toFixed(1)}%`}
                sub="of revenue, after COGS + variable costs"
              />
              <Stat label="Fixed costs / mo" value={formatMoney(breakEven.monthlyFixedCosts, currency)} />
              <Stat
                label="Break-even revenue"
                value={Number.isFinite(breakEven.breakEvenRevenue) ? formatMoney(breakEven.breakEvenRevenue, currency) : "—"}
                sub="needed per month to cover fixed costs"
              />
              <Stat
                label="Margin of safety"
                value={breakEven.marginOfSafetyPct !== null ? `${breakEven.marginOfSafetyPct.toFixed(1)}%` : "—"}
                tone={
                  breakEven.marginOfSafetyPct !== null
                    ? breakEven.marginOfSafetyPct >= 0
                      ? "good"
                      : "bad"
                    : "default"
                }
                sub="how far actual revenue is above/below break-even"
              />
            </div>
            {breakEven.overheadCoverageRatio !== null && (
              <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
                <span className="text-xs text-muted">Overhead coverage ratio (gross profit ÷ operating expenses):</span>
                <Badge tone={breakEven.overheadCoverageRatio >= 1 ? "good" : "bad"}>
                  {breakEven.overheadCoverageRatio.toFixed(2)}×
                </Badge>
                <span className="text-xs text-muted">
                  {breakEven.overheadCoverageRatio >= 1
                    ? "gross profit is covering overhead"
                    : "gross profit is not yet covering overhead"}
                </span>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-sm font-medium">Capital &amp; ROI</div>
                <div className="text-xs text-muted mt-0.5">
                  Initial investment, reinvestment, and withdrawals — tracked separately from operating P&amp;L.
                </div>
              </div>
              <Button onClick={() => setModalOpen(true)}>+ Add entry</Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
              <Stat label="Total invested" value={formatMoney(capitalSummary.totalInvested, currency)} />
              <Stat label="Total withdrawn" value={formatMoney(capitalSummary.totalWithdrawn, currency)} />
              <Stat
                label="Cumulative net profit"
                value={formatMoney(capitalSummary.cumulativeNetProfit, currency)}
                tone={capitalSummary.cumulativeNetProfit >= 0 ? "good" : "bad"}
              />
              <Stat
                label={capitalSummary.paybackReached ? "Payback reached" : "Net position"}
                value={
                  capitalSummary.roiPct !== null
                    ? `${capitalSummary.roiPct >= 0 ? "+" : ""}${capitalSummary.roiPct.toFixed(1)}%`
                    : formatMoney(capitalSummary.netPosition, currency)
                }
                tone={capitalSummary.paybackReached ? "good" : "amber"}
                sub={capitalSummary.roiPct !== null ? "return on invested capital" : undefined}
              />
            </div>

            {capitalEntries.length > 0 && (
              <div className="mt-5">
                <Table>
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 px-3 font-medium">Kind</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                      <th className="py-2 px-3 font-medium">Notes</th>
                      <th className="py-2 pl-3 font-medium text-right">·</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capitalEntries.map((c) => (
                      <tr key={c.id} className="border-b border-line last:border-0">
                        <td className="py-2.5 pr-3 text-muted num">{c.date}</td>
                        <td className="py-2.5 px-3">
                          <Badge tone={c.kind === "withdrawal" ? "bad" : "good"}>{c.kind}</Badge>
                        </td>
                        <td className="py-2.5 px-3 num text-right">{formatMoney(c.amount, currency)}</td>
                        <td className="py-2.5 px-3 text-muted">{c.notes || "—"}</td>
                        <td className="py-2.5 pl-3 text-right">
                          <button onClick={() => deleteCapitalEntry(c.id)} className="text-xs text-muted hover:text-bad">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add capital entry">
        <CapitalForm
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            await addCapitalEntry(values);
            setModalOpen(false);
          }}
        />
      </Modal>
    </>
  );
}

function CapitalForm({
  onSave,
  onCancel,
}: {
  onSave: (values: Omit<CapitalEntry, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<CapitalEntry["kind"]>("investment");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ kind, amount: Number(amount), date, notes });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Kind</Label>
        <Select value={kind} onChange={(e) => setKind(e.target.value as CapitalEntry["kind"])}>
          <option value="investment">Initial investment</option>
          <option value="reinvestment">Reinvestment</option>
          <option value="withdrawal">Owner withdrawal</option>
        </Select>
      </Field>
      <Field>
        <Label>Amount</Label>
        <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field>
        <Label>Date</Label>
        <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
