"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney } from "@/lib/format";
import { computeCashRunway } from "@/lib/calculations";
import { Badge, Card, Field, Input, Label, PageHeader, Skeleton, Stat } from "@/components/ui";

export default function CashFlowPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { balanceSheet, avgDailyCashSales, loans, employees, expenses, receivablesAging, payablesAging, settings, loading } = useData();
  const currency = settings.currency;

  const [horizonDays, setHorizonDays] = useState(60);
  const [startingCashOverride, setStartingCashOverride] = useState<string>("");
  const [rentOverride, setRentOverride] = useState<string>("");
  const [dailySalesOverride, setDailySalesOverride] = useState<string>("");

  const startingCash = startingCashOverride !== "" ? Number(startingCashOverride) : balanceSheet.cash;
  const rentAmount = rentOverride !== "" ? Number(rentOverride) : settings.rentAmount;
  const estimatedDailyCashSales = dailySalesOverride !== "" ? Number(dailySalesOverride) : avgDailyCashSales;

  const result = useMemo(
    () =>
      computeCashRunway({
        asOf: new Date().toISOString().slice(0, 10),
        startingCash,
        horizonDays: Math.max(1, Math.min(180, horizonDays)),
        estimatedDailyCashSales,
        rentAmount,
        rentDueDayOfMonth: settings.rentDueDayOfMonth,
        loans,
        employees,
        expenses,
        receivables: receivablesAging.lines,
        payables: payablesAging.lines,
        currency,
      }),
    [startingCash, horizonDays, estimatedDailyCashSales, rentAmount, settings.rentDueDayOfMonth, loans, employees, expenses, receivablesAging.lines, payablesAging.lines, currency]
  );

  if (guardLoading || !allowed) return null;

  if (loading) {
    return (
      <>
        <PageHeader title="Can You Make Rent?" />
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <Card>
            <Skeleton className="h-[11px] w-24 mb-3" />
            <div className="space-y-3">
              <Skeleton className="h-[60px] w-full" />
              <Skeleton className="h-[60px] w-full" />
              <Skeleton className="h-[60px] w-full" />
            </div>
          </Card>
          <Card>
            <Skeleton className="h-[11px] w-24 mb-3" />
            <Skeleton className="h-40 w-full" />
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Can You Make Rent?" />

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Assumptions</div>
          <div className="space-y-3">
            <Field>
              <Label>Cash on hand right now ({formatMoney(balanceSheet.cash, currency)} from your books)</Label>
              <Input
                type="number"
                step="0.01"
                value={startingCashOverride}
                onChange={(e) => setStartingCashOverride(e.target.value)}
                placeholder={balanceSheet.cash.toFixed(2)}
              />
            </Field>
            <Field>
              <Label>Rent / biggest fixed bill ({formatMoney(settings.rentAmount, currency)} in Settings)</Label>
              <Input
                type="number"
                step="0.01"
                value={rentOverride}
                onChange={(e) => setRentOverride(e.target.value)}
                placeholder={settings.rentAmount.toFixed(2)}
              />
            </Field>
            <Field>
              <Label>Expected daily cash sales ({formatMoney(avgDailyCashSales, currency)} avg, last 30 days)</Label>
              <Input
                type="number"
                step="0.01"
                value={dailySalesOverride}
                onChange={(e) => setDailySalesOverride(e.target.value)}
                placeholder={avgDailyCashSales.toFixed(2)}
              />
            </Field>
            <Field>
              <Label>Look ahead how many days?</Label>
              <Input
                type="number"
                min="7"
                max="180"
                value={horizonDays}
                onChange={(e) => setHorizonDays(Number(e.target.value) || 30)}
              />
            </Field>
          </div>
        </Card>

        <div className="space-y-3">
          <Card className={result.canMakeRent ? "border-good/40" : "border-bad/40"}>
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Rent due {result.rentDueDate}</div>
            <div className={`num text-2xl font-medium mt-1.5 ${result.canMakeRent ? "text-good" : "text-bad"}`}>
              {result.canMakeRent ? "You can make it" : "You'll be short"}
            </div>
            <div className="text-sm text-muted mt-1">
              Projected cash on {result.rentDueDate}: {formatMoney(result.cashAtRentDue, currency)}
              {!result.canMakeRent && <span className="text-bad"> — short by {formatMoney(result.shortfall, currency)}</span>}
            </div>
          </Card>
          <Stat
            label={`Lowest point in the next ${horizonDays} days`}
            value={formatMoney(result.lowestBalance, currency)}
            tone={result.lowestBalance < 0 ? "bad" : "default"}
            sub={`on ${result.lowestBalanceDate}`}
          />
        </div>
      </div>

      <Card>
        <div className="text-xs font-medium text-muted uppercase tracking-wider mb-3">Day by day</div>
        <div className="text-xs text-muted mb-3">
          Only showing days where something actually moves cash — loan payments, payroll, recurring bills, rent, and expected customer
          payments. Everything else just drifts by your estimated daily cash sales.
        </div>
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {result.days
            .filter((d) => d.events.length > 0 || d.date === result.rentDueDate)
            .map((d) => (
              <div key={d.date} className="flex items-center justify-between text-xs border-b border-line last:border-0 py-1.5 gap-3">
                <div className="w-24 shrink-0 num text-muted">{d.date}</div>
                <div className="flex-1 flex flex-wrap gap-1">
                  {d.events.map((ev, i) => (
                    <Badge key={i} tone={d.date === result.rentDueDate && ev === "Rent" ? "bad" : "default"}>
                      {ev}
                    </Badge>
                  ))}
                </div>
                <div className={`num text-right w-28 shrink-0 font-medium ${d.balance < 0 ? "text-bad" : "text-fg"}`}>
                  {formatMoney(d.balance, currency)}
                </div>
              </div>
            ))}
        </div>
      </Card>

      <div className="text-xs text-muted mt-4">
        This is a planning tool, not a guarantee — it assumes customers pay exactly on their due date and that ordinary daily cash
        sales stay near their recent average. Use it to spot a squeeze coming, not as a promise of what will happen.
      </div>
    </>
  );
}
