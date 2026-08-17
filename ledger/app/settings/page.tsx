"use client";

import { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, Field, Input, Label, PageHeader, Select, Badge, Modal } from "@/components/ui";
import type { TeamRole } from "@/lib/types";

const CURRENCIES = ["LKR", "USD", "AED", "EUR", "GBP", "INR"];

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export default function SettingsPage() {
  const { settings, updateSettings, teamMembers, addTeamMember, updateTeamMember, deleteTeamMember } = useData();
  const { user } = useAuth();
  const [taxRatePct, setTaxRatePct] = useState(settings.taxRatePct.toString());
  const [currency, setCurrency] = useState(settings.currency);
  const [forecastMonths, setForecastMonths] = useState(settings.forecastMonths.toString());
  const [defaultOrderingCost, setDefaultOrderingCost] = useState(settings.defaultOrderingCost.toString());
  const [defaultHoldingCostPct, setDefaultHoldingCostPct] = useState(settings.defaultHoldingCostPct.toString());
  const [defaultLeadTimeDays, setDefaultLeadTimeDays] = useState(settings.defaultLeadTimeDays.toString());
  const [monthlyOwnerDraw, setMonthlyOwnerDraw] = useState(settings.monthlyOwnerDraw?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [teamFormData, setTeamFormData] = useState({
    email: "",
    name: "",
    role: "viewer" as TeamRole,
  });

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
    });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const handleOpenTeamModal = (member?: any) => {
    if (member) {
      setEditingMember(member);
      setTeamFormData({
        email: member.email,
        name: member.name,
        role: member.role,
      });
    } else {
      setEditingMember(null);
      setTeamFormData({
        email: "",
        name: "",
        role: "viewer",
      });
    }
    setShowTeamModal(true);
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const memberData = {
      ...teamFormData,
      active: true,
    };
    if (editingMember) {
      await updateTeamMember(editingMember.id, memberData);
    } else {
      await addTeamMember(memberData);
    }
    setShowTeamModal(false);
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string) => {
    if (confirm("Are you sure you want to remove this team member?")) {
      await deleteTeamMember(id);
    }
  };

  const getRoleBadge = (role: TeamRole) => {
    const tone = role === "owner" ? "good" : role === "admin" ? "amber" : "default";
    return <Badge tone={tone}>{role}</Badge>;
  };

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

          <div className="flex items-center gap-3 pt-2 flex-wrap">
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

      <Card className="max-w-2xl mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium">Team Members</div>
          <Button onClick={() => handleOpenTeamModal()}>+ Add Member</Button>
        </div>
        <div className="table-container">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted">
                    No team members yet. Add team members to collaborate.
                  </td>
                </tr>
              ) : (
                teamMembers.map((member) => (
                  <tr key={member.id} className="border-b border-line hover:bg-bg-secondary">
                    <td className="p-3 font-medium">{member.name}</td>
                    <td className="p-3 text-muted">{member.email}</td>
                    <td className="p-3">{getRoleBadge(member.role)}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => handleOpenTeamModal(member)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteMember(member.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showTeamModal && (
        <Modal
          open={showTeamModal}
          title={editingMember ? "Edit Team Member" : "Add Team Member"}
          onClose={() => {
            setShowTeamModal(false);
            setEditingMember(null);
          }}
        >
          <form onSubmit={handleTeamSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <Input
                required
                value={teamFormData.name}
                onChange={(e) => setTeamFormData({ ...teamFormData, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <Input
                required
                type="email"
                value={teamFormData.email}
                onChange={(e) => setTeamFormData({ ...teamFormData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <Select
                value={teamFormData.role}
                onChange={(e) => setTeamFormData({ ...teamFormData, role: e.target.value as TeamRole })}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowTeamModal(false);
                  setEditingMember(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editingMember ? "Save Changes" : "Add Member"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
