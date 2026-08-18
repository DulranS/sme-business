"use client";

import { useData } from "@/contexts/DataContext";
import { formatMoney } from "@/lib/format";
import { Card, PageHeader, Stat, Table, EmptyState } from "@/components/ui";

function fmtPct(v: number | null, decimals = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}%`;
}
function fmtX(v: number | null, decimals = 1): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(decimals)}×`;
}
function toneForRatio(v: number | null, good: number, bad: number): "good" | "bad" | "amber" | "default" {
  if (v === null) return "default";
  if (v >= good) return "good";
  if (v <= bad) return "bad";
  return "amber";
}

function Section({ title, blurb, children }: { title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3">
        <div className="text-sm font-medium">{title}</div>
        {blurb && <div className="text-xs text-muted mt-0.5">{blurb}</div>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">{children}</div>
    </div>
  );
}

export default function FinancialHealthPage() {
  const { financialRatios: r, customerMetrics: cm, monthlyPnL, settings } = useData();
  const currency = settings.currency;
  const hasData = monthlyPnL.length > 0 && r.windowMonths > 0;

  return (
    <>
      <PageHeader title="Financial health" />

      {!hasData ? (
        <EmptyState
          title="Not enough data yet"
          body="These ratios need at least a little sales, expense, and balance sheet history to mean anything. Record a few transactions and check back."
        />
      ) : (
        <>
          <div className="text-xs text-muted mb-6">
            Based on the trailing {r.windowMonths} month{r.windowMonths === 1 ? "" : "s"} of activity, as of today.
            These are the numbers a bank or investor would actually ask for — most SME dashboards stop at revenue
            and net profit, but a loan application or valuation conversation runs on the ratios below.
          </div>

          <Section
            title="Profitability, beyond net profit"
            blurb="EBIT and EBITDA strip out financing (interest) and non-cash items (depreciation), so you can judge how the operating business performs on its own — separate from how it's financed."
          >
            <Stat label="EBIT (operating profit)" value={formatMoney(r.ebit, currency)} sub={fmtPct(r.operatingMarginPct) + " margin"} />
            <Stat label="EBITDA" value={formatMoney(r.ebitda, currency)} sub={fmtPct(r.ebitdaMarginPct) + " margin"} />
            <Stat label="Net profit" value={formatMoney(r.netProfit, currency)} sub={fmtPct(r.returnOnSalesPct) + " of revenue"} tone={r.netProfit >= 0 ? "good" : "bad"} />
            <Stat label="Revenue (trailing)" value={formatMoney(r.revenue, currency)} />
          </Section>

          <Section
            title="Cash"
            blurb="Free Cash Flow is what's actually left after running the business and buying/replacing equipment — the number that funds growth, debt paydown, or an owner draw without borrowing."
          >
            <Stat label="Free cash flow" value={formatMoney(r.freeCashFlow, currency)} tone={r.freeCashFlow >= 0 ? "good" : "bad"} />
          </Section>

          <Section
            title="Returns"
            blurb="What the business earns relative to what's invested in it. ROE and ROA are what an investor or the owner uses to judge whether the capital tied up here is working hard enough."
          >
            <Stat
              label="Return on equity"
              value={fmtPct(r.roePct)}
              sub={r.roePct === null ? "n/a — equity is negative or zero" : "net profit / equity"}
              tone={toneForRatio(r.roePct, 15, 0)}
            />
            <Stat label="Return on assets" value={fmtPct(r.roaPct)} sub="net profit / total assets" tone={toneForRatio(r.roaPct, 8, 0)} />
            <Stat label="Return on capital employed" value={fmtPct(r.rocePct)} sub="EBIT / (equity + net debt)" tone={toneForRatio(r.rocePct, 15, 0)} />
          </Section>

          <Section
            title="Liquidity — can you cover what's due soon?"
            blurb="Current Ratio counts everything short-term (cash, receivables, inventory) against what's due within a year. Quick Ratio is stricter — it drops inventory, since stock can't always be turned into cash fast."
          >
            <Stat
              label="Current ratio"
              value={fmtX(r.currentRatio)}
              sub={r.currentRatio !== null ? (r.currentRatio >= 1.5 ? "comfortable" : r.currentRatio >= 1 ? "tight" : "below 1×") : undefined}
              tone={toneForRatio(r.currentRatio, 1.5, 1)}
            />
            <Stat
              label="Quick ratio"
              value={fmtX(r.quickRatio)}
              sub={r.quickRatio !== null ? (r.quickRatio >= 1 ? "comfortable" : "relies on inventory") : undefined}
              tone={toneForRatio(r.quickRatio, 1, 0.5)}
            />
          </Section>

          <Section
            title="Leverage & debt coverage"
            blurb="Net Debt is what you'd owe after using all your cash to pay down loans today. Interest and debt-service coverage are exactly what a lender checks before approving or restructuring a loan."
          >
            <Stat label="Net debt" value={formatMoney(r.netDebt, currency)} sub={r.netDebt < 0 ? "net cash position" : undefined} tone={r.netDebt < 0 ? "good" : "default"} />
            <Stat
              label="Interest coverage"
              value={fmtX(r.interestCoverage)}
              sub="EBIT / interest expense"
              tone={toneForRatio(r.interestCoverage, 3, 1.5)}
            />
            <Stat
              label="Debt service coverage"
              value={fmtPct(r.debtServiceCoveragePct, 0)}
              sub="EBITDA / (interest + principal due)"
              tone={toneForRatio(r.debtServiceCoveragePct, 125, 100)}
            />
          </Section>

          <Section
            title="Customer economics, this month"
            blurb="What it costs to win a customer, versus what a customer is worth. Needs a customer name on your sales to work — anonymous sales can't be grouped."
          >
            <Stat label="New customers" value={String(cm.newCustomersThisMonth)} />
            <Stat label="Marketing spend" value={formatMoney(cm.marketingSpendThisMonth, currency)} />
            <Stat
              label="Customer acquisition cost"
              value={cm.cac !== null ? formatMoney(cm.cac, currency) : "—"}
              sub={cm.cac === null ? "no new named customers this month" : undefined}
            />
            <Stat label="Avg. customer value (all-time)" value={formatMoney(cm.averageCustomerValue, currency)} sub={`${cm.distinctCustomerCount} named customers`} />
          </Section>

          {cm.topCustomers.length > 0 && (
            <Card>
              <div className="text-sm font-medium mb-3">Top customers, all-time</div>
              <div className="table-container">
                <Table>
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 px-3 font-medium text-right">Orders</th>
                      <th className="py-2 px-3 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cm.topCustomers.map((c) => (
                      <tr key={c.name} className="border-b border-line last:border-0">
                        <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                        <td className="py-2.5 px-3 num text-right text-muted">{c.orders}</td>
                        <td className="py-2.5 px-3 num text-right">{formatMoney(c.revenue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
