"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { computeMRR, monthlyNormalizedAmount } from "@/lib/calculations";
import { formatMoney, todayIso } from "@/lib/format";
import type { Expense, Project, Recurrence } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
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
  StatGridSkeleton,
  Table,
  TableCardSkeleton,
  EmptyState,
} from "@/components/ui";

export default function ExpensesPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { expenses, addExpense, updateExpense, deleteExpense, settings, projects, loading } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const currency = settings.currency;

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    setModalOpen(true);
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    deleteExpense(id)
      .then(() => toast.success("Deleted", name))
      .catch(() => toast.error("Couldn't delete"));
  }

  const mrr = useMemo(() => computeMRR(expenses, todayIso()), [expenses]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      if (e.kind !== "expense") continue;
      const monthly = e.isRecurring ? monthlyNormalizedAmount(e.amount, e.recurrence) : e.amount;
      const key = e.category || "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + monthly);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  if (guardLoading || !allowed) return null;

  if (loading) {
    return (
      <>
        <PageHeader title="Expenses" action={<Button disabled>+ Add item</Button>} />
        <StatGridSkeleton count={3} className="sm:grid-cols-3" />
        <TableCardSkeleton rows={6} cols={5} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Expenses" action={<Button onClick={openNew}>+ Add item</Button>} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Recurring revenue / mo" value={formatMoney(mrr.mrrRevenue, currency)} tone="good" />
        <Stat label="Recurring expenses / mo" value={formatMoney(mrr.mrrExpense, currency)} tone="bad" />
        <Stat label="Recurring net / mo" value={formatMoney(mrr.mrrRevenue - mrr.mrrExpense, currency)} tone="amber" />
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses or recurring revenue yet"
          body="Add rent, subscriptions, salaries, marketing spend — or retainer clients as recurring revenue. One-off costs work too."
        />
      ) : (
        <>
          {categoryBreakdown.length > 0 && (
            <Card className="mb-6">
              <div className="text-sm font-medium mb-3">Spend by category (monthly equivalent)</div>
              <div className="space-y-2">
                {categoryBreakdown.map(([cat, amount]) => {
                  const max = categoryBreakdown[0][1];
                  return (
                    <div key={cat} className="flex items-center gap-3 text-xs">
                      <div className="w-32 shrink-0 text-muted truncate">{cat}</div>
                      <div className="flex-1 h-2 bg-panel2 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-dim" style={{ width: `${max > 0 ? (amount / max) * 100 : 0}%` }} />
                      </div>
                      <div className="num w-24 text-right shrink-0">{formatMoney(amount, currency)}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Kind</th>
                <th className="py-2 px-3 font-medium">Cadence</th>
                <th className="py-2 px-3 font-medium text-right">Amount</th>
                <th className="py-2 px-3 font-medium text-right">Monthly equiv.</th>
                <th className="py-2 px-3 font-medium">Active from</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 font-medium">
                    {e.name}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted font-normal">{e.category}</span>
                      {e.employeeId && (
                        <span>
                          <Badge tone="amber">payroll</Badge>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge tone={e.kind === "revenue" ? "good" : "default"}>{e.kind}</Badge>
                  </td>
                  <td className="py-2.5 px-3 text-muted">{e.isRecurring ? e.recurrence : "one-off"}</td>
                  <td className="py-2.5 px-3 num text-right">{formatMoney(e.amount, currency)}</td>
                  <td className="py-2.5 px-3 num text-right text-muted">
                    {e.isRecurring ? formatMoney(monthlyNormalizedAmount(e.amount, e.recurrence), currency) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-muted num">{e.startDate}</td>
                  <td className="py-2.5 pl-3 text-right">
                    {e.employeeId ? (
                      <Link href="/employees" className="text-xs text-amber-soft hover:underline">
                        Edit in Employees
                      </Link>
                    ) : (
                      <>
                        <button onClick={() => openEdit(e)} className="text-xs text-muted hover:text-fg mr-3">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(e.id, e.name)} className="text-xs text-muted hover:text-bad">
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit this" : "Add expense or recurring revenue"}>
        <ExpenseForm
          initial={editing}
          projects={projects}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) {
                await updateExpense(editing.id, values);
                toast.success("Updated", values.name);
              } else {
                await addExpense(values);
                toast.success("Added", values.name);
              }
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
        />
      </Modal>
    </>
  );
}

function ExpenseForm({
  initial,
  projects,
  onSave,
  onCancel,
}: {
  initial?: Expense | null;
  projects: Project[];
  onSave: (values: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [kind, setKind] = useState<Expense["kind"]>(initial?.kind ?? "expense");
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? true);
  const [recurrence, setRecurrence] = useState<Recurrence>(
    initial?.isRecurring && initial.recurrence !== "none" ? initial.recurrence : "monthly"
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayIso());
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          amount: Number(amount),
          category,
          kind,
          isRecurring,
          recurrence: isRecurring ? recurrence : "none",
          startDate,
          endDate: endDate || undefined,
          projectId: kind === "expense" ? projectId || undefined : undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse rent" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Kind</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value as Expense["kind"])}>
            <option value="expense">Expense</option>
            <option value="revenue">Recurring revenue</option>
          </Select>
        </Field>
        <Field>
          <Label>Amount</Label>
          <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Category</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">— none —</option>
          {kind === "revenue" && <option value="Recurring client revenue">Recurring client revenue</option>}
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="accent-amber" />
        Recurring
      </label>
      {isRecurring && (
        <Field>
          <Label>Cadence</Label>
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>{isRecurring ? "Starts" : "Date"}</Label>
          <Input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        {isRecurring && (
          <Field>
            <Label>Ends (optional)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        )}
      </div>
      {kind === "expense" && projects.length > 0 && (
        <Field>
          <Label>Project (optional)</Label>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— not part of a project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save changes" : "Save"}
        </Button>
      </div>
    </form>
  );
}
