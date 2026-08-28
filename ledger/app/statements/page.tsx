"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, formatMonth, todayIso } from "@/lib/format";
import { Card, PageHeader, Select, Badge, EmptyState } from "@/components/ui";

type Tab = "income" | "balance" | "cashflow";

export default function StatementsPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { monthlyPnL, balanceSheet, settings } = useData();
  const currency = settings.currency;
  const [tab, setTab] = useState<Tab>("income");
  const [monthKey, setMonthKey] = useState<string>(monthlyPnL[monthlyPnL.length - 1]?.month ?? "");

  const selectedMonth = useMemo(
    () => monthlyPnL.find((m) => m.month === monthKey) ?? monthlyPnL[monthlyPnL.length - 1],
    [monthlyPnL, monthKey]
  );

  if (guardLoading || !allowed) return null;

  if (monthlyPnL.length === 0) {
    return (
      <>
        <PageHeader title="Financial statements" />
        <EmptyState
          title="Not enough data yet"
          body="Log some sales, purchases, and expenses first — the Income Statement, Balance Sheet, and Cash Flow Statement all build off that activity."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Financial statements" />

      <div className="flex gap-1 border-b border-line mb-6 -mt-1 overflow-x-auto">
        {(
          [
            ["income", "Income statement"],
            ["cashflow", "Cash flow"],
            ["balance", "Balance sheet"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3.5 py-2.5 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === key ? "border-amber text-fg font-medium" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {(tab === "income" || tab === "cashflow") && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-muted">
            {tab === "income"
              ? "Revenue, expenses, and net profit for one month."
              : "Actual cash moving in and out for one month (not the same as profit — inventory purchases hit cash before they hit COGS)."}
          </div>
          <Select
            value={selectedMonth?.month ?? ""}
            onChange={(e) => setMonthKey(e.target.value)}
            className="w-40"
          >
            {[...monthlyPnL].reverse().map((m) => (
              <option key={m.month} value={m.month}>
                {formatMonth(m.month)}
              </option>
            ))}
          </Select>
        </div>
      )}

      {tab === "income" && selectedMonth && <IncomeStatement m={selectedMonth} currency={currency} />}
      {tab === "cashflow" && selectedMonth && <CashFlowStatement m={selectedMonth} currency={currency} />}
      {tab === "balance" && <BalanceSheetView balanceSheet={balanceSheet} currency={currency} />}
    </>
  );
}

function Line({
  label,
  value,
  currency,
  bold,
  indent,
  muted,
  negative,
}: {
  label: string;
  value: number;
  currency: string;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between py-2 ${bold ? "border-t border-line mt-1 pt-3" : "border-b border-line/60 last:border-0"}`}
    >
      <span className={`text-sm ${indent ? "pl-4 text-muted" : ""} ${bold ? "font-medium text-fg" : ""}`}>{label}</span>
      <span className={`num text-sm ${bold ? "font-semibold text-base" : muted ? "text-muted" : ""}`}>
        {negative && value !== 0 ? "(" : ""}
        {formatMoney(Math.abs(value), currency)}
        {negative && value !== 0 ? ")" : ""}
      </span>
    </div>
  );
}

function IncomeStatement({
  m,
  currency,
}: {
  m: NonNullable<ReturnType<typeof useData>["monthlyPnL"][number]>;
  currency: string;
}) {
  return (
    <Card>
      <div className="text-sm font-medium mb-0.5">Income statement — {formatMonth(m.month)}</div>
      <div className="text-xs text-muted mb-4">Revenue, expenses, and net profit — over the period. Accrual basis.</div>

      <Line label="Sales revenue" value={m.salesRevenue} currency={currency} />
      <Line label="Recurring revenue" value={m.recurringRevenue} currency={currency} />
      <Line label="Total revenue" value={m.totalRevenue} currency={currency} bold />

      <div className="mt-4">
        <Line label="Cost of goods sold" value={m.cogs} currency={currency} negative muted />
        {m.cogsVariableCosts > 0 && (
          <Line label="Variable costs (COGS-tagged, e.g. shipping)" value={m.cogsVariableCosts} currency={currency} negative muted />
        )}
        <Line label="Gross profit" value={m.grossProfit} currency={currency} bold />
      </div>

      <div className="mt-4">
        <Line label="Other variable costs" value={m.variableCosts - m.cogsVariableCosts} currency={currency} negative muted />
        <Line label="Contribution margin" value={m.contributionMargin} currency={currency} bold />
      </div>

      <div className="mt-4">
        <Line label="Operating expenses" value={m.operatingExpenses} currency={currency} negative muted />
        <Line label="Depreciation" value={m.depreciationExpense} currency={currency} negative muted />
        <Line label="Interest expense" value={m.interestExpense} currency={currency} negative muted />
        {m.disposalGainLoss !== 0 && (
          <Line
            label={m.disposalGainLoss >= 0 ? "Gain on asset disposal" : "Loss on asset disposal"}
            value={m.disposalGainLoss}
            currency={currency}
            negative={m.disposalGainLoss < 0}
          />
        )}
        <Line label="Net profit before tax" value={m.netProfitPreTax} currency={currency} bold />
      </div>

      <div className="mt-4">
        <Line label="Tax" value={m.tax} currency={currency} negative muted />
        <Line label="Net profit after tax" value={m.netProfitAfterTax} currency={currency} bold />
      </div>

      <div className="mt-5 pt-4 border-t border-line flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">Gross margin:</span>
        <Badge tone={m.grossProfit >= 0 ? "good" : "bad"}>
          {m.totalRevenue > 0 ? ((m.grossProfit / m.totalRevenue) * 100).toFixed(1) : "0.0"}%
        </Badge>
        <span className="text-xs text-muted ml-3">Contribution margin:</span>
        <Badge tone={m.contributionMargin >= 0 ? "good" : "bad"}>
          {m.totalRevenue > 0 ? ((m.contributionMargin / m.totalRevenue) * 100).toFixed(1) : "0.0"}%
        </Badge>
        <span className="text-xs text-muted ml-3">Net margin:</span>
        <Badge tone={m.netProfitAfterTax >= 0 ? "good" : "bad"}>
          {m.totalRevenue > 0 ? ((m.netProfitAfterTax / m.totalRevenue) * 100).toFixed(1) : "0.0"}%
        </Badge>
      </div>

      {m.economicProfit !== m.netProfitAfterTax && (
        <div className="mt-5 pt-4 border-t border-dashed border-line">
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
            Informational — not part of the accounting statement above
          </div>
          <Line label="True profit (after paying yourself)" value={m.economicProfit} currency={currency} bold />
          <div className="text-[11px] text-muted mt-2">
            Nets your imputed monthly pay (set in Settings) out of net profit after tax — a decision-support number
            for whether the business is actually worth running, not a GAAP figure.
          </div>
        </div>
      )}
    </Card>
  );
}

function CashFlowStatement({
  m,
  currency,
}: {
  m: NonNullable<ReturnType<typeof useData>["monthlyPnL"][number]>;
  currency: string;
}) {
  return (
    <Card>
      <div className="text-sm font-medium mb-0.5">Cash flow statement — {formatMonth(m.month)}</div>
      <div className="text-xs text-muted mb-4">Actual cash in and out — over the period. Cash basis.</div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mt-2 mb-1">Operating activities</div>
      <Line label="Cash sales & recurring revenue" value={m.cashSalesRevenue + m.recurringRevenue} currency={currency} />
      <Line label="Collected from customers (credit sales)" value={m.receivableCollections} currency={currency} />
      <Line label="Cash paid for inventory / stock" value={m.purchaseCash} currency={currency} negative muted />
      <Line label="Variable costs paid" value={m.variableCosts} currency={currency} negative muted />
      <Line label="Operating expenses paid" value={m.operatingExpenses} currency={currency} negative muted />
      <Line label="Interest paid" value={m.interestExpense} currency={currency} negative muted />
      <Line label="Tax paid" value={m.tax} currency={currency} negative muted />
      <Line label="Net cash from operating" value={m.operatingCashFlow} currency={currency} bold />

      <div className="text-xs font-medium text-muted uppercase tracking-wider mt-5 mb-1">Financing activities</div>
      <Line label="Loan proceeds received" value={m.loanProceeds} currency={currency} />
      <Line label="Loan principal repaid" value={m.principalRepayment} currency={currency} negative muted />
      <Line label="Owner capital contributed" value={m.capitalIn} currency={currency} />
      <Line label="Owner withdrawals" value={m.capitalOut} currency={currency} negative muted />
      <Line label="Net cash from financing" value={m.financingCashFlow} currency={currency} bold />

      <div className="text-xs font-medium text-muted uppercase tracking-wider mt-5 mb-1">Investing activities</div>
      <Line label="Fixed asset purchases" value={m.fixedAssetPurchases} currency={currency} negative muted />
      <Line label="Proceeds from asset disposals" value={m.fixedAssetDisposalProceeds} currency={currency} />
      <Line label="Net cash from investing" value={m.investingCashFlow} currency={currency} bold />

      <Line label="Net change in cash" value={m.netCashFlow} currency={currency} bold />
    </Card>
  );
}

function BalanceSheetView({
  balanceSheet,
  currency,
}: {
  balanceSheet: ReturnType<typeof useData>["balanceSheet"];
  currency: string;
}) {
  const b = balanceSheet;
  return (
    <Card>
      <div className="text-sm font-medium mb-0.5">Balance sheet — as of {b.asOf}</div>
      <div className="text-xs text-muted mb-4">
        A snapshot of what the business owns, owes, and is worth right now — always as of today.
      </div>

      <div className="text-xs font-medium text-muted uppercase tracking-wider mt-2 mb-1">Assets</div>
      <Line label="Cash" value={b.cash} currency={currency} />
      <Line label="Accounts receivable" value={b.accountsReceivable} currency={currency} />
      <Line label="Inventory" value={b.inventoryValue} currency={currency} />
      <Line label="Fixed assets (net)" value={b.fixedAssetsNetBookValue} currency={currency} />
      <Line label="Total assets" value={b.totalAssets} currency={currency} bold />

      <div className="text-xs font-medium text-muted uppercase tracking-wider mt-5 mb-1">Liabilities</div>
      <Line label="Loans payable" value={b.loansPayable} currency={currency} />
      <Line label="Accounts payable" value={b.accountsPayable} currency={currency} />
      <Line label="Total liabilities" value={b.totalLiabilities} currency={currency} bold />

      <div className="text-xs font-medium text-muted uppercase tracking-wider mt-5 mb-1">Equity</div>
      <Line label="Owner's capital (net of withdrawals)" value={b.ownersCapital} currency={currency} />
      <Line label="Retained earnings" value={b.retainedEarnings} currency={currency} />
      <Line label="Total equity" value={b.totalEquity} currency={currency} bold />

      <Line label="Total liabilities + equity" value={b.totalLiabilitiesAndEquity} currency={currency} bold />

      <div className="mt-5 pt-4 border-t border-line flex items-center gap-2">
        <Badge tone={b.balances ? "good" : "bad"}>{b.balances ? "Balanced" : "Out of balance"}</Badge>
        <span className="text-xs text-muted">Assets should always equal Liabilities + Equity.</span>
      </div>
    </Card>
  );
}
