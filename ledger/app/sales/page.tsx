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

export default function SalesPage() {
  const { products, sales, saleEconomics, addSale, deleteSale, settings, loading } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const currency = settings.currency;

  const econById = useMemo(() => new Map(saleEconomics.map((e) => [e.saleId, e])), [saleEconomics]);

  return (
    <>
      <PageHeader
        title="Sales"
        action={
          <Button onClick={() => setModalOpen(true)} disabled={products.length === 0}>
            + Log sale
          </Button>
        }
      />

      {!loading && products.length === 0 && (
        <EmptyState title="Add an offering first" body="You need at least one product or service before logging a sale." />
      )}

      {!loading && products.length > 0 && sales.length === 0 && (
        <EmptyState title="No sales logged" body="Log a sale to see gross profit and contribution margin calculated automatically." />
      )}

      {sales.length > 0 && (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium">Offering</th>
                <th className="py-2 px-3 font-medium text-right">Qty</th>
                <th className="py-2 px-3 font-medium text-right">Price</th>
                <th className="py-2 px-3 font-medium text-right">Revenue</th>
                <th className="py-2 px-3 font-medium text-right">Gross profit</th>
                <th className="py-2 px-3 font-medium text-right">Contribution</th>
                <th className="py-2 pl-3 font-medium text-right">·</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const product = products.find((p) => p.id === s.productId);
                const econ = econById.get(s.id);
                return (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 text-muted num">{s.date}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {product?.name ?? "—"}
                      {product?.type === "service" && (
                        <span className="ml-1.5">
                          <Badge tone="amber">service</Badge>
                        </span>
                      )}
                      {econ?.oversold && (
                        <span className="ml-1.5">
                          <Badge tone="bad">oversold</Badge>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right">{s.qty}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(s.unitPrice, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">{formatMoney(econ?.revenue ?? 0, currency)}</td>
                    <td className="py-2.5 px-3 num text-right">
                      <span className={econ && econ.grossProfit >= 0 ? "text-good" : "text-bad"}>
                        {formatMoney(econ?.grossProfit ?? 0, currency)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 num text-right text-muted">
                      {formatMoney(econ?.contributionMargin ?? 0, currency)}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => deleteSale(s.id)} className="text-xs text-muted hover:text-bad">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Log sale">
        <SaleForm
          products={products}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            await addSale(values);
            setModalOpen(false);
          }}
        />
      </Modal>
    </>
  );
}

function SaleForm({
  products,
  onSave,
  onCancel,
}: {
  products: Product[];
  onSave: (values: {
    productId: string;
    qty: number;
    unitPrice: number;
    date: string;
    customer?: string;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [date, setDate] = useState(todayIso());
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const isService = selected?.type === "service";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ productId, qty: Number(qty), unitPrice: Number(unitPrice), date, customer, notes });
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
          <Label>{isService ? "Hours / jobs sold" : "Quantity sold"}</Label>
          <Input required type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>{isService ? "Rate per hour / job" : "Sale price / unit"}</Label>
          <Input required type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Date</Label>
        <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field>
        <Label>Customer (optional)</Label>
        <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
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
          {busy ? "Saving…" : "Save sale"}
        </Button>
      </div>
    </form>
  );
}
