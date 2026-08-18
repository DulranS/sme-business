"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { estimateNetPay, monthlyNormalizedAmount } from "@/lib/calculations";
import { formatMoney, todayIso } from "@/lib/format";
import type { Employee, Recurrence } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Stat,
  Table,
  EmptyState,
} from "@/components/ui";

export default function EmployeesPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner"]);
  const { employees, addEmployee, updateEmployee, deleteEmployee, monthlyPayroll, settings } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const currency = settings.currency;

  const activeEmployees = useMemo(() => employees.filter((e) => e.active), [employees]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(e: Employee) {
    setEditing(e);
    setModalOpen(true);
  }

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader title="Employees &amp; payroll" action={<Button onClick={openNew}>+ Add employee</Button>} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Active staff" value={activeEmployees.length.toString()} />
        <Stat label="Payroll / month" value={formatMoney(monthlyPayroll, currency)} tone="bad" sub="booked as a recurring expense" />
        <Stat
          label="Est. take-home / month"
          value={formatMoney(
            activeEmployees.reduce((s, e) => s + estimateNetPay(monthlyNormalizedAmount(e.payRate, e.payFrequency), e.taxPct), 0),
            currency
          )}
          sub="after each employee's tax %"
        />
      </div>

      {employees.length === 0 ? (
        <EmptyState
          title="No employees yet"
          body="Add staff or contractors here — their pay is booked automatically as a recurring expense (Payroll & labor) and flows straight into your P&L, same as rent or any other bill."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Role</th>
                <th className="py-2 px-3 font-medium">Cadence</th>
                <th className="py-2 px-3 font-medium text-right">Gross pay</th>
                <th className="py-2 px-3 font-medium text-right">Tax %</th>
                <th className="py-2 px-3 font-medium text-right">Est. take-home</th>
                <th className="py-2 px-3 font-medium">Status</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{e.name}</td>
                  <td className="py-2.5 px-3 text-muted">{e.role || "—"}</td>
                  <td className="py-2.5 px-3 text-muted">{e.payFrequency}</td>
                  <td className="py-2.5 px-3 num text-right">{formatMoney(e.payRate, currency)}</td>
                  <td className="py-2.5 px-3 num text-right text-muted">{e.taxPct}%</td>
                  <td className="py-2.5 px-3 num text-right text-muted">
                    {formatMoney(estimateNetPay(e.payRate, e.taxPct), currency)}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge tone={e.active ? "good" : "default"}>{e.active ? "active" : "inactive"}</Badge>
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <button onClick={() => openEdit(e)} className="text-xs text-muted hover:text-fg">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="text-[11px] text-muted mt-3">
        Tax % is each employee&apos;s own withholding/PAYE rate — shown here for take-home reference only. It
        doesn&apos;t change what the business pays out: the full gross pay is what&apos;s booked as the expense,
        since that&apos;s the actual cash cost to you.
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit employee" : "Add employee"}>
        <EmployeeForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) await updateEmployee(editing.id, values);
              else await addEmployee(values);
              toast.success(editing ? "Employee updated" : "Employee added", values.name);
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
          onDelete={
            editing
              ? async () => {
                  if (!confirm(`Remove "${editing.name}"? Their linked payroll expense will be removed too.`)) return;
                  try {
                    await deleteEmployee(editing.id);
                    toast.success("Employee removed", editing.name);
                    setModalOpen(false);
                  } catch (err) {
                    toast.error("Couldn't remove employee", toastableErrorMessage(err));
                  }
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}

function EmployeeForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Employee | null;
  onSave: (values: Omit<Employee, "id" | "createdAt" | "linkedExpenseId">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [payRate, setPayRate] = useState(initial?.payRate.toString() ?? "");
  const [payFrequency, setPayFrequency] = useState<Exclude<Recurrence, "none">>(initial?.payFrequency ?? "monthly");
  const [taxPct, setTaxPct] = useState(initial?.taxPct?.toString() ?? "0");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [active, setActive] = useState(initial?.active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          role,
          payRate: Number(payRate),
          payFrequency,
          taxPct: Number(taxPct),
          startDate,
          endDate: active ? undefined : initial?.endDate ?? todayIso(),
          active,
          notes,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kasun Perera" />
      </Field>
      <Field>
        <Label>Role (optional)</Label>
        <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Mechanic, Sales" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <Label>Gross pay</Label>
          <Input required type="number" min="0" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
        </Field>
        <Field>
          <Label>Cadence</Label>
          <Select value={payFrequency} onChange={(e) => setPayFrequency(e.target.value as Exclude<Recurrence, "none">)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <Field>
          <Label>Tax %</Label>
          <Input required type="number" min="0" max="100" step="0.5" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Start date</Label>
        <Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-amber" />
        Active — unchecking stops the recurring payroll expense going forward
      </label>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex items-center justify-between pt-2">
        <div>
          {onDelete && (
            <Button type="button" variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
