"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRequireRole } from "@/lib/roleGuard";
import { Button, Card, Field, Input, Label, PageHeader, Select } from "@/components/ui";
import { CURRENCIES } from "@/lib/fx";

// Firebase Auth error codes are technical (auth/invalid-credential,
// auth/requires-recent-login) — map the ones a user can actually hit here
// to plain language instead of surfacing the raw code.
function describeAuthError(message: string): string {
  if (message.includes("auth/invalid-credential") || message.includes("auth/wrong-password")) {
    return "Current password is incorrect.";
  }
  if (message.includes("auth/email-already-in-use")) {
    return "That email is already in use by another account.";
  }
  if (message.includes("auth/invalid-email")) {
    return "That doesn't look like a valid email address.";
  }
  if (message.includes("auth/weak-password")) {
    return "That password is too weak — use at least 6 characters.";
  }
  if (message.includes("auth/requires-recent-login")) {
    return "For security, please sign out and back in, then try again.";
  }
  if (message.includes("auth/too-many-requests")) {
    return "Too many attempts — please wait a moment and try again.";
  }
  return message;
}

export default function SettingsPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner"]);
  const { settings, updateSettings, updateOwnProfile } = useData();
  const { user, memberName, changeEmail, changePassword } = useAuth();
  const [taxRatePct, setTaxRatePct] = useState(settings.taxRatePct.toString());
  const [currency, setCurrency] = useState(settings.currency);
  const [businessName, setBusinessName] = useState(settings.businessName ?? "");
  const [businessAddress, setBusinessAddress] = useState(settings.businessAddress ?? "");
  const [businessPhone, setBusinessPhone] = useState(settings.businessPhone ?? "");
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

  // Account — name, email, password. Split into three independent forms
  // since email/password need the current password re-entered and name
  // doesn't; bundling them would make an unrelated field block a save.
  const [accountName, setAccountName] = useState(memberName ?? "");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState("");

  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    setNameError("");
    if (!accountName.trim()) {
      setNameError("Name can't be empty.");
      return;
    }
    setNameBusy(true);
    try {
      await updateOwnProfile({ name: accountName });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Couldn't update name.");
    } finally {
      setNameBusy(false);
    }
  }

  async function handleEmailSave(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!emailPassword) {
      setEmailError("Enter your current password to confirm this change.");
      return;
    }
    setEmailBusy(true);
    try {
      await changeEmail(trimmed, emailPassword);
      await updateOwnProfile({ email: trimmed });
      setEmailPassword("");
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2500);
    } catch (err) {
      setEmailError(err instanceof Error ? describeAuthError(err.message) : "Couldn't update email.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Enter your current password to confirm this change.");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordError(err instanceof Error ? describeAuthError(err.message) : "Couldn't update password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await updateSettings({
      taxRatePct: Number(taxRatePct),
      currency,
      businessName: businessName.trim() || undefined,
      businessAddress: businessAddress.trim() || undefined,
      businessPhone: businessPhone.trim() || undefined,
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
            <Label>Business name (optional)</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Perera Auto Works"
            />
            <div className="text-xs text-muted mt-1.5">
              Shown as the letterhead on printed project quotes and invoices. Leave blank to print without one.
            </div>
          </Field>
          {businessName.trim() && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field>
                <Label>Business address (optional)</Label>
                <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
              </Field>
              <Field>
                <Label>Business phone (optional)</Label>
                <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
              </Field>
            </div>
          )}
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
        <div className="text-sm font-medium mb-4">Account</div>

        <form onSubmit={handleNameSave} className="space-y-3 pb-4 border-b border-line">
          <Field>
            <Label>Your name</Label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </Field>
          {nameError && <div className="text-xs text-bad">{nameError}</div>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={nameBusy}>
              {nameBusy ? "Saving…" : "Save name"}
            </Button>
            {nameSaved && <span className="text-xs text-good">Saved</span>}
          </div>
        </form>

        <form onSubmit={handleEmailSave} className="space-y-3 py-4 border-b border-line">
          <Field>
            <Label>Email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </Field>
          <Field>
            <Label>Current password</Label>
            <Input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="Confirm it's you"
            />
          </Field>
          {emailError && <div className="text-xs text-bad">{emailError}</div>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={emailBusy}>
              {emailBusy ? "Saving…" : "Save email"}
            </Button>
            {emailSaved && <span className="text-xs text-good">Saved</span>}
          </div>
        </form>

        <form onSubmit={handlePasswordSave} className="space-y-3 pt-4">
          <Field>
            <Label>Current password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field>
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </Field>
            <Field>
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </Field>
          </div>
          {passwordError && <div className="text-xs text-bad">{passwordError}</div>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={passwordBusy}>
              {passwordBusy ? "Saving…" : "Save password"}
            </Button>
            {passwordSaved && <span className="text-xs text-good">Saved</span>}
          </div>
        </form>
      </Card>
    </>
  );
}
