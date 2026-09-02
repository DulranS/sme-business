"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { useRequireRole } from "@/lib/roleGuard";
import { formatMoney, todayIso } from "@/lib/format";
import { CURRENCIES, convertToBase } from "@/lib/fx";
import type { Product, Project, Purchase } from "@/lib/types";
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
  TableCardSkeleton,
  EmptyState,
} from "@/components/ui";

export default function PurchasesPage() {
  const { allowed, loading: guardLoading } = useRequireRole(["owner", "manager"]);
  const { products, purchases, addPurchase, updatePurchase, deletePurchase, settings, loading, projects, supplierConcentration } = useData();
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

  if (loading) {
    return (
      <>
        <PageHeader title="Things You Bought" action={<Button disabled>+ I bought something</Button>} />
        <TableCardSkeleton rows={7} cols={5} />
      </>
    );
  }

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

      {supplierConcentration.suppliers.length > 0 && (
        <Card className="mb-5">
          <div className="text-sm font-medium mb-0.5">Supplier concentration</div>
          <div className="text-xs text-muted mb-3">
            Share of your buying (last {supplierConcentration.trailingMonths} months) riding on one supplier. High
            concentration isn&apos;t automatically bad — just worth knowing on purpose.
          </div>
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Top supplier</div>
              <div className="num text-xl font-medium mt-1 flex items-center gap-2">
                {supplierConcentration.topSupplierSharePct?.toFixed(0)}%
                <Badge
                  tone={
                    (supplierConcentration.topSupplierSharePct ?? 0) >= 60
                      ? "bad"
                      : (supplierConcentration.topSupplierSharePct ?? 0) >= 35
                      ? "amber"
                      : "good"
                  }
                >
                  {supplierConcentration.suppliers[0].supplier}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted font-medium">Top 3 combined</div>
              <div className="num text-xl font-medium mt-1">{supplierConcentration.top3SharePct?.toFixed(0)}%</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {supplierConcentration.suppliers.slice(0, 5).map((s) => (
              <div key={s.supplier} className="flex items-center justify-between text-xs border-b border-line last:border-0 py-1.5 gap-3">
                <div className="min-w-0 flex-1 truncate">{s.supplier}</div>
                <div className="num text-muted shrink-0">{formatMoney(s.spend, currency)}</div>
                <div className="num font-medium shrink-0 w-14 text-right">{s.sharePct.toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {products.length === 0 && (
        <EmptyState title="Add something first" body="Add a product or service before you log what it cost you." />
      )}

      {products.length > 0 && purchases.length === 0 && (
        <EmptyState
          title="Nothing bought yet"
          body="Buying stock? Log how many and what you paid each. Doing a service? Log what it costs you to deliver it — your time, a contractor, materials."
        />
      )}

      {purchases.length > 0 && (
        <>
          <div className="sm:hidden space-y-2.5">
            {purchases.map((p) => {
              const product = products.find((pr) => pr.id === p.productId);
              return (
                <Card key={p.id} className="!p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{product?.name ?? "—"}</div>
                      <div className="text-xs text-muted num mt-0.5">
                        {p.date} · {p.qty} × {formatMoney(p.unitCost, currency)}
                      </div>
                    </div>
                    <div className="num font-medium shrink-0">{formatMoney(p.qty * p.unitCost, currency)}</div>
                  </div>
                  {(product?.type === "service" || p.purchaseOrderId || p.supplier) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-muted">
                      {p.supplier && <span>From {p.supplier}</span>}
                      {product?.type === "service" && <Badge tone="amber">service</Badge>}
                      {p.purchaseOrderId && <Badge tone="good">from order</Badge>}
                    </div>
                  )}
                  <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-line">
                    <button onClick={() => openEdit(p)} className="text-xs text-muted hover:text-fg min-h-[32px]">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs text-muted hover:text-bad min-h-[32px]">
                      Delete
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="hidden sm:block">
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
                    <td className="py-2.5 px-3 num text-right">
                      {formatMoney(p.unitCost, currency)}
                      {p.currency && p.currency !== currency && p.foreignUnitCost !== undefined && (
                        <div className="text-[11px] text-muted">{formatMoney(p.foreignUnitCost, p.currency)}</div>
                      )}
                    </td>
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
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit this" : "I bought something"}>
        <PurchaseForm
          products={products}
          projects={projects}
          initial={editing}
          baseCurrency={currency}
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
  projects,
  initial,
  baseCurrency,
  onSave,
  onCancel,
}: {
  products: Product[];
  projects: Project[];
  initial?: Purchase | null;
  baseCurrency: string;
  onSave: (values: {
    productId: string;
    qty: number;
    unitCost: number;
    currency?: string;
    exchangeRate?: number;
    foreignUnitCost?: number;
    date: string;
    supplier?: string;
    notes?: string;
    projectId?: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState(initial?.productId ?? products[0]?.id ?? "");
  const [qty, setQty] = useState(initial?.qty?.toString() ?? "");
  const [unitCost, setUnitCost] = useState(
    (initial?.foreignUnitCost ?? initial?.unitCost)?.toString() ?? products[0]?.defaultCostPrice?.toString() ?? ""
  );
  const [txCurrency, setTxCurrency] = useState(initial?.currency ?? baseCurrency);
  const [exchangeRate, setExchangeRate] = useState((initial?.exchangeRate ?? 1).toString());
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [busy, setBusy] = useState(false);

  const selected = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const isService = selected?.type === "service";

  const costNum = Number(unitCost) || 0; // entered cost, in txCurrency
  const rateNum = txCurrency === baseCurrency ? 1 : Number(exchangeRate) || 0;
  const baseCostNum = convertToBase(costNum, rateNum); // base-currency equivalent, used everywhere downstream

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
          unitCost: baseCostNum,
          currency: txCurrency !== baseCurrency ? txCurrency : undefined,
          exchangeRate: txCurrency !== baseCurrency ? rateNum : undefined,
          foreignUnitCost: txCurrency !== baseCurrency ? costNum : undefined,
          date,
          supplier,
          notes,
          projectId: projectId || undefined,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Currency</Label>
          <Select value={txCurrency} onChange={(e) => setTxCurrency(e.target.value)}>
            {(CURRENCIES.includes(baseCurrency) ? CURRENCIES : [baseCurrency, ...CURRENCIES]).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        {txCurrency !== baseCurrency && (
          <Field>
            <Label>
              Rate (1 {txCurrency} = ? {baseCurrency})
            </Label>
            <Input
              required
              type="number"
              min="0"
              step="0.0001"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
          </Field>
        )}
      </div>
      {txCurrency !== baseCurrency && costNum > 0 && rateNum > 0 && (
        <div className="text-xs text-muted -mt-2">= {formatMoney(baseCostNum, baseCurrency)} per unit at this rate</div>
      )}
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
      {projects.length > 0 && (
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
