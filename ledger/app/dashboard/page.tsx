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
import { forecastRevenue, computeMRR, computeFixedAssetsNetValue } from "@/lib/calculations";
import { formatMoney, formatMonth, formatNumber, todayIso } from "@/lib/format";
import { Card, PageHeader, Stat, Table, Badge, EmptyState } from "@/components/ui";
import QuickActionBar from "@/components/QuickActionBar";

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
    openOrders,
    monthlyPayroll,
    loanPortfolio,
    eoqByProduct,
    onOrderByProduct,
    growthRates,
    operationalMetrics,
    receivables,
    payables,
    fixedAssets,
  } = useData();

  const currency = settings.currency;
  const assetsNetBookValue = useMemo(
    () => computeFixedAssetsNetValue(fixedAssets, todayIso()),
    [fixedAssets]
  );
  const forecast = useMemo(
    () => forecastRevenue(monthlyPnL, settings.forecastMonths),
    [monthlyPnL, settings.forecastMonths]
  );
  const mrr = useMemo(() => computeMRR(expenses, todayIso()), [expenses]);

  const latest = monthlyPnL.find((m) => m.month === todayIso().slice(0, 7)) ?? monthlyPnL[monthlyPnL.length - 1];
  const oversold = useMemo(() => {
    const items: { name: string; qty: number }[] = [];
    for (const p of products) {
      const l = ledgers.get(p.id);
      if (l && l.qtyOnHand < 0) items.push({ name: p.name, qty: l.qtyOnHand });
    }
    return items;
  }, [products, ledgers]);

  // Below-reorder-point products, net of anything already on order. This is
  // the single most common way an SME loses a sale it should've had —
  // finding out you're out of stock only when a customer asks. Surfacing it
  // on the dashboard (rather than only on the Products page, one click
  // deeper) is the point.
  const reorderAlerts = useMemo(() => {
    const items: { id: string; name: string; qtyOnHand: number; reorderPoint: number; onOrder: number; eoq: number }[] = [];
    for (const p of products) {
      if (!p.active || p.type !== "product") continue;
      const l = ledgers.get(p.id);
      const eoq = eoqByProduct.get(p.id);
      if (!l || !eoq || eoq.reorderPoint <= 0) continue;
      const onOrder = onOrderByProduct.get(p.id) ?? 0;
      if (l.qtyOnHand + onOrder <= eoq.reorderPoint) {
        items.push({ id: p.id, name: p.name, qtyOnHand: l.qtyOnHand, reorderPoint: eoq.reorderPoint, onOrder, eoq: eoq.eoq });
      }
    }
    return items.sort((a, b) => a.qtyOnHand - b.qtyOnHand);
  }, [products, ledgers, eoqByProduct, onOrderByProduct]);

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
        <div className="flex justify-center mt-4">
          <Link href="/products" className="text-sm text-amber-soft hover:underline">
            Add your first product or service →
          </Link>
        </div>
      </>
    );
  }

  const chartData = forecast.map((f) => ({
    month: formatMonth(f.month),
    Actual: f.actual,
    Trend: Math.round(f.trend),
    "3-mo avg": f.movingAvg !== null ? Math.round(f.movingAvg) : null,
  }));

  const marginChartData = monthlyPnL.map((m) => ({
    month: formatMonth(m.month),
    "Gross margin": m.grossMarginPct !== null ? Math.round(m.grossMarginPct * 10) / 10 : null,
    "Net margin": m.netMarginPct !== null ? Math.round(m.netMarginPct * 10) / 10 : null,
  }));

  return (
    <>
      <PageHeader title="Dashboard" />

      <QuickActionBar />

      {oversold.length > 0 && (
        <Card className="mb-5 border-bad/30">
          <div className="text-sm font-medium text-bad mb-1">You&apos;ve sold more than you have</div>
          <div className="text-xs text-muted">
            {oversold.map((o) => `${o.name} (${o.qty} in stock)`).join(", ")} — you&apos;ve recorded selling more
            than you&apos;ve recorded buying. Double-check your entries in Buying/Selling.
          </div>
        </Card>
      )}

      {reorderAlerts.length > 0 && (
        <Card className="mb-5 border-amber-dim/40">
          <div className="text-sm font-medium text-amber-soft mb-1">Running low — buy more soon</div>
          <div className="text-xs text-muted mb-3">
            You&apos;re getting close to running out of these — order more now so you don&apos;t sell out before
            the new stock arrives.
          </div>
          <div className="space-y-2">
            {reorderAlerts.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs">
                <span className="text-fg font-medium">{r.name}</span>
                <span className="text-muted">
                  {formatNumber(r.qtyOnHand)} left
                  {r.onOrder > 0 ? ` (+${formatNumber(r.onOrder)} on the way)` : ""} · buy about
                  {" "}
                  {formatNumber(Math.round(r.eoq))}
                </span>
              </div>
            ))}
          </div>
          <Link href="/purchase-orders" className="text-xs text-amber-soft mt-3 inline-block">
            Order more stock →
          </Link>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat
          label="Money in this month"
          value={formatMoney(latest?.totalRevenue ?? 0, currency)}
          sub={latest ? `${formatNumber(latest.unitsSold)} units sold` : undefined}
        />
        <Stat
          label="Profit this month"
          value={formatMoney(latest?.grossProfit ?? 0, currency)}
          tone={latest && latest.grossProfit >= 0 ? "good" : "bad"}
        />
        <Stat
          label="What's really left (after tax)"
          value={formatMoney(latest?.netProfitAfterTax ?? 0, currency)}
          tone={latest && latest.netProfitAfterTax >= 0 ? "good" : "bad"}
          sub={`tax rate ${settings.taxRatePct}%`}
        />
        <Stat
          label="Regular money in/out"
          value={formatMoney(mrr.mrrRevenue - mrr.mrrExpense, currency)}
          sub={`${formatMoney(mrr.mrrRevenue, currency)} in / ${formatMoney(mrr.mrrExpense, currency)} out`}
        />
        <Stat label="Stock is worth" value={formatMoney(inventoryValue, currency)} tone="amber" />
        <Stat label="Items in stock" value={formatNumber(inventoryUnits)} />
        <Link href="/receivables-payables">
          <Stat
            label="Customers owe you"
            value={formatMoney(receivables.totalOutstanding, currency)}
            tone={receivables.overdueTotal > 0 ? "bad" : receivables.totalOutstanding > 0 ? "amber" : "default"}
            sub={receivables.overdueTotal > 0 ? `${formatMoney(receivables.overdueTotal, currency)} overdue` : undefined}
          />
        </Link>
        <Link href="/receivables-payables">
          <Stat
            label="You owe suppliers"
            value={formatMoney(payables.totalOutstanding, currency)}
            tone={payables.overdueTotal > 0 ? "bad" : payables.totalOutstanding > 0 ? "amber" : "default"}
            sub={payables.overdueTotal > 0 ? `${formatMoney(payables.overdueTotal, currency)} overdue` : undefined}
          />
        </Link>
        <Stat
          label="On the way (ordered)"
          value={formatMoney(openOrders.openOrderValue, currency)}
          sub={openOrders.openOrderCount > 0 ? `${openOrders.openOrderCount} open order(s)` : "nothing pending"}
        />
        <Stat label="Staff pay / month" value={formatMoney(monthlyPayroll, currency)} tone={monthlyPayroll > 0 ? "bad" : "default"} />
        <Stat
          label="You owe"
          value={formatMoney(loanPortfolio.totalOutstanding, currency)}
          tone={loanPortfolio.totalOutstanding > 0 ? "bad" : "default"}
          sub={loanPortfolio.loanCount > 0 ? `${loanPortfolio.loanCount} loan(s)` : undefined}
        />
        <Stat label="Loan payments / month" value={formatMoney(loanPortfolio.totalMonthlyPayment, currency)} />
        {fixedAssets.length > 0 && (
          <Link href="/assets">
            <Stat label="Equipment & assets" value={formatMoney(assetsNetBookValue, currency)} sub="net book value" />
          </Link>
        )}
        {operationalMetrics.averageOrderValue > 0 && (
          <Stat
            label="Avg order value"
            value={formatMoney(operationalMetrics.averageOrderValue, currency)}
            sub="per sale this month"
          />
        )}
        {operationalMetrics.revenuePerEmployee !== null && operationalMetrics.revenuePerEmployee > 0 && (
          <Stat
            label="Revenue per employee"
            value={formatMoney(operationalMetrics.revenuePerEmployee, currency)}
            sub="monthly"
          />
        )}
        {operationalMetrics.inventoryTurnoverRate !== null && operationalMetrics.inventoryTurnoverRate > 0 && (
          <Stat
            label="Inventory turnover"
            value={operationalMetrics.inventoryTurnoverRate.toFixed(1)}
            sub="times per year"
          />
        )}
        {operationalMetrics.daysOfInventoryOnHand !== null && operationalMetrics.daysOfInventoryOnHand > 0 && (
          <Stat
            label="Days of inventory"
            value={Math.round(operationalMetrics.daysOfInventoryOnHand).toString()}
            sub="on hand"
            tone={operationalMetrics.daysOfInventoryOnHand > 90 ? "bad" : operationalMetrics.daysOfInventoryOnHand > 60 ? "amber" : "good"}
          />
        )}
        {operationalMetrics.cashRunwayMonths !== null && operationalMetrics.cashRunwayMonths > 0 && (
          <Stat
            label="Cash runway"
            value={`${Math.round(operationalMetrics.cashRunwayMonths)} months`}
            sub="at current burn rate"
            tone={operationalMetrics.cashRunwayMonths < 3 ? "bad" : operationalMetrics.cashRunwayMonths < 6 ? "amber" : "good"}
          />
        )}
        {settings.monthlyOwnerDraw ? (
          <Stat
            label="True profit (after paying yourself)"
            value={formatMoney((latest?.economicProfit ?? 0), currency)}
            tone={(latest?.economicProfit ?? 0) >= 0 ? "good" : "bad"}
            sub={`after ${formatMoney(settings.monthlyOwnerDraw, currency)}/mo imputed owner pay`}
          />
        ) : (
          <Stat
            label="True profit (after paying yourself)"
            value="—"
            sub="set your monthly pay in Settings"
          />
        )}
      </div>

      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-medium">Revenue trend &amp; forecast</div>
            <div className="text-xs text-muted mt-0.5">
              Linear trend + {settings.forecastMonths}-month projection
            </div>
          </div>
          {growthRates.momRevenuePct !== null && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone={growthRates.momRevenuePct >= 0 ? "good" : "bad"}>
                {growthRates.momRevenuePct >= 0 ? "+" : ""}{growthRates.momRevenuePct.toFixed(1)}% vs last month
              </Badge>
              {growthRates.yoyRevenuePct !== null && (
                <Badge tone={growthRates.yoyRevenuePct >= 0 ? "good" : "bad"}>
                  {growthRates.yoyRevenuePct >= 0 ? "+" : ""}{growthRates.yoyRevenuePct.toFixed(1)}% vs last year
                </Badge>
              )}
            </div>
          )}
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

      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium">Margin trend</div>
            <div className="text-xs text-muted mt-0.5">
              Gross margin vs. net margin, month by month — revenue can grow while margins quietly erode, and this
              is what would show it.
            </div>
          </div>
        </div>
        {monthlyPnL.length < 2 ? (
          <div className="text-xs text-muted py-8 text-center">
            Log sales across at least two months to see a margin trend.
          </div>
        ) : (
          <div className="h-64 sm:h-80 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262C3A" />
                <XAxis dataKey="month" stroke="#8A92A6" fontSize={11} tickLine={false} />
                <YAxis stroke="#8A92A6" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} width={48} />
                <Tooltip
                  contentStyle={{ background: "#171C28", border: "1px solid #262C3A", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Gross margin" stroke="#E0A467" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="Net margin" stroke="#5B87C9" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="text-sm font-medium mb-4">Money by month</div>
        {monthlyPnL.length === 0 ? (
          <div className="text-xs text-muted py-6 text-center">No sales or expenses recorded yet.</div>
        ) : (
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="py-2 px-3 font-medium text-right">Money in</th>
                <th className="py-2 px-3 font-medium text-right">Cost of what sold</th>
                <th className="py-2 px-3 font-medium text-right">Profit</th>
                <th className="py-2 px-3 font-medium text-right">Bills &amp; running costs</th>
                <th className="py-2 pl-3 font-medium text-right">Left over (after tax)</th>
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
          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
            <Link href="/profitability" className="text-xs text-amber-soft">
              Break-even &amp; ROI →
            </Link>
            <Link href="/statements" className="text-xs text-amber-soft">
              Financial statements →
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}
