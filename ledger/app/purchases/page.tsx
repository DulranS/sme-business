"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, todayIso } from "@/lib/format";
import type { Product, Purchase } from "@/lib/types";
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
  Table,
  EmptyState,
} from "@/components/ui";

export default function PurchasesPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { products, purchases, addPurchase, updatePurchase, deletePurchase, settings, loading } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const currency = settings.currency;

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Purchase) {
    setEditing(p);
    setModalOpen(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this? This can't be undone and will take it back out of your stock.")) return;
    deletePurchase(id)
      .then(() => toast.success("Entry deleted"))
      .catch(() => toast.error("Couldn't delete the entry"));
  }

  if (guardLoading || !allowed) return null;

  return (
    <>
      <PageHeader
        title="Things You Bought"
        action={
          <Button onClick={openNew} disabled={products.length === 0}>
            + I bought something
          </Button>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-muted">
            This is what you&apos;ve already paid for and have in hand. Want to place an order with a supplier and track
            it until it arrives? Use the <span className="text-fg font-medium">Orders</span> page instead — once it
            arrives, it shows up here automatically.
          </div>
          <Link href="/purchase-orders" className="text-xs text-amber-soft shrink-0">
            Go to Orders →
          </Link>
        </div>
      </Card>

      {!loading && products.length === 0 && (
        <EmptyState title="Add something first" body="Add a product or service before you log what it cost you." />
      )}

      {!loading && products.length > 0 && purchases.length === 0 && (
        <EmptyState
          title="Nothing bought yet"
          body="Buying stock? Log how many and what you paid each. Doing a service? Log what it costs you to deliver it — your time, a contractor, materials."
        />
      )}

      {purchases.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Item</th>
                <th className="py-2 px-3 font-medium text-right">How many</th>
                <th className="py-2 px-3 font-medium text-right">Price each</th>
                <th className="py-2 px-3 font-medium text-right">Total paid</th>
                <th className="py-2 px-3 font-medium">From</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => {
                const product = products.find((pr) => pr.id === p.productId);
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 text-muted num">{p.date}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {product?.name ?? "—"}
                      {product?.type === "service" && (
                        <span className="ml-1.5">
                          <Badge tone="amber">service</Badge>
                        </span>
                      )}
                      {p.purchaseOrderId && (
                        <span className="ml-1.5">
                          <Badge tone="good">from order</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{p.qty}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(p.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(p.qty * p.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 text-muted">{p.supplier || "—"}</td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="text-xs text-muted hover:text-fg mr-3">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-xs text-muted hover:text-bad">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit this" : "I bought something"}>
        <PurchaseForm
          products={products}
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) {
                await updatePurchase(editing.id, values);
                toast.success("Updated");
              } else {
                await addPurchase(values);
                toast.success("Logged", `${values.qty} × ${formatMoney(values.unitCost, currency)} each`);
              }
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save that", toastableErrorMessage(err));
            }
          }}
        />
      </Modal>
    </>
  );
}

function PurchaseForm({
  products,
  initial,
  onSave,
  onCancel,
}: {
  products: Product[];
  initial?: Purchase | null;
  onSave: (values: {
    productId: string;
    qty: number;
    unitCost: number;
    date: string;
    supplier?: string;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(initial?.productId ?? products[0]?.id ?? "");
  const [qty, setQty] = useState(initial?.qty?.toString() ?? "");
  const [unitCost, setUnitCost] = useState(
    initial?.unitCost?.toString() ?? products[0]?.defaultCostPrice?.toString() ?? ""
  );
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const isService = selected?.type === "service";

  function handleProductChange(id: string) {
    setProductId(id);
    const p = products.find((pr) => pr.id === id);
    if (p?.defaultCostPrice !== undefined) setUnitCost(p.defaultCostPrice.toString());
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ productId, qty: Number(qty), unitCost: Number(unitCost), date, supplier, notes });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>What did you buy?</Label>
        <Select required value={productId} onChange={(e) => handleProductChange(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.type === "service" ? "(service)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>{isService ? "How many hours / jobs?" : "How many did you buy?"}</Label>
          <Input required type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>{isService ? "Price you paid per hour / job" : "Price you paid for each"}</Label>
          <Input required type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Date</Label>
        <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field>
        <Label>{isService ? "Who did the work (optional)" : "Bought from (optional)"}</Label>
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </Field>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
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
