"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useData } from "@/contexts/DataContext";
import { forecastRevenue, computeMRR } from "@/lib/calculations";
import { formatMoney, formatMonth, formatNumber, todayIso } from "@/lib/format";
import { Card, PageHeader, Stat, Table, Badge, EmptyState } from "@/components/ui";

export default function DashboardPage() {
  const {
    loading,
    products,
    monthlyPnL,
    inventoryValue,
    inventoryUnits,
    expenses,
    settings,
    ledgers,
    breakEven,
  } = useData();

  const currency = settings.currency;
  const forecast = useMemo(
    () => forecastRevenue(monthlyPnL, settings.forecastMonths),
    [monthlyPnL, settings.forecastMonths]
  );
  const mrr = useMemo(() => computeMRR(expenses, todayIso()), [expenses]);

  const latest = monthlyPnL[monthlyPnL.length - 1];
  const oversold = useMemo(() => {
    const items: { name: string; qty: number }[] = [];
    for (const p of products) {
      const l = ledgers.get(p.id);
      if (l && l.qtyOnHand < 0) items.push({ name: p.name, qty: l.qtyOnHand });
    }
    return items;
  }, [products, ledgers]);

  if (loading) {
    return <div className="text-sm text-muted">Loading your numbers…</div>;
  }

  if (products.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="Nothing set up yet"
          body="Add your first product or service, then log a purchase/cost entry and a sale — this page fills in automatically."
        />
      </>
    );
  }

  const chartData = forecast.map((f) => ({
    month: formatMonth(f.month),
    Actual: f.actual,
    Trend: Math.round(f.trend),
    "3-mo avg": f.movingAvg !== null ? Math.round(f.movingAvg) : null,
  }));

  return (
    <>
      <PageHeader title="Dashboard" />

      {oversold.length > 0 && (
        <Card className="mb-5 border-bad/30">
          <div className="text-sm font-medium text-bad mb-1">Oversold inventory</div>
          <div className="text-xs text-muted">
            {oversold.map((o) => `${o.name} (${o.qty} on hand)`).join(", ")} — recorded sales exceed
            recorded purchases. Check your entries in Purchases/Sales.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat
          label="This month revenue"
          value={formatMoney(latest?.totalRevenue ?? 0, currency)}
          sub={latest ? `${formatNumber(latest.unitsSold)} units sold` : undefined}
        />
        <Stat
          label="Gross profit"
          value={formatMoney(latest?.grossProfit ?? 0, currency)}
          tone={latest && latest.grossProfit >= 0 ? "good" : "bad"}
        />
        <Stat
          label="Net profit (after tax)"
          value={formatMoney(latest?.netProfitAfterTax ?? 0, currency)}
          tone={latest && latest.netProfitAfterTax >= 0 ? "good" : "bad"}
          sub={`tax rate ${settings.taxRatePct}%`}
        />
        <Stat label="Inventory value" value={formatMoney(inventoryValue, currency)} tone="amber" />
        <Stat label="Units on hand" value={formatNumber(inventoryUnits)} />
        <Stat
          label="Recurring net (MRR)"
          value={formatMoney(mrr.mrrRevenue - mrr.mrrExpense, currency)}
          sub={`${formatMoney(mrr.mrrRevenue, currency)} in / ${formatMoney(mrr.mrrExpense, currency)} out`}
        />
      </div>

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Revenue trend &amp; forecast</div>
            <div className="text-xs text-muted mt-0.5">
              Linear trend + {settings.forecastMonths}-month projection
            </div>
          </div>
        </div>
        {monthlyPnL.length < 2 ? (
          <div className="text-xs text-muted py-8 text-center">
            Log sales across at least two months to see a trend line.
          </div>
        ) : (
          <div className="h-64 sm:h-80 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262C3A" />
                <XAxis dataKey="month" stroke="#8A92A6" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#8A92A6"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => formatMoney(v, currency)}
                  width={80}
                />
                <Tooltip
                  contentStyle={{ background: "#171C28", border: "1px solid #262C3A", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => formatMoney(v, currency)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Actual" stroke="#E0A467" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
                <Line type="monotone" dataKey="Trend" stroke="#5B87C9" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                <Line type="monotone" dataKey="3-mo avg" stroke="#4C9A6A" strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-medium mb-4">Monthly P&amp;L</div>
        {monthlyPnL.length === 0 ? (
          <div className="text-xs text-muted py-6 text-center">No sales or expenses recorded yet.</div>
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="py-2 px-3 font-medium text-right">Revenue</th>
                <th className="py-2 px-3 font-medium text-right">COGS</th>
                <th className="py-2 px-3 font-medium text-right">Gross</th>
                <th className="py-2 px-3 font-medium text-right">OpEx</th>
                <th className="py-2 pl-3 font-medium text-right">Net (after tax)</th>
              </tr>
            </thead>
            <tbody>
              {[...monthlyPnL].reverse().map((m) => (
                <tr key={m.month} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 text-fg">{formatMonth(m.month)}</td>
                  <td className="py-2.5 px-3 num text-right">{formatMoney(m.totalRevenue, currency)}</td>
                  <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(m.cogs, currency)}</td>
                  <td className="py-2.5 px-3 num text-right">{formatMoney(m.grossProfit, currency)}</td>
                  <td className="py-2.5 px-3 num text-right text-muted">{formatMoney(m.operatingExpenses, currency)}</td>
                  <td className="py-2.5 pl-3 num text-right">
                    <Badge tone={m.netProfitAfterTax >= 0 ? "good" : "bad"}>
                      {formatMoney(m.netProfitAfterTax, currency)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Is the business actually profitable?</div>
            <div className="text-xs text-muted mt-0.5">
              {breakEven.overheadCoverageRatio !== null
                ? breakEven.overheadCoverageRatio >= 1
                  ? `Gross profit is covering overhead ${breakEven.overheadCoverageRatio.toFixed(2)}× over.`
                  : `Gross profit is only covering ${(breakEven.overheadCoverageRatio * 100).toFixed(0)}% of overhead — still short.`
                : "Log some expenses to see overhead coverage."}
            </div>
          </div>
          <Link href="/profitability" className="text-xs text-amber-soft shrink-0 ml-4">
            Break-even &amp; ROI →
          </Link>
        </div>
      </Card>
    </>
  );
}
