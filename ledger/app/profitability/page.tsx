"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, formatNumber, todayIso } from "@/lib/format";
import { computeProductProfitability } from "@/lib/calculations";
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

const MARGIN_BAND_TONE = {
  thin: "bad",
  moderate: "amber",
  healthy: "good",
  strong: "good",
  "n/a": "default",
} as const;

const MARGIN_BAND_LABEL = {
  thin: "thin (price-competitive)",
  moderate: "moderate",
  healthy: "healthy",
  strong: "strong (differentiated)",
  "n/a": "no sales yet",
} as const;

type PeriodFilter = "all" | "30" | "90" | "month";

export default function ProfitabilityPage() {
  const {
    breakEven,
    capitalSummary,
    capitalEntries,
    addCapitalEntry,
    deleteCapitalEntry,
    settings,
    monthlyPnL,
    products,
    sales,
    saleEconomics,
    ledgers,
  } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("90");

  const hasData = monthlyPnL.length > 0;

  const { dateFrom, dateTo } = useMemo(() => {
    const today = todayIso();
    if (period === "all") return { dateFrom: undefined, dateTo: undefined };
    if (period === "month") return { dateFrom: today.slice(0, 8) + "01", dateTo: today };
    const days = period === "30" ? 30 : 90;
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { dateFrom: from, dateTo: today };
  }, [period]);

  const productProfitability = useMemo(
    () => computeProductProfitability(products, sales, saleEconomics, ledgers, dateFrom, dateTo),
    [products, sales, saleEconomics, ledgers, dateFrom, dateTo]
  );
  const rankedProfitability = useMemo(
    () => [...productProfitability].sort((a, b) => b.grossProfit - a.grossProfit),
    [productProfitability]
  );

  return (
    <>
      <PageHeader title="Profitability" />

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="text-sm font-medium">Item-level profitability</div>
            <div className="text-xs text-muted mt-0.5">
              Per product/service: units sold, selling price vs. wholesale cost, gross profit, and what&apos;s still
              tied up as inventory. Cost of goods sold moves with each unit sold (weighted-average cost), not with
              what you happen to be holding.
            </div>
          </div>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)} className="w-36 shrink-0">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </Select>
        </div>

        {rankedProfitability.length === 0 ? (
          <div className="text-xs text-muted py-6 text-center">No products or services set up yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5 mt-4">
            <div className="px-4 sm:px-5 min-w-[1000px]">
              <Table>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 px-3 font-medium text-right">Qty sold</th>
                    <th className="py-2 px-3 font-medium text-right">Avg. price</th>
                    <th className="py-2 px-3 font-medium text-right">Avg. unit cost</th>
                    <th className="py-2 px-3 font-medium text-right">Revenue</th>
                    <th className="py-2 px-3 font-medium text-right">COGS</th>
                    <th className="py-2 px-3 font-medium text-right">Gross profit</th>
                    <th className="py-2 px-3 font-medium text-right">Margin</th>
                    <th className="py-2 px-3 font-medium text-right">
                      Fully-loaded
                      <div className="text-[9px] normal-case font-normal text-muted/70">after labor</div>
                    </th>
                    <th className="py-2 px-3 font-medium text-right">On hand</th>
                    <th className="py-2 pl-3 font-medium text-right">Inventory value</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedProfitability.map((p) => (
                    <tr key={p.productId} className="border-b border-line last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{p.name}</div>
                        {p.sku && <div className="text-xs text-muted">{p.sku}</div>}
                      </td>
                      <td className="py-2.5 px-3 num text-right">{formatNumber(p.unitsSold)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(p.avgSellingPrice, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(p.avgUnitCost, currency)}</td>
                      <td className="py-2.5 px-3 num text-right">{formatMoney(p.revenue, currency)}</td>
                      <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(p.cogs, currency)}</td>
                      <td className="py-2.5 px-3 num text-right">
                        <span className={p.grossProfit >= 0 ? "text-good" : "text-bad"}>
                          {formatMoney(p.grossProfit, currency)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge tone={MARGIN_BAND_TONE[p.marginBand]}>
                          {p.grossMarginPct !== null ? `${p.grossMarginPct.toFixed(0)}%` : "—"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {p.laborCost > 0 ? (
                          <span className={p.fullyLoadedGrossProfit >= 0 ? "text-good" : "text-bad"}>
                            {p.fullyLoadedMarginPct !== null ? `${p.fullyLoadedMarginPct.toFixed(0)}%` : "—"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {p.type === "service" ? "—" : formatNumber(p.qtyOnHand)}
                      </td>
                      <td className="py-2.5 pl-3 num text-right text-muted">
                        {p.type === "service" ? "—" : formatMoney(p.inventoryValue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
        <div className="text-[11px] text-muted mt-3">
          &quot;Fully-loaded&quot; nets out the labor cost you&apos;ve set on an offering (Products page) — for a
          service an employee delivers, their pay already sits in payroll rather than COGS, so this is the number
          that shows the real margin instead of an inflated one. Blank means no labor cost is set for that item.
        </div>
        <div className="text-[11px] text-muted mt-3">
          Margin band is a rough pricing-power signal, not a verdict — thin margins often mean a commoditized,
          price-competitive item (easy substitutes, buyers shop around); strong margins often mean real
          differentiation or low price-sensitivity. Worth asking why for any item at either extreme.
        </div>
      </Card>

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
                          <button
                            onClick={() => {
                              if (!confirm("Delete this capital entry? This can't be undone.")) return;
                              deleteCapitalEntry(c.id)
                                .then(() => toast.success("Deleted"))
                                .catch(() => toast.error("Couldn't delete"));
                            }}
                            className="text-xs text-muted hover:text-bad"
                          >
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
            try {
              await addCapitalEntry(values);
              toast.success("Capital entry added", formatMoney(values.amount, currency));
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
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
