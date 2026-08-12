"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, Field, Input, Label, PageHeader, Select } from "@/components/ui";

const CURRENCIES = ["LKR", "USD", "AED", "EUR", "GBP", "INR"];

export default function SettingsPage() {
  const { settings, updateSettings } = useData();
  const { user } = useAuth();
  const [taxRatePct, setTaxRatePct] = useState(settings.taxRatePct.toString());
  const [currency, setCurrency] = useState(settings.currency);
  const [forecastMonths, setForecastMonths] = useState(settings.forecastMonths.toString());
  const [defaultOrderingCost, setDefaultOrderingCost] = useState(settings.defaultOrderingCost.toString());
  const [defaultHoldingCostPct, setDefaultHoldingCostPct] = useState(settings.defaultHoldingCostPct.toString());
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState(settings.defaultLeadTimeDays.toString());
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
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

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
            <Label>Currency</Label>
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
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
            <div className="grid grid-cols-3 gap-3">
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
