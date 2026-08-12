"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { formatMoney, formatNumber } from "@/lib/format";
import type { OfferingType, Product, VariableCost } from "@/lib/types";
import {
  Button,
  Card,
  Field,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Table,
  Badge,
  EmptyState,
} from "@/components/ui";

export default function ProductsPage() {
  const { products, ledgers, settings, deleteProduct, addProduct, updateProduct, loading } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const currency = settings.currency;

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setModalOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Products &amp; services"
        action={<Button onClick={openNew}>+ Add offering</Button>}
      />

      {!loading && products.length === 0 ? (
        <EmptyState
          title="Nothing set up yet"
          body="Add a physical product (wholesale-bought, held as stock) or a service (labor/time-based, no inventory) to start logging activity against it."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium text-right">On hand</th>
                <th className="py-2 px-3 font-medium text-right">Avg. cost</th>
                <th className="py-2 px-3 font-medium text-right">Value</th>
                <th className="py-2 pl-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const l = ledgers.get(p.id);
                const qty = l?.qtyOnHand ?? 0;
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="flex gap-1 mt-0.5">
                        {!p.active && <Badge>inactive</Badge>}
                        {p.sku && <span className="text-xs text-muted">{p.sku}</span>}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge tone={p.type === "service" ? "amber" : "default"}>{p.type}</Badge>
                    </td>
                    <td className="py-2.5 px-3 num text-right">
                      {p.type === "service" ? (
                        <span className="text-muted">—</span>
                      ) : qty < 0 ? (
                        <span className="text-bad">{formatNumber(qty)}</span>
                      ) : (
                        formatNumber(qty)
                      )}
                    </td>
                    <td className="py-2.5 px-3 num text-right text-muted">
                      {formatMoney(l?.wac ?? 0, currency)}
                    </td>
                    <td className="py-2.5 px-3 num text-right">
                      {p.type === "service" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        formatMoney(l?.inventoryValue ?? 0, currency)
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-xs text-muted hover:text-fg">
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <ReorderPlanningSection />
      <VariableCostsSection />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit offering" : "Add offering"}>
        <ProductForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            if (editing) await updateProduct(editing.id, values);
            else await addProduct(values);
            setModalOpen(false);
          }}
          onDelete={
            editing
              ? async () => {
                  await deleteProduct(editing.id);
                  setModalOpen(false);
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}

function ProductForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Product | null;
  onSave: (values: Omit<Product, "id" | "createdAt">) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [type, setType] = useState<OfferingType>(initial?.type ?? "product");
  const [active, setActive] = useState(initial?.active ?? true);
  const [orderingCost, setOrderingCost] = useState(initial?.orderingCost?.toString() ?? "");
  const [holdingCostPct, setHoldingCostPct] = useState(initial?.holdingCostPct?.toString() ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(initial?.leadTimeDays?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({
          name,
          sku,
          category,
          type,
          active,
          orderingCost: orderingCost ? Number(orderingCost) : undefined,
          holdingCostPct: holdingCostPct ? Number(holdingCostPct) : undefined,
          leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as OfferingType)}>
          <option value="product">Product (physical, held as inventory)</option>
          <option value="service">Service / labor (no inventory)</option>
        </Select>
      </Field>
      <Field>
        <Label>Name</Label>
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === "service" ? "e.g. Interior detailing" : "e.g. Suzuki Alto GF"}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>SKU / reference</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="optional" />
        </Field>
        <Field>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="optional" />
        </Field>
      </div>

      {type === "product" && (
        <div className="border border-line rounded-md p-3 space-y-3">
          <div className="text-xs font-medium text-muted">Reorder planning (optional — falls back to Settings defaults)</div>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <Label>Ordering cost</Label>
              <Input type="number" min="0" step="0.01" value={orderingCost} onChange={(e) => setOrderingCost(e.target.value)} />
            </Field>
            <Field>
              <Label>Holding cost %/yr</Label>
              <Input type="number" min="0" step="0.5" value={holdingCostPct} onChange={(e) => setHoldingCostPct(e.target.value)} />
            </Field>
            <Field>
              <Label>Lead time (days)</Label>
              <Input type="number" min="0" step="1" value={leadTimeDays} onChange={(e) => setLeadTimeDays(e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-amber" />
        Active
      </label>
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

function ReorderPlanningSection() {
  const { products, ledgers, eoqByProduct, settings } = useData();
  const currency = settings.currency;
  const stockProducts = useMemo(() => products.filter((p) => p.type === "product" && p.active), [products]);

  if (stockProducts.length === 0) return null;

  return (
    <Card className="mt-6">
      <div className="text-sm font-medium">Reorder planning (EOQ)</div>
      <div className="text-xs text-muted mt-0.5 mb-4">
        Economic order quantity — the batch size that minimizes ordering + holding cost, based on your last 90 days
        of sales. Set ordering cost / holding % / lead time per-product for accuracy, or use the Settings defaults.
      </div>
      <Table>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
            <th className="py-2 pr-3 font-medium">Product</th>
            <th className="py-2 px-3 font-medium text-right">On hand</th>
            <th className="py-2 px-3 font-medium text-right">Annual demand</th>
            <th className="py-2 px-3 font-medium text-right">EOQ</th>
            <th className="py-2 px-3 font-medium text-right">Reorder point</th>
            <th className="py-2 pl-3 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {stockProducts.map((p) => {
            const eoq = eoqByProduct.get(p.id);
            const qty = ledgers.get(p.id)?.qtyOnHand ?? 0;
            const needsReorder = eoq && eoq.reorderPoint > 0 && qty <= eoq.reorderPoint;
            return (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                <td className="py-2.5 px-3 num text-right">{formatNumber(qty)}</td>
                <td className="py-2.5 px-3 num text-right text-muted">{formatNumber(eoq?.annualDemand ?? 0)}</td>
                <td className="py-2.5 px-3 num text-right">
                  {eoq && eoq.eoq > 0 ? formatNumber(Math.ceil(eoq.eoq)) : "—"}
                </td>
                <td className="py-2.5 px-3 num text-right text-muted">
                  {eoq && eoq.reorderPoint > 0 ? formatNumber(Math.ceil(eoq.reorderPoint)) : "—"}
                </td>
                <td className="py-2.5 pl-3 text-right">
                  {!eoq || eoq.eoq === 0 ? (
                    <span className="text-xs text-muted">need more data</span>
                  ) : needsReorder ? (
                    <Badge tone="bad">reorder now</Badge>
                  ) : (
                    <Badge tone="good">ok</Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="text-[11px] text-muted mt-3">
        &quot;need more data&quot; means ordering cost, holding %, or sales history isn&apos;t set/available yet for that
        product — check Settings defaults or the product&apos;s own EOQ fields.
      </div>
    </Card>
  );
}

function VariableCostsSection() {
  const { products, variableCosts, addVariableCost, deleteVariableCost, settings } = useData();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<VariableCost["type"]>("per_unit");
  const [amount, setAmount] = useState("");
  const [productId, setProductId] = useState("");
  const currency = settings.currency;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await addVariableCost({
      name,
      type,
      amount: Number(amount),
      productId: productId || undefined,
    });
    setName("");
    setAmount("");
    setProductId("");
  }

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm font-medium">Variable costs per unit</div>
          <div className="text-xs text-muted mt-0.5">
            Packaging, payment fees, delivery, subcontractor cuts — applied automatically to gross profit for
            contribution margin. Works for products and services alike.
          </div>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-amber-soft">
          {open ? "Close" : "+ Add"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 items-end">
          <Field>
            <Label>Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Payment fee" />
          </Field>
          <Field>
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as VariableCost["type"])}>
              <option value="per_unit">Flat / unit</option>
              <option value="percent">% of sale price</option>
            </Select>
          </Field>
          <Field>
            <Label>{type === "per_unit" ? `Amount (${currency})` : "Amount (%)"}</Label>
            <Input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field>
            <Label>Applies to</Label>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">All offerings</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Add</Button>
        </form>
      )}

      {variableCosts.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {variableCosts.map((v) => {
            const product = products.find((p) => p.id === v.productId);
            return (
              <div key={v.id} className="flex items-center justify-between text-sm py-1.5 border-b border-line last:border-0">
                <div>
                  <span className="font-medium">{v.name}</span>{" "}
                  <span className="text-muted text-xs">
                    ({v.type === "per_unit" ? formatMoney(v.amount, currency) : `${v.amount}%`} ·{" "}
                    {product ? product.name : "all offerings"})
                  </span>
                </div>
                <button onClick={() => deleteVariableCost(v.id)} className="text-xs text-muted hover:text-bad">
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
