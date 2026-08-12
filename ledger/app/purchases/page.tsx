"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
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
  const { products, purchases, addPurchase, deletePurchase, settings, loading } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const currency = settings.currency;

  return (
    <>
      <PageHeader
        title="Purchases &amp; cost entries"
        action={
          <Button onClick={() => setModalOpen(true)} disabled={products.length === 0}>
            + Log entry
          </Button>
        }
      />

      {!loading && products.length === 0 && (
        <EmptyState title="Add an offering first" body="You need at least one product or service before logging a cost against it." />
      )}

      {!loading && products.length > 0 && purchases.length === 0 && (
        <EmptyState
          title="Nothing logged yet"
          body="For products: log a wholesale buy (qty + unit cost). For services: log what it costs you to deliver — labor, contractor fees, materials per job."
        />
      )}

      {purchases.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Offering</th>
                <th className="py-2 px-3 font-medium text-right">Qty</th>
                <th className="py-2 px-3 font-medium text-right">Unit cost</th>
                <th className="py-2 px-3 font-medium text-right">Total</th>
                <th className="py-2 px-3 font-medium">Supplier / resource</th>
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
                    </td>
                    <td className="py-2.5 px-3 num text-right">{p.qty}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(p.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(p.qty * p.unitCost, currency)}</td>
                    <td className="py-2.5 px-3 text-muted">{p.supplier || "—"}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => deletePurchase(p.id)} className="text-xs text-muted hover:text-bad">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log purchase / cost entry">
        <PurchaseForm
          products={products}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            await addPurchase(values);
            setModalOpen(false);
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
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [date, setDate] = useState(todayIso());
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const isService = selected?.type === "service";

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
        <Label>Offering</Label>
        <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.type === "service" ? "(service)" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>{isService ? "Hours / jobs delivered" : "Quantity bought"}</Label>
          <Input required type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>{isService ? "Cost per hour / job" : "Unit cost"}</Label>
          <Input required type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Date</Label>
        <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field>
        <Label>{isService ? "Contractor / resource (optional)" : "Supplier (optional)"}</Label>
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
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
