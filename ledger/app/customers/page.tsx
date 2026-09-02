"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/format";
import type { Customer } from "@/lib/types";
import {
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Stat,
  StatGridSkeleton,
  Table,
  TableCardSkeleton,
  EmptyState,
} from "@/components/ui";

// A lightweight directory, not a CRM: Sale.customer stays a free-text field
// (see the Customer type comment in lib/types.ts), so the per-customer
// numbers below are computed by matching this list's `name` against the
// existing sales/receivables data rather than a foreign key. That means a
// customer only shows revenue/outstanding once at least one sale has been
// logged under the exact same name — the sale form's autocomplete (backed
// by this same list) is what keeps names consistent going forward.
export default function CustomersPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager", "staff"]);
  const { customers, addCustomer, updateCustomer, deleteCustomer, sales, receivablesAging, settings, role, loading } =
    useData();
  const toast = useToast();
  const currency = settings.currency;
  const canEdit = can(role, "manage:customers");
  const canDelete = can(role, "delete:records");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const statsByName = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number; lastDate: string; outstanding: number }>();
    const key = (name: string) => name.trim().toLowerCase();
    for (const s of sales) {
      if (!s.customer) continue;
      const k = key(s.customer);
      const entry = map.get(k) ?? { revenue: 0, count: 0, lastDate: "", outstanding: 0 };
      entry.revenue += s.unitPrice * s.qty;
      entry.count += 1;
      if (!entry.lastDate || s.date > entry.lastDate) entry.lastDate = s.date;
      map.set(k, entry);
    }
    for (const line of receivablesAging.lines) {
      const k = key(line.customer);
      const entry = map.get(k) ?? { revenue: 0, count: 0, lastDate: "", outstanding: 0 };
      entry.outstanding += line.amountOutstanding;
      map.set(k, entry);
    }
    return map;
  }, [sales, receivablesAging]);

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (statsByName.get(c.name.trim().toLowerCase())?.outstanding ?? 0), 0),
    [customers, statsByName]
  );

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setModalOpen(true);
  }

  if (guardLoading || !allowed) return null;

  if (loading) {
    return (
      <>
        <PageHeader title="Customers" action={<Button disabled>+ Add customer</Button>} />
        <StatGridSkeleton count={2} className="lg:grid-cols-3" />
        <TableCardSkeleton rows={6} cols={4} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Customers" action={<Button onClick={openNew}>+ Add customer</Button>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Customers" value={customers.length.toString()} />
        <Stat label="Owe you" value={formatMoney(totalOutstanding, currency)} tone={totalOutstanding > 0 ? "bad" : "good"} />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          body="Add regulars here so their name shows up as a pick on the sale form instead of getting retyped — and slightly misspelled — every visit. Every new name you type on a sale is also added here automatically."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Contact</th>
                <th className="py-2 px-3 font-medium text-right">Sales</th>
                <th className="py-2 px-3 font-medium text-right">Revenue</th>
                <th className="py-2 px-3 font-medium text-right">Owes you</th>
                <th className="py-2 px-3 font-medium">Last sale</th>
                {canEdit && <th className="py-2 pl-3 font-medium text-right">·</th>}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const stats = statsByName.get(c.name.trim().toLowerCase());
                return (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{c.name}</td>
                    <td className="py-2.5 px-3 text-muted">{c.contact || "—"}</td>
                    <td className="py-2.5 px-3 num text-right text-muted">{stats?.count ?? 0}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(stats?.revenue ?? 0, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">
                      {stats?.outstanding ? (
                        <span className="text-amber-soft">{formatMoney(stats.outstanding, currency)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-muted">{stats?.lastDate || "—"}</td>
                    {canEdit && (
                      <td className="py-2.5 pl-3 text-right">
                        <button onClick={() => openEdit(c)} className="text-xs text-muted hover:text-fg">
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit customer" : "Add customer"}>
        <CustomerForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) await updateCustomer(editing.id, values);
              else await addCustomer(values);
              toast.success(editing ? "Customer updated" : "Customer added", values.name);
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
          onDelete={
            editing && canDelete
              ? async () => {
                  if (!confirm(`Remove "${editing.name}" from the directory? Their past sales aren't affected.`)) return;
                  try {
                    await deleteCustomer(editing.id);
                    toast.success("Customer removed", editing.name);
                    setModalOpen(false);
                  } catch (err) {
                    toast.error("Couldn't remove customer", toastableErrorMessage(err));
                  }
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}

function CustomerForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Customer | null;
  onSave: (values: Omit<Customer, "id" | "createdAt" | "createdByUid" | "createdByName">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          contact: contact || undefined,
          notes: notes || undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Name</Label>
        <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nimal Fernando" />
      </Field>
      <Field>
        <Label>Phone or email (optional)</Label>
        <Input value={contact} onChange={(e) => setContact(e.target.value)} />
      </Field>
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
