"use client";

import { useMemo, useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast, toastableErrorMessage } from "@/contexts/ToastContext";
import { formatMoney, formatNumber, todayIso } from "@/lib/format";
import type { PaymentMethod, Product, Sale } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { CURRENCIES, convertToBase } from "@/lib/fx";
import { Button, Field, Input, Label, Select } from "@/components/ui";

// These three forms back every "just get the data in fast" entry point in
// the app (Dashboard quick actions, Products page per-row +Stock/Sell).
// Kept in one place so the qty→profit math, the oversell warning, and the
// error handling only exist once. `onDone` closes whatever modal is
// hosting the form; each form is responsible for its own toast feedback so
// a failed write never leaves the user staring at a modal that silently
// did nothing.

// Shared by QuickSaleForm and QuickStockForm: lets a single transaction be
// entered in a currency other than the business's base currency. Only shows
// the rate input once a non-base currency is picked — the common case (same
// currency as always) stays a single dropdown, no extra fields to fill in.
function CurrencyRateFields({
  baseCurrency,
  currency,
  onCurrencyChange,
  exchangeRate,
  onExchangeRateChange,
}: {
  baseCurrency: string;
  currency: string;
  onCurrencyChange: (c: string) => void;
  exchangeRate: string;
  onExchangeRateChange: (r: string) => void;
}) {
  const currencyOptions = CURRENCIES.includes(baseCurrency) ? CURRENCIES : [baseCurrency, ...CURRENCIES];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field>
        <Label>Currency</Label>
        <Select value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
          {currencyOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      {currency !== baseCurrency && (
        <Field>
          <Label>
            Rate (1 {currency} = ? {baseCurrency})
          </Label>
          <Input
            required
            type="number"
            min="0"
            step="0.0001"
            value={exchangeRate}
            onChange={(e) => onExchangeRateChange(e.target.value)}
          />
        </Field>
      )}
    </div>
  );
}

function SummaryRow({ label, value, currency, muted }: { label: string; value: number; currency: string; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-xs ${muted ? "text-muted" : ""}`}>
      <span>{label}</span>
      <span className="num">{formatMoney(value, currency)}</span>
    </div>
  );
}

export function QuickSaleForm({
  fixedProduct,
  existingSale,
  onDone,
}: {
  fixedProduct?: Product;
  existingSale?: Sale;
  onDone: () => void;
}) {
  const { products, catalog, ledgers, addSale, updateSale, settings, projects, customers, addCustomer } = useData();
  const { role } = useAuth();
  const toast = useToast();
  const currency = settings.currency;
  const isStaff = role === "staff";

  // Staff never has read access to `products` (it carries cost prices) —
  // the picker for that role is built from `catalog`, a cost-stripped
  // mirror. Everyone else uses the real product list, cost preview and all.
  const sellable = useMemo(() => {
    if (isStaff) {
      return catalog
        .filter((c) => c.active)
        .map((c) => ({ id: c.id, name: c.name, type: c.type, defaultSellPrice: c.sellPrice }));
    }
    return products.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, type: p.type, defaultSellPrice: p.defaultSellPrice }));
  }, [isStaff, catalog, products]);

  const lockedProduct = fixedProduct ?? (existingSale ? products.find((p) => p.id === existingSale.productId) : undefined);
  const [productId, setProductId] = useState(lockedProduct?.id ?? existingSale?.productId ?? sellable[0]?.id ?? "");
  const product = lockedProduct ?? sellable.find((p) => p.id === productId);
  const [qty, setQty] = useState(existingSale?.qty?.toString() ?? "");
  const [unitPrice, setUnitPrice] = useState(
    (existingSale?.foreignUnitPrice ?? existingSale?.unitPrice)?.toString() ?? product?.defaultSellPrice?.toString() ?? ""
  );
  const [txCurrency, setTxCurrency] = useState(existingSale?.currency ?? settings.currency);
  const [exchangeRate, setExchangeRate] = useState((existingSale?.exchangeRate ?? 1).toString());
  const [date, setDate] = useState(existingSale?.date ?? todayIso());
  const [customer, setCustomer] = useState(existingSale?.customer ?? "");
  const [customerContact, setCustomerContact] = useState(existingSale?.customerContact ?? "");
  const [notes, setNotes] = useState(existingSale?.notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(existingSale?.paymentMethod ?? "cash");
  const [creditTermDays, setCreditTermDays] = useState(
    (existingSale?.creditTermDays ?? settings.defaultCreditTermDays).toString()
  );
  const [projectId, setProjectId] = useState(existingSale?.projectId ?? "");
  const [busy, setBusy] = useState(false);
  // Notes and Project are both optional and used far less often than the
  // fields above — pre-existing values (editing a sale that already has
  // them) start expanded so nothing silently hides data that's already
  // there; a fresh sale starts collapsed so the common case is a short form.
  const [showMoreDetails, setShowMoreDetails] = useState(!!(existingSale?.notes || existingSale?.projectId));

  const wac = ledgers.get(productId)?.wac ?? 0;
  const qtyOnHand = ledgers.get(productId)?.qtyOnHand ?? 0;
  const isProduct = product?.type === "product";

  const qtyNum = Number(qty) || 0;
  const priceNum = Number(unitPrice) || 0; // entered price, in txCurrency
  const rateNum = txCurrency === settings.currency ? 1 : Number(exchangeRate) || 0;
  const basePriceNum = convertToBase(priceNum, rateNum); // base-currency equivalent — what every calc below uses
  const revenue = qtyNum * basePriceNum;
  const cogs = isProduct ? qtyNum * wac : 0;
  const profit = revenue - cogs;
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;
  // When editing a past sale, the units it already took out of stock are
  // still reflected in the current on-hand count, so the true "room" for
  // this sale is what's on hand plus what it already used. Staff can't
  // reach the edit path at all (only Owner/Manager can), so this only ever
  // applies to a role that already has full stock visibility.
  const availableForThisSale = isProduct ? qtyOnHand + (existingSale?.qty ?? 0) : Infinity;
  const oversell = isProduct && !isStaff && qtyNum > availableForThisSale;

  function handleProductChange(id: string) {
    setProductId(id);
    const p = sellable.find((pr) => pr.id === id);
    if (p?.defaultSellPrice !== undefined) setUnitPrice(p.defaultSellPrice.toString());
  }

  if (!product) return <div className="text-sm text-muted">Add a product or service first.</div>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const values = {
            productId,
            qty: qtyNum,
            unitPrice: basePriceNum,
            currency: txCurrency !== settings.currency ? txCurrency : undefined,
            exchangeRate: txCurrency !== settings.currency ? rateNum : undefined,
            foreignUnitPrice: txCurrency !== settings.currency ? priceNum : undefined,
            date,
            customer: customer || undefined,
            customerContact: customerContact || undefined,
            notes: notes || undefined,
            paymentMethod,
            creditTermDays: paymentMethod === "credit" ? Number(creditTermDays) || settings.defaultCreditTermDays : undefined,
            projectId: projectId || undefined,
          };
          if (existingSale) {
            await updateSale(existingSale.id, values);
            toast.success("Updated", `${product.name}: ${formatMoney(revenue, currency)} revenue`);
          } else {
            await addSale(values);
            toast.success(
              "Sold!",
              isStaff
                ? `${product.name}: ${formatMoney(revenue, currency)}${paymentMethod === "credit" ? " (on credit)" : ""}`
                : `${product.name}: ${formatMoney(revenue, currency)} revenue, ${formatMoney(profit, currency)} profit${marginPct !== null ? ` (${marginPct.toFixed(0)}%)` : ""}`
            );
          }
          // Quietly grow the customer directory: if the name typed here
          // doesn't match anyone already in it, add them — so next time
          // they're one tap in the autocomplete instead of a retyped (and
          // possibly differently-spelled) name. Best-effort and silent: a
          // failed directory write should never block or surface an error
          // for a sale that already saved successfully.
          if (customer.trim() && !customers.some((c) => c.name.trim().toLowerCase() === customer.trim().toLowerCase())) {
            addCustomer({ name: customer.trim(), contact: customerContact || undefined }).catch(() => {});
          }
          onDone();
        } catch (err) {
          toast.error("Couldn't save that sale", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      {!lockedProduct && (
        <Field>
          <Label>What did you sell?</Label>
          <Select required value={productId} onChange={(e) => handleProductChange(e.target.value)}>
            {sellable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.type === "service" ? "(service)" : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>{isProduct ? "How many did you sell?" : "How many hours / jobs?"}</Label>
          <Input required autoFocus={!!fixedProduct} type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>{isProduct ? "Price for each one" : "Price for each hour / job"}</Label>
          <Input required type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </Field>
      </div>
      <CurrencyRateFields
        baseCurrency={settings.currency}
        currency={txCurrency}
        onCurrencyChange={setTxCurrency}
        exchangeRate={exchangeRate}
        onExchangeRateChange={setExchangeRate}
      />
      {txCurrency !== settings.currency && priceNum > 0 && rateNum > 0 && (
        <div className="text-xs text-muted -mt-2">
          = {formatMoney(basePriceNum, settings.currency)} per unit at this rate
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Date</Label>
          <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field>
          <Label>How did they pay?</Label>
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="credit">Credit — they&apos;ll pay later</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Customer {paymentMethod === "credit" ? "" : "(optional)"}</Label>
          <Input
            required={paymentMethod === "credit"}
            value={customer}
            list="customer-directory"
            onChange={(e) => {
              const v = e.target.value;
              setCustomer(v);
              // Picked (or typed exactly) a name already in the directory —
              // carry over their saved contact so it doesn't need retyping.
              const match = customers.find((c) => c.name.trim().toLowerCase() === v.trim().toLowerCase());
              if (match?.contact && !customerContact) setCustomerContact(match.contact);
            }}
          />
          <datalist id="customer-directory">
            {customers.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        {paymentMethod === "credit" ? (
          <Field>
            <Label>Days until due</Label>
            <Input required type="number" min="1" step="1" value={creditTermDays} onChange={(e) => setCreditTermDays(e.target.value)} />
          </Field>
        ) : (
          <Field>
            <Label>Phone (optional)</Label>
            <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
          </Field>
        )}
      </div>
      {paymentMethod === "credit" && (
        <Field>
          <Label>Their phone / contact (so you can chase this)</Label>
          <Input value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
        </Field>
      )}
      <Field>
        <button
          type="button"
          onClick={() => setShowMoreDetails((v) => !v)}
          className="text-xs text-amber-soft font-medium -mb-1"
        >
          {showMoreDetails ? "− Hide notes & project" : "+ Add notes / project"}
        </button>
      </Field>
      {showMoreDetails && (
        <>
          <Field>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {!isStaff && projects.length > 0 && (
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
        </>
      )}

      {qtyNum > 0 && (
        <div className="rounded-md border border-line bg-panel2 px-3 py-2.5 space-y-1.5">
          <SummaryRow label={paymentMethod === "credit" ? "Owed to you" : "Money coming in"} value={revenue} currency={currency} />
          {isProduct && !isStaff && (
            <SummaryRow label={`What it cost you (${formatMoney(wac, currency)} each)`} value={cogs} currency={currency} muted />
          )}
          {!isStaff && (
            <div className="flex items-center justify-between text-sm pt-1.5 border-t border-line">
              <span className="font-medium">Your profit</span>
              <span className={`num font-semibold ${profit >= 0 ? "text-good" : "text-bad"}`}>
                {formatMoney(profit, currency)}
                {marginPct !== null && <span className="text-xs font-normal text-muted ml-1.5">({marginPct.toFixed(0)}%)</span>}
              </span>
            </div>
          )}
          {oversell && (
            <div className="text-xs text-bad pt-1">You only have {formatNumber(availableForThisSale)} left — this is more than you have.</div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !productId}>
          {busy ? "Saving…" : existingSale ? "Save changes" : "Sell"}
        </Button>
      </div>
    </form>
  );
}

export function QuickStockForm({ fixedProduct, onDone }: { fixedProduct?: Product; onDone: () => void }) {
  const { products, addPurchase, settings, projects } = useData();
  const toast = useToast();
  const currency = settings.currency;
  const restockable = useMemo(() => products.filter((p) => p.active && p.type === "product"), [products]);

  const [productId, setProductId] = useState(fixedProduct?.id ?? restockable[0]?.id ?? "");
  const product = fixedProduct ?? products.find((p) => p.id === productId);
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState(product?.defaultCostPrice?.toString() ?? "");
  const [txCurrency, setTxCurrency] = useState(currency);
  const [exchangeRate, setExchangeRate] = useState("1");
  const [date, setDate] = useState(todayIso());
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);

  const costNum = Number(unitCost) || 0; // entered cost, in txCurrency
  const rateNum = txCurrency === currency ? 1 : Number(exchangeRate) || 0;
  const baseCostNum = convertToBase(costNum, rateNum); // base-currency equivalent, used everywhere downstream
  const total = (Number(qty) || 0) * baseCostNum;

  function handleProductChange(id: string) {
    setProductId(id);
    const p = products.find((pr) => pr.id === id);
    if (p?.defaultCostPrice !== undefined) setUnitCost(p.defaultCostPrice.toString());
  }

  if (!product) return <div className="text-sm text-muted">Add something to sell first — services don&apos;t have stock.</div>;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await addPurchase({
            productId,
            qty: Number(qty),
            unitCost: baseCostNum,
            currency: txCurrency !== currency ? txCurrency : undefined,
            exchangeRate: txCurrency !== currency ? rateNum : undefined,
            foreignUnitCost: txCurrency !== currency ? costNum : undefined,
            date,
            supplier: supplier || undefined,
            notes: notes || undefined,
            projectId: projectId || undefined,
          });
          toast.success("Added to your stock", `${product.name}: +${qty} at ${formatMoney(baseCostNum, currency)} each`);
          onDone();
        } catch (err) {
          toast.error("Couldn't add that stock", toastableErrorMessage(err));
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4"
    >
      {!fixedProduct && (
        <Field>
          <Label>What are you buying?</Label>
          <Select required value={productId} onChange={(e) => handleProductChange(e.target.value)}>
            {restockable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>How many did you buy?</Label>
          <Input required autoFocus={!!fixedProduct} type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field>
          <Label>Price you paid for each one</Label>
          <Input required type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </Field>
      </div>
      <CurrencyRateFields
        baseCurrency={currency}
        currency={txCurrency}
        onCurrencyChange={setTxCurrency}
        exchangeRate={exchangeRate}
        onExchangeRateChange={setExchangeRate}
      />
      {txCurrency !== currency && costNum > 0 && rateNum > 0 && (
        <div className="text-xs text-muted -mt-2">= {formatMoney(baseCostNum, currency)} per unit at this rate</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <div className="rounded-md border border-line bg-panel2 px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs text-muted">Total you paid</span>
        <span className="num text-sm font-medium">{formatMoney(total, currency)}</span>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !productId}>
          {busy ? "Saving…" : "Buy"}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
