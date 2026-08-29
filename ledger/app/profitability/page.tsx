"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
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

type PeriodFilter = "all" | "30" | "90" | "month";

export default function ProfitabilityPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const {
    breakEven,
    capitalSummary,
    capitalEntries,
    addCapitalEntry,
    updateCapitalEntry,
    deleteCapitalEntry,
    settings,
    monthlyPnL,
    products,
    sales,
    saleEconomics,
    ledgers,
    projects,
    projectFinancials,
  } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CapitalEntry | null>(null);
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

  const agingItems = useMemo(
    () =>
      [...productProfitability]
        .filter((p) => p.agingValue > 0)
        .sort((a, b) => b.agingValue - a.agingValue),
    [productProfitability]
  );
  const agingValueTotal = useMemo(() => agingItems.reduce((s, p) => s + p.agingValue, 0), [agingItems]);

  const rankedProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p.status !== "cancelled" && p.quotedPrice > 0)
      .map((p) => ({ project: p, f: projectFinancials.get(p.id) }))
      .filter((r) => r.f && r.f.marginPct !== null)
      .sort((a, b) => (a.f!.marginPct as number) - (b.f!.marginPct as number));
  }, [projects, projectFinancials]);

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader title="My Profit" />

      {agingItems.length > 0 && (
        <Card className="mb-6 border-amber/40">
          <div className="text-sm font-medium mb-0.5">Slow-moving stock</div>
          <div className="text-xs text-muted mb-3">
            Stock on hand that hasn&apos;t sold in 60+ days (or has never sold at all) — cash sitting on a shelf
            instead of in your pocket.
          </div>
          <div className="text-lg font-medium num mb-3">{formatMoney(agingValueTotal, currency)} tied up</div>
          <div className="space-y-1.5">
            {agingItems.slice(0, 8).map((p) => (
              <div key={p.productId} className="flex items-center justify-between text-xs border-b border-line last:border-0 py-1.5 gap-3">
                <div className="min-w-0 flex-1 truncate">{p.name}</div>
                <div className="text-muted shrink-0">
                  {p.lastSaleDate ? `${p.daysSinceLastSale}d since last sale` : "never sold"}
                </div>
                <div className="num font-medium shrink-0 w-24 text-right">{formatMoney(p.agingValue, currency)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex items-start sm:items-center justify-between gap-3 mb-1">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Profit by item</div>
            <div className="text-xs text-muted mt-0.5">
              For each thing you sell: how many you sold, what you charged vs. what it cost you, and how much profit
              that made. What&apos;s left in stock is valued at what you actually paid for it.
            </div>
          </div>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as PeriodFilter)} className="!w-36 shrink-0">
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
          </Select>
        </div>

        {rankedProfitability.length === 0 ? (
          <div className="text-xs text-muted py-6 text-center">Nothing set up yet — add something you sell first.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5 mt-4">
            <div className="px-4 sm:px-5 min-w-[1100px]">
              <Table>
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 px-3 font-medium text-right">How many sold</th>
                    <th className="py-2 px-3 font-medium text-right">You charged</th>
                    <th className="py-2 px-3 font-medium text-right">It cost you</th>
                    <th className="py-2 px-3 font-medium text-right">Money in</th>
                    <th className="py-2 px-3 font-medium text-right">Total cost</th>
                    <th className="py-2 px-3 font-medium text-right">Profit</th>
                    <th className="py-2 px-3 font-medium text-right">Margin</th>
                    <th className="py-2 px-3 font-medium text-right">
                      Fully-loaded
                      <div className="text-[9px] normal-case font-normal text-muted/70">after labor</div>
                    </th>
                    <th className="py-2 px-3 font-medium text-right">Left in stock</th>
                    <th className="py-2 px-3 font-medium text-right">Stock is worth</th>
                    <th className="py-2 pl-3 font-medium text-right">Aging</th>
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
                      <td className="py-2.5 px-3 num text-right text-muted">
                        {p.type === "service" ? "—" : formatMoney(p.inventoryValue, currency)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {p.type === "service" || p.qtyOnHand <= 0 ? (
                          <span className="text-muted">—</span>
                        ) : p.agingValue > 0 ? (
                          <Badge tone="amber">{p.lastSaleDate ? `${p.daysSinceLastSale}d` : "never sold"}</Badge>
                        ) : (
                          <span className="text-muted num">{p.daysSinceLastSale}d</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        )}
        <div className="text-[11px] text-muted mt-3">
          &quot;Fully-loaded&quot; also counts an employee&apos;s time (set on the Items page) — useful for a service,
          where their pay already sits elsewhere and can make the profit look better than it really is. A dash
          means no time cost is set for that item.
        </div>
        <div className="text-[11px] text-muted mt-3">
          The color is just a quick read, not a verdict — red usually means people can easily buy it cheaper
          elsewhere, green usually means it&apos;s harder to find elsewhere or people don&apos;t mind the price.
          Worth asking why for anything at either end.
        </div>
      </Card>

      {rankedProjects.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-start sm:items-center justify-between gap-3 mb-1">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Job / project profitability</div>
              <div className="text-xs text-muted mt-0.5">
                Which quoted jobs are actually making money once every cost against them is totalled up — worst
                margin first, so the ones worth a closer look surface here rather than staying buried on the
                Projects page.
              </div>
            </div>
            <Link href="/projects" className="text-xs text-amber-soft shrink-0">
              All projects →
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {rankedProjects.slice(0, 6).map(({ project, f }) => (
              <div key={project.id} className="flex items-center justify-between text-xs">
                <span className="text-fg font-medium">
                  {project.name}
                  {project.client ? <span className="text-muted font-normal"> · {project.client}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted">
                    {formatMoney(f!.totalCost, currency)} cost / {formatMoney(f!.quotedPrice, currency)} quoted
                  </span>
                  <Badge tone={(f!.marginPct ?? 0) >= 0 ? "good" : "bad"}>{f!.marginPct!.toFixed(0)}%</Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!hasData ? (
        <EmptyState
          title="Not enough data yet"
          body="Log some sales and bills first — the numbers below fill in automatically once you have."
        />
      ) : (
        <>
          <Card className="mb-6">
            <div className="text-sm font-medium mb-1">Are You Covering Your Costs?</div>
            <div className="text-xs text-muted mb-4">
              Based on your last 3 months of sales and this month&apos;s regular costs (rent, salaries, subscriptions,
              and so on).
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Stat
                label="Profit per sale"
                value={`${(breakEven.contributionMarginRatio * 100).toFixed(1)}%`}
                sub="of every dollar, after what it cost you"
              />
              <Stat label="Your costs each month" value={formatMoney(breakEven.monthlyFixedCosts, currency)} />
              <Stat
                label="You need to sell this much"
                value={Number.isFinite(breakEven.breakEvenRevenue) ? formatMoney(breakEven.breakEvenRevenue, currency) : "—"}
                sub="each month, just to cover your costs"
              />
              <Stat
                label="Cushion above that"
                value={breakEven.marginOfSafetyPct !== null ? `${breakEven.marginOfSafetyPct.toFixed(1)}%` : "—"}
                tone={
                  breakEven.marginOfSafetyPct !== null
                    ? breakEven.marginOfSafetyPct >= 0
                      ? "good"
                      : "bad"
                    : "default"
                }
                sub="how far above (or below) that you actually are"
              />
            </div>
            {breakEven.overheadCoverageRatio !== null && (
              <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
                <span className="text-xs text-muted">For every $1 of costs, your profit covers:</span>
                <Badge tone={breakEven.overheadCoverageRatio >= 1 ? "good" : "bad"}>
                  {breakEven.overheadCoverageRatio.toFixed(2)}×
                </Badge>
                <span className="text-xs text-muted">
                  {breakEven.overheadCoverageRatio >= 1
                    ? "you're covering your costs"
                    : "you're not quite covering your costs yet"}
                </span>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-start sm:items-center justify-between gap-3 mb-1">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Money You Put In</div>
                <div className="text-xs text-muted mt-0.5">
                  Money you (or an investor) put into the business, took out, and how it&apos;s doing compared to that.
                </div>
              </div>
              <Button onClick={() => { setEditingEntry(null); setModalOpen(true); }} className="shrink-0">+ Add money in/out</Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
              <Stat label="Put in" value={formatMoney(capitalSummary.totalInvested, currency)} />
              <Stat label="Taken out" value={formatMoney(capitalSummary.totalWithdrawn, currency)} />
              <Stat
                label="Profit made so far"
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
                sub={capitalSummary.roiPct !== null ? "how much you've made back, as a %" : undefined}
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
                        <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => { setEditingEntry(c); setModalOpen(true); }}
                            className="text-xs text-muted hover:text-fg mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (!confirm("Delete this entry? This can't be undone.")) return;
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingEntry ? "Edit capital entry" : "Add capital entry"}>
        <CapitalForm
          existingEntry={editingEntry ?? undefined}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              // FIX: this used to always call addCapitalEntry, even when
              // editing an existing entry — so "editing" one silently
              // created a duplicate new record instead of updating the
              // original, and the old entry never went away.
              if (editingEntry) {
                await updateCapitalEntry(editingEntry.id, values);
                toast.success("Capital entry updated", formatMoney(values.amount, currency));
              } else {
                await addCapitalEntry(values);
                toast.success("Capital entry added", formatMoney(values.amount, currency));
              }
              setModalOpen(false);
              setEditingEntry(null);
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
  existingEntry,
  onSave,
  onCancel,
}: {
  existingEntry?: CapitalEntry;
  onSave: (values: Omit<CapitalEntry, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<CapitalEntry["kind"]>(existingEntry?.kind ?? "investment");
  const [amount, setAmount] = useState(existingEntry?.amount?.toString() ?? "");
  const [date, setDate] = useState(existingEntry?.date ?? todayIso());
  const [notes, setNotes] = useState(existingEntry?.notes ?? "");
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
