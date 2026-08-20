"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRequireRole } from "@/lib/roleGuard";
import { Button, Card, Field, Input, Label, PageHeader, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/fx";

export default function SettingsPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner"]);
  const { settings, updateSettings } = useData();
  const { user } = useAuth();
  const [taxRatePct, setTaxRatePct] = useState(settings.taxRatePct.toString());
  const [currency, setCurrency] = useState(settings.currency);
  const [forecastMonths, setForecastMonths] = useState(settings.forecastMonths.toString());
  const [defaultOrderingCost, setDefaultOrderingCost] = useState(settings.defaultOrderingCost.toString());
  const [defaultHoldingCostPct, setDefaultHoldingCostPct] = useState(settings.defaultHoldingCostPct.toString());
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState(settings.defaultLeadTimeDays.toString());
  const [monthlyOwnerDraw, setMonthlyOwnerDraw] = useState(settings.monthlyOwnerDraw?.toString() ?? "");
  const [defaultCreditTermDays, setDefaultCreditTermDays] = useState(settings.defaultCreditTermDays.toString());
  const [creditReviewThreshold, setCreditReviewThreshold] = useState(settings.creditReviewThreshold.toString());
  const [rentAmount, setRentAmount] = useState(settings.rentAmount.toString());
  const [rentDueDayOfMonth, setRentDueDayOfMonth] = useState(settings.rentDueDayOfMonth.toString());
  const [defaultOpeningFloat, setDefaultOpeningFloat] = useState(settings.defaultOpeningFloat.toString());
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await updateSettings({
      taxRatePct: Number(taxRatePct),
      currency,
      forecastMonths: Number(forecastMonths),
      defaultOrderingCost: Number(defaultOrderingCost),
      defaultHoldingCostPct: Number(defaultHoldingCostPct),
      defaultLeadTimeDays: Number(defaultLeadTimeDays),
      monthlyOwnerDraw: monthlyOwnerDraw ? Number(monthlyOwnerDraw) : undefined,
      defaultCreditTermDays: Number(defaultCreditTermDays) || 90,
      creditReviewThreshold: Number(creditReviewThreshold) || 0,
      rentAmount: Number(rentAmount) || 0,
      rentDueDayOfMonth: Math.min(28, Math.max(1, Number(rentDueDayOfMonth) || 1)),
      defaultOpeningFloat: Number(defaultOpeningFloat) || 0,
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-md">
        <form onSubmit={handleSave} className="space-y-4">
          <Field>
            <Label>Tax rate (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={taxRatePct}
              onChange={(e) => setTaxRatePct(e.target.value)}
            />
            <div className="text-xs text-muted mt-1.5">Applied to positive pre-tax net profit each month.</div>
          </Field>
          <Field>
            <Label>Base currency (used for all reports)</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <div className="text-xs text-muted mt-1.5">
              Every report and total is shown in this currency. A specific sale or purchase can still be entered in a
              different currency with its own exchange rate — it gets converted to this one automatically.
            </div>
          </Field>
          <Field>
            <Label>Forecast horizon (months)</Label>
            <Input
              type="number"
              min="1"
              max="12"
              value={forecastMonths}
              onChange={(e) => setForecastMonths(e.target.value)}
            />
            <div className="text-xs text-muted mt-1.5">How far the dashboard trend line projects forward.</div>
          </Field>

          <div className="border-t border-line pt-4">
            <div className="text-xs font-medium text-muted mb-3">
              EOQ / reorder planning defaults — used for any product that doesn&apos;t set its own
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field>
                <Label>Ordering cost</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={defaultOrderingCost}
                  onChange={(e) => setDefaultOrderingCost(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Holding cost %/yr</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={defaultHoldingCostPct}
                  onChange={(e) => setDefaultHoldingCostPct(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Lead time (days)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={defaultLeadTimeDays}
                  onChange={(e) => setDefaultLeadTimeDays(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <div className="text-xs font-medium text-muted mb-1">Your own labor cost (optional)</div>
            <div className="text-xs text-muted mb-3">
              What would you pay someone else to do your job? This doesn&apos;t create a real transaction or change
              any of the financial statements — it just powers a separate &quot;true profitability&quot; figure on
              the Dashboard, so the business looking profitable isn&apos;t secretly built on nobody paying you for
              the hours you put in.
            </div>
            <Field>
              <Label>Imputed owner pay / month</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={monthlyOwnerDraw}
                onChange={(e) => setMonthlyOwnerDraw(e.target.value)}
                placeholder="e.g. 150000"
              />
            </Field>
          </div>

          <div className="border-t border-line pt-4">
            <div className="text-xs font-medium text-muted mb-1">Credit sales</div>
            <div className="text-xs text-muted mb-3">
              Defaults used when you mark a sale as &quot;credit&quot; — money owed to you rather than collected on the spot.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field>
                <Label>Default credit term (days)</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={defaultCreditTermDays}
                  onChange={(e) => setDefaultCreditTermDays(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Flag credit sales above</Label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={creditReviewThreshold}
                  onChange={(e) => setCreditReviewThreshold(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <div className="text-xs font-medium text-muted mb-1">Rent &amp; cash</div>
            <div className="text-xs text-muted mb-3">
              Powers the Cash Flow page&apos;s &quot;can you make rent&quot; projection and the default opening float on a new cash
              count.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field>
                <Label>Rent / month</Label>
                <Input type="number" min="0" step="1" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} />
              </Field>
              <Field>
                <Label>Due day of month</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  step="1"
                  value={rentDueDayOfMonth}
                  onChange={(e) => setRentDueDayOfMonth(e.target.value)}
                />
              </Field>
              <Field>
                <Label>Default opening float</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={defaultOpeningFloat}
                  onChange={(e) => setDefaultOpeningFloat(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save settings"}
            </Button>
            {saved && <span className="text-xs text-good">Saved</span>}
          </div>
        </form>
      </Card>

      <Card className="max-w-md mt-6">
        <div className="text-sm font-medium mb-1">Account</div>
        <div className="text-xs text-muted">{user?.email}</div>
      </Card>
    </>
  );
}
