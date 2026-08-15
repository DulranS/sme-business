"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, formatNumber, todayIso } from "@/lib/format";
import type { OfferingType, Product, VariableCost } from "@/lib/types";
import { QuickStockForm, QuickSaleForm } from "@/components/QuickForms";
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
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [sellTarget, setSellTarget] = useState<Product | null>(null);

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
        title="What You Sell"
        action={<Button onClick={openNew}>+ Add something new</Button>}
      />

      {!loading && products.length === 0 ? (
        <EmptyState
          title="Nothing set up yet"
          body="Add something you sell — a physical item you buy and keep in stock, or a service where you sell your time."
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 px-3 font-medium">Type</th>
                <th className="py-2 px-3 font-medium text-right">You have</th>
                <th className="py-2 px-3 font-medium text-right">What you paid</th>
                <th className="py-2 px-3 font-medium text-right">You sell for</th>
                <th className="py-2 px-3 font-medium text-right">Worth</th>
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
                    <td className="py-2.5 px-3 num text-right text-muted">
                      {p.defaultSellPrice ? formatMoney(p.defaultSellPrice, currency) : "—"}
                    </td>
                    <td className="py-2.5 px-3 num text-right">
                      {p.type === "service" ? (
                        <span className="text-muted">—</span>
                      ) : (
                        formatMoney(l?.inventoryValue ?? 0, currency)
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                      {p.type === "product" && (
                        <button onClick={() => setStockTarget(p)} className="text-xs text-amber-soft hover:underline mr-3">
                          Buy more
                        </button>
                      )}
                      <button onClick={() => setSellTarget(p)} className="text-xs text-amber-soft hover:underline mr-3">
                        Sell
                      </button>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit this" : "Add something new"}>
        <ProductForm
          initial={editing}
          currency={currency}
          onCancel={() => setModalOpen(false)}
          onSave={async (values) => {
            try {
              if (editing) await updateProduct(editing.id, values);
              else await addProduct(values);
              toast.success(editing ? "Offering updated" : "Offering added", values.name);
              setModalOpen(false);
            } catch (err) {
              toast.error("Couldn't save", toastableErrorMessage(err));
            }
          }}
          onDelete={
            editing
              ? async () => {
                  if (!confirm(`Delete "${editing.name}"? This can't be undone — old sales and buys for it stay on record, but you won't be able to log new ones.`)) return;
                  try {
                    await deleteProduct(editing.id);
                    toast.success("Offering deleted", editing.name);
                    setModalOpen(false);
                  } catch (err) {
                    toast.error("Couldn't delete", toastableErrorMessage(err));
                  }
                }
              : undefined
          }
        />
      </Modal>

      <Modal open={!!stockTarget} onClose={() => setStockTarget(null)} title={stockTarget ? `Add stock — ${stockTarget.name}` : "Add stock"}>
        {stockTarget && <QuickStockForm fixedProduct={stockTarget} onDone={() => setStockTarget(null)} />}
      </Modal>

      <Modal open={!!sellTarget} onClose={() => setSellTarget(null)} title={sellTarget ? `Log sale — ${sellTarget.name}` : "Log sale"}>
        {sellTarget && <QuickSaleForm fixedProduct={sellTarget} onDone={() => setSellTarget(null)} />}
      </Modal>
    </>
  );
}

function ProductForm({
  initial,
  currency,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Product | null;
  currency: string;
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
  const [defaultCostPrice, setDefaultCostPrice] = useState(initial?.defaultCostPrice?.toString() ?? "");
  const [defaultSellPrice, setDefaultSellPrice] = useState(initial?.defaultSellPrice?.toString() ?? "");
  const [laborCostPerUnit, setLaborCostPerUnit] = useState(initial?.laborCostPerUnit?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  const cost = Number(defaultCostPrice) || 0;
  const sell = Number(defaultSellPrice) || 0;
  const labor = Number(laborCostPerUnit) || 0;
  const marginPerUnit = sell - cost;
  const marginPct = sell > 0 ? (marginPerUnit / sell) * 100 : null;
  const fullyLoadedMarginPerUnit = sell - cost - labor;
  const fullyLoadedMarginPct = sell > 0 ? (fullyLoadedMarginPerUnit / sell) * 100 : null;

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
          defaultCostPrice: defaultCostPrice ? Number(defaultCostPrice) : undefined,
          defaultSellPrice: defaultSellPrice ? Number(defaultSellPrice) : undefined,
          laborCostPerUnit: laborCostPerUnit ? Number(laborCostPerUnit) : undefined,
        });
        setBusy(false);
      }}
      className="space-y-4"
    >
      <Field>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as OfferingType)}>
          <option value="product">Something I buy and keep in stock</option>
          <option value="service">Something I do (a service — no stock)</option>
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

      <div className="border border-line rounded-md p-3 space-y-3">
        <div className="text-xs font-medium text-muted">
          Usual prices (optional) — fills these in for you every time you buy or sell this, so you don&apos;t have
          to type them again. You can always change them for a one-off deal.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <Label>{type === "service" ? "What it usually costs you" : "What you usually pay for one"}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={defaultCostPrice}
              onChange={(e) => setDefaultCostPrice(e.target.value)}
            />
          </Field>
          <Field>
            <Label>{type === "service" ? "What you usually charge" : "What you usually sell it for"}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={defaultSellPrice}
              onChange={(e) => setDefaultSellPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field>
          <Label>Your own time on this (optional)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={laborCostPerUnit}
            onChange={(e) => setLaborCostPerUnit(e.target.value)}
            placeholder="e.g. what an employee's time is worth to make/deliver one"
          />
          <div className="text-[11px] text-muted mt-1">
            Only fill this in if a paid employee does the work themselves (not a contractor you already log as a
            purchase). It won&apos;t change the price you paid — it just shows you the real profit after their time
            is counted too, on the Profit page.
          </div>
        </Field>
        {(cost > 0 || sell > 0) && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">You&apos;d make per one</span>
              <span className={`num font-medium ${marginPerUnit >= 0 ? "text-good" : "text-bad"}`}>
                {formatMoney(marginPerUnit, currency)}
                {marginPct !== null && <span className="text-muted font-normal ml-1">({marginPct.toFixed(0)}%)</span>}
              </span>
            </div>
            {labor > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">...after your time too</span>
                <span className={`num font-medium ${fullyLoadedMarginPerUnit >= 0 ? "text-good" : "text-bad"}`}>
                  {formatMoney(fullyLoadedMarginPerUnit, currency)}
                  {fullyLoadedMarginPct !== null && (
                    <span className="text-muted font-normal ml-1">({fullyLoadedMarginPct.toFixed(0)}%)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        )}
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
  const { products, ledgers, eoqByProduct, onOrderByProduct, settings } = useData();
  const currency = settings.currency;
  const stockProducts = useMemo(() => products.filter((p) => p.type === "product" && p.active), [products]);

  if (stockProducts.length === 0) return null;

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Reorder planning (EOQ)</div>
          <div className="text-xs text-muted mt-0.5 mb-4">
            Economic order quantity — the batch size that minimizes ordering + holding cost, based on your last 90
            days of sales. Set ordering cost / holding % / lead time per-product for accuracy, or use the Settings
            defaults.
          </div>
        </div>
        <Link href="/purchase-orders" className="text-xs text-amber-soft shrink-0">
          Place order →
        </Link>
      </div>
      <Table>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
            <th className="py-2 pr-3 font-medium">Product</th>
            <th className="py-2 px-3 font-medium text-right">On hand</th>
            <th className="py-2 px-3 font-medium text-right">On order</th>
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
            const onOrder = onOrderByProduct.get(p.id) ?? 0;
            // Stock already on order counts toward the reorder point, so a
            // pending delivery doesn't get double-flagged as "reorder now".
            const needsReorder = eoq && eoq.reorderPoint > 0 && qty + onOrder <= eoq.reorderPoint;
            return (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-3 font-medium">{p.name}</td>
                <td className="py-2.5 px-3 num text-right">{formatNumber(qty)}</td>
                <td className="py-2.5 px-3 num text-right text-muted">{onOrder > 0 ? formatNumber(onOrder) : "—"}</td>
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
                <button onClick={() => { if (confirm("Delete this variable cost?")) deleteVariableCost(v.id); }} className="text-xs text-muted hover:text-bad">
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
