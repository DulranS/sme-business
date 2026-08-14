"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, formatNumber, todayIso } from "@/lib/format";
import type { Product } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { Button, Field, Input, Label, Select } from "@/components/ui";

// These three forms back every "just get the data in fast" entry point in
// the app (Dashboard quick actions, Products page per-row +Stock/Sell).
// Kept in one place so the qty→profit math, the oversell warning, and the
// error handling only exist once. `onDone` closes whatever modal is
// hosting the form; each form is responsible for its own toast feedback so
// a failed write never leaves the user staring at a modal that silently
// did nothing.

function SummaryRow({ label, value, currency, muted }: { label: string; value: number; currency: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-xs ${muted ? "text-muted" : ""}`}>
      <span>{label}</span>
      <span className="num">{formatMoney(value, currency)}</span>
    </div>
  );
}

export function QuickSaleForm({ fixedProduct, onDone }: { fixedProduct?: Product; onDone: () => void }) {
  const { products, ledgers, addSale, settings } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const sellable = useMemo(() => products.filter((p) => p.active), [products]);

  const [productId, setProductId] = useState(fixedProduct?.id ?? sellable[0]?.id ?? "");
  const product = fixedProduct ?? products.find((p) => p.id === productId);
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState(product?.defaultSellPrice?.toString() ?? "");
  const [date, setDate] = useState(todayIso());
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const wac = ledgers.get(productId)?.wac ?? 0;
  const qtyOnHand = ledgers.get(productId)?.qtyOnHand ?? 0;
  const isProduct = product?.type === "product";

  const qtyNum = Number(qty) || 0;
  const priceNum = Number(unitPrice) || 0;
  const revenue = qtyNum * priceNum;
  const cogs = isProduct ? qtyNum * wac : 0;
  const profit = revenue - cogs;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
  const oversell = isProduct && qtyNum > qtyOnHand;

  function handleProductChange(id: string) {
    setProductId(id);
    const p = products.find((pr) => pr.id === id);
    if (p?.defaultSellPrice !== undefined) setUnitPrice(p.defaultSellPrice.toString());
  }

  if (!product) return <div className="text-sm text-muted">Add a product or service first.</div>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addSale({ productId, qty: qtyNum, unitPrice: priceNum, date, customer: customer || undefined, notes: notes || undefined });
          toast.success(
            "Sale logged",
            `${product.name}: ${formatMoney(revenue, currency)} revenue, ${formatMoney(profit, currency)} profit${marginPct !== null ? ` (${marginPct.toFixed(0)}%)` : ""}`
          );
          onDone();
        } catch (err) {
          toast.error("Couldn't save the sale", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      {!fixedProduct && (
        <Field>
          <Label>What sold?</Label>
          <Select required value={productId} onChange={(e) => handleProductChange(e.target.value)}>
            {sellable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.type === "service" ? "(service)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>{isProduct ? "Quantity sold" : "Hours / jobs sold"}</Label>
          <Input required autoFocus={!!fixedProduct} type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>{isProduct ? "Selling price / unit" : "Rate per hour / job"}</Label>
          <Input required type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Date</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field>
          <Label>Customer (optional)</Label>
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {qtyNum > 0 && (
        <div className="rounded-md border border-line bg-panel2 px-3 py-2.5 space-y-1.5">
          <SummaryRow label="Revenue" value={revenue} currency={currency} />
          {isProduct && <SummaryRow label={`COGS (at ${formatMoney(wac, currency)}/unit)`} value={cogs} currency={currency} muted />}
          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-line">
            <span className="font-medium">Gross profit</span>
            <span className={`num font-semibold ${profit >= 0 ? "text-good" : "text-bad"}`}>
              {formatMoney(profit, currency)}
              {marginPct !== null && <span className="text-xs font-normal text-muted ml-1.5">({marginPct.toFixed(0)}%)</span>}
            </span>
          </div>
          {oversell && (
            <div className="text-xs text-bad pt-1">Only {formatNumber(qtyOnHand)} on hand — this will oversell.</div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !productId}>
          {busy ? "Saving…" : "Log sale"}
        </Button>
      </div>
    </form>
  );
}

export function QuickStockForm({ fixedProduct, onDone }: { fixedProduct?: Product; onDone: () => void }) {
  const { products, addPurchase, settings } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const restockable = useMemo(() => products.filter((p) => p.active && p.type === "product"), [products]);

  const [productId, setProductId] = useState(fixedProduct?.id ?? restockable[0]?.id ?? "");
  const product = fixedProduct ?? products.find((p) => p.id === productId);
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState(product?.defaultCostPrice?.toString() ?? "");
  const [date, setDate] = useState(todayIso());
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const total = (Number(qty) || 0) * (Number(unitCost) || 0);

  function handleProductChange(id: string) {
    setProductId(id);
    const p = products.find((pr) => pr.id === id);
    if (p?.defaultCostPrice !== undefined) setUnitCost(p.defaultCostPrice.toString());
  }

  if (!product) return <div className="text-sm text-muted">Add a product first — services don&apos;t carry stock.</div>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addPurchase({
            productId,
            qty: Number(qty),
            unitCost: Number(unitCost),
            date,
            supplier: supplier || undefined,
            notes: notes || undefined,
          });
          toast.success("Stock added", `${product.name}: +${qty} units at ${formatMoney(Number(unitCost), currency)} each`);
          onDone();
        } catch (err) {
          toast.error("Couldn't add stock", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      {!fixedProduct && (
        <Field>
          <Label>Which product?</Label>
          <Select required value={productId} onChange={(e) => handleProductChange(e.target.value)}>
            {restockable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Quantity received</Label>
          <Input required autoFocus={!!fixedProduct} type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>Buying price / unit</Label>
          <Input required type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Date</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field>
          <Label>Supplier (optional)</Label>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
      </div>
      <Field>
        <Label>Notes (optional)</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      <div className="rounded-md border border-line bg-panel2 px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-muted">Total cost this batch</span>
        <span className="num text-sm font-medium">{formatMoney(total, currency)}</span>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !productId}>
          {busy ? "Saving…" : "Add stock"}
        </Button>
      </div>
    </form>
  );
}

// Fast path for the dashboard: the common case (a recurring monthly cost)
// in the fewest fields. The Expenses page keeps the full form (one-off vs.
// recurring, revenue vs. expense, end dates) for anyone who needs it.
export function QuickExpenseForm({ onDone }: { onDone: () => void }) {
  const { addExpense, settings } = useData();
  const toast = useToast();
  const currency = settings.currency;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [isRecurring, setIsRecurring] = useState(true);
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addExpense({
            name,
            amount: Number(amount),
            category,
            kind: "expense",
            isRecurring,
            recurrence: isRecurring ? "monthly" : "none",
            startDate: date,
          });
          toast.success("Expense added", `${name}: ${formatMoney(Number(amount), currency)}${isRecurring ? " / month" : ""}`);
          onDone();
        } catch (err) {
          toast.error("Couldn't add expense", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      <Field>
        <Label>What is it?</Label>
        <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warehouse rent" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Amount</Label>
          <Input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— none —</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Date</Label>
        <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="accent-amber" />
        Repeats every month (uncheck for a one-off cost)
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
