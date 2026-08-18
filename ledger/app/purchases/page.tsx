"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, todayIso } from "@/lib/format";
import type { Product } from "@/lib/types";
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
  const { products, purchases, addPurchase, deletePurchase, settings, loading, projects } = useData();
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const currency = settings.currency;

  const filteredPurchases = useMemo(() => {
    if (selectedProject === "all") return purchases;
    return purchases.filter((p) => p.projectId === selectedProject);
  }, [purchases, selectedProject]);

  function handleDelete(id: string) {
    if (!confirm("Delete this? This can't be undone and will take it back out of your stock.")) return;
    deletePurchase(id)
      .then(() => toast.success("Entry deleted"))
      .catch(() => toast.error("Couldn't delete the entry"));
  }

  return (
    <>
      <PageHeader
        title="Things You Bought"
        action={
          <Button onClick={() => setModalOpen(true)} disabled={products.length === 0}>
            + I bought something
          </Button>
        }
      />

      {projects.length > 0 && (
        <div className="mb-4">
          <Select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="max-w-xs"
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

      {!loading && products.length > 0 && filteredPurchases.length === 0 && purchases.length > 0 && (
        <EmptyState title="No purchases for this project" body="Select a different project or add purchases to this project." />
      )}

      {!loading && products.length > 0 && purchases.length === 0 && (
        <EmptyState
          title="Nothing bought yet"
          body="Buying stock? Log how many and what you paid each. Doing a service? Log what it costs you to deliver it — your time, a contractor, materials."
        />
      )}

      {filteredPurchases.length > 0 && (
        <Card>
          <div className="table-container">
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
              {filteredPurchases.map((p) => {
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
                      {(p.paymentStatus === "unpaid" || p.paymentStatus === "partial") && (
                        <span className="ml-1.5">
                          <Link href="/receivables-payables">
                            <Badge tone="bad">{p.paymentStatus === "unpaid" ? "unpaid" : "partial"}</Badge>
                          </Link>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{p.qty}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(p.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(p.qty * p.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 text-muted">{p.supplier || "—"}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => handleDelete(p.id)} className="text-xs text-muted hover:text-bad">
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="I bought something">
        <PurchaseForm
          products={products}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              await addPurchase(values);
              toast.success("Logged", `${values.qty} × ${formatMoney(values.unitCost, currency)} each`);
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
  onSave,
  onCancel,
}: {
  products: Product[];
  onSave: (values: {
    productId: string;
    qty: number;
    unitCost: number;
    date: string;
    supplier?: string;
    notes?: string;
    paymentStatus?: "paid" | "unpaid" | "partial";
    dueDate?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState(products[0]?.defaultCostPrice?.toString() ?? "");
  const [date, setDate] = useState(todayIso());
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [onCredit, setOnCredit] = useState(false);
  const [dueDate, setDueDate] = useState("");
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
        await onSave({
          productId,
          qty: Number(qty),
          unitCost: Number(unitCost),
          date,
          supplier,
          notes,
          paymentStatus: onCredit ? "unpaid" : undefined,
          dueDate: onCredit && dueDate ? dueDate : undefined,
        });
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={onCredit} onChange={(e) => setOnCredit(e.target.checked)} className="accent-amber" />
        Bought on credit — not paid yet
      </label>
      {onCredit && (
        <Field>
          <Label>Due date (optional)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-2 flex-wrap">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
