"use client";

import { useData } from "@/contexts/DataContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney } from "@/lib/format";
import { Card, PageHeader, Stat, EmptyState, Badge } from "@/components/ui";

function pct(n: number | null, digits = 1): string {
  return n === null ? "—" : `${n.toFixed(digits)}%`;
}

function ratio(n: number | null, digits = 2): string {
  return n === null ? "—" : `${n.toFixed(digits)}×`;
}

function daysStr(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(0)} days`;
}

// Simple, transparent thresholds — the kind an SME owner can verify by hand
// rather than a black-box score. Tuned to be forgiving (this is a
// small-business tool, not a lender's covenant test), not a certification.
function toneForRatio(n: number | null, good: number, bad: number, higherIsBetter = true): "good" | "amber" | "bad" | "default" {
  if (n === null) return "default";
  if (higherIsBetter) {
    if (n >= good) return "good";
    if (n <= bad) return "bad";
    return "amber";
  }
  if (n <= good) return "good";
  if (n >= bad) return "bad";
  return "amber";
}

export default function FinancialHealthPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { financialHealth, balanceSheet, monthlyPnL, marketingMetrics, settings } = useData();
  const currency = settings.currency;

  if (guardLoading || !allowed) return null;

  if (monthlyPnL.length === 0) {
    return (
      <>
        <PageHeader title="Financial health" />
        <EmptyState
          title="Not enough data yet"
          body="Log some sales, purchases, and expenses first — these ratios build off that activity, the same numbers behind your financial statements."
        />
      </>
    );
  }

  const h = financialHealth;

  return (
    <>
      <PageHeader title="Financial health" />
      <div className="text-xs text-muted -mt-2 mb-5">
        As of {h.asOf} · profitability and efficiency ratios use the trailing {h.trailingMonths}{" "}
        {h.trailingMonths === 1 ? "month" : "months"} of activity. Liquidity and leverage use today&apos;s Balance Sheet.
      </div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Liquidity</div>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Current ratio</div>
            <Badge tone={toneForRatio(h.currentRatio, 1.5, 1)}>{ratio(h.currentRatio, 2)}</Badge>
          </div>
          <div className="text-xs text-muted mt-2">
            (Cash + receivables + inventory) ÷ accounts payable. Above 1.5× means near-term obligations are
            comfortably covered; below 1× means payables exceed what could quickly be turned into cash.
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Quick ratio</div>
            <Badge tone={toneForRatio(h.quickRatio, 1, 0.5)}>{ratio(h.quickRatio, 2)}</Badge>
          </div>
          <div className="text-xs text-muted mt-2">
            Same as current ratio but excludes inventory, which isn&apos;t instantly spendable. The stricter,
            more conservative liquidity check.
          </div>
        </Card>
      </div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Profitability</div>
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Gross margin"
          value={pct(h.grossMarginPct)}
          tone={h.grossMarginPct === null ? "default" : h.grossMarginPct >= 30 ? "good" : h.grossMarginPct >= 10 ? "amber" : "bad"}
          sub="Revenue left after direct costs"
        />
        <Stat
          label="Operating margin"
          value={pct(h.operatingMarginPct)}
          tone={h.operatingMarginPct === null ? "default" : h.operatingMarginPct >= 15 ? "good" : h.operatingMarginPct >= 0 ? "amber" : "bad"}
          sub="Revenue minus COGS and running costs, before interest & tax"
        />
        <Stat
          label="Net margin"
          value={pct(h.netMarginPct)}
          tone={h.netMarginPct === null ? "default" : h.netMarginPct >= 10 ? "good" : h.netMarginPct >= 0 ? "amber" : "bad"}
          sub="What's actually left after everything"
        />
        <Stat
          label="Return on equity"
          value={pct(h.returnOnEquityPct)}
          tone={h.returnOnEquityPct === null ? "default" : h.returnOnEquityPct >= 15 ? "good" : h.returnOnEquityPct >= 0 ? "amber" : "bad"}
          sub="Trailing profit vs. owner's stake"
        />
      </div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Efficiency — cash conversion cycle</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Days sales outstanding" value={daysStr(h.daysSalesOutstanding)} sub="Avg. time to collect a sale" />
        <Stat label="Days inventory outstanding" value={daysStr(h.daysInventoryOutstanding)} sub="Avg. time stock sits before selling" />
        <Stat label="Days payable outstanding" value={daysStr(h.daysPayableOutstanding)} sub="Avg. time taken to pay suppliers" />
        <Stat
          label="Cash conversion cycle"
          value={daysStr(h.cashConversionCycleDays)}
          tone={
            h.cashConversionCycleDays === null
              ? "default"
              : h.cashConversionCycleDays <= 30
              ? "good"
              : h.cashConversionCycleDays <= 60
              ? "amber"
              : "bad"
          }
          sub="DIO + DSO − DPO. Lower is better — less cash tied up"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Stat label="Inventory turnover" value={ratio(h.inventoryTurnoverAnnualized, 1)} sub="Times stock sells through per year, annualized" />
      </div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Leverage</div>
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Stat
          label="Debt-to-equity"
          value={ratio(h.debtToEquity, 2)}
          tone={toneForRatio(h.debtToEquity, 1, 2, false)}
          sub="Total liabilities vs. owner's equity — lower means less reliance on debt"
        />
        <Stat
          label="Debt ratio"
          value={pct(h.debtRatio ? h.debtRatio * 100 : null)}
          tone={toneForRatio(h.debtRatio ? h.debtRatio * 100 : null, 40, 70, false)}
          sub="Share of total assets financed by liabilities"
        />
      </div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Customer acquisition</div>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat
          label="Customer acquisition cost"
          value={
            marketingMetrics.customerAcquisitionCost === null
              ? "—"
              : formatMoney(marketingMetrics.customerAcquisitionCost, currency)
          }
          sub={`Marketing spend ÷ ${marketingMetrics.newCustomers} new customer${marketingMetrics.newCustomers === 1 ? "" : "s"}, trailing ${marketingMetrics.trailingMonths}mo`}
        />
        <Stat
          label="Average customer value"
          value={formatMoney(marketingMetrics.averageCustomerValue, currency)}
          sub={`Revenue per buying customer, trailing ${marketingMetrics.trailingMonths}mo`}
        />
        <Stat
          label="New vs. returning"
          value={`${marketingMetrics.newCustomers} / ${marketingMetrics.returningCustomers}`}
          sub="New customers vs. repeat buyers this window"
        />
      </div>
      <div className="text-xs text-muted -mt-4 mb-6">
        Marketing spend is whatever&apos;s logged under the &quot;Marketing&quot; category on the Expenses page —
        this only moves if that&apos;s kept up to date. There&apos;s no lead-tracking here: a lead-to-customer
        conversion rate isn&apos;t shown because nothing in this app records a lead, so it isn&apos;t computed
        rather than being invented.
      </div>

      <Card>
        <div className="text-sm font-medium mb-3">Behind the ratios — current Balance Sheet</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted">Cash</div>
            <div className="num font-medium">{formatMoney(balanceSheet.cash, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Receivable</div>
            <div className="num font-medium">{formatMoney(balanceSheet.accountsReceivable, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Inventory</div>
            <div className="num font-medium">{formatMoney(balanceSheet.inventoryValue, currency)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">Payable</div>
            <div className="num font-medium">{formatMoney(balanceSheet.accountsPayable, currency)}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge tone={balanceSheet.balances ? "good" : "bad"}>
            {balanceSheet.balances ? "Balanced" : "Out of balance"}
          </Badge>
          <span className="text-xs text-muted">Full statement on the Financial Statements page.</span>
        </div>
      </Card>
    </>
  );
}
